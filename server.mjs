// Spieleblock-Server – ohne externe Pakete (Node >= 20).
// Speichert Dokumente (Pfad -> JSON) im Speicher, schreibt ein Journal auf die Platte,
// verteilt Änderungen per Server-Sent Events und liefert die App aus ./public.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const PORT = +env('PORT', 3000);
const HOST = env('HOST', '0.0.0.0');
const DATA_DIR = path.resolve(env('DATA_DIR', path.join(HERE, 'data')));
const PUBLIC_DIR = path.resolve(env('PUBLIC_DIR', path.join(HERE, 'public')));
const ACCESS_KEY = env('ACCESS_KEY', '');
const TABLE_TTL_DAYS = +env('TABLE_TTL_DAYS', 30);
const BACKUP_KEEP = +env('BACKUP_KEEP', 14);
const MAX_DOCS = +env('MAX_DOCS', 50000);
const MAX_DOC_BYTES = +env('MAX_DOC_BYTES', 262144);
const RATE_PER_MIN = +env('RATE_PER_MIN', 1200);
const LOG = env('LOG', '1') !== '0';

const log = (...a) => { if (LOG) console.log(new Date().toISOString(), ...a); };

/* ---------------------------------------------------------------- store */
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const SNAP = path.join(DATA_DIR, 'snapshot.json');
const JOURNAL = path.join(DATA_DIR, 'journal.jsonl');

/** path -> {d: data, t: lastWriteMs} */
const docs = new Map();
/** parent path -> Set(full paths) */
const kids = new Map();
const parentOf = p => p.slice(0, p.lastIndexOf('/'));

function indexAdd(p) {
  const par = parentOf(p);
  let s = kids.get(par);
  if (!s) kids.set(par, (s = new Set()));
  s.add(p);
}
function indexDel(p) {
  const par = parentOf(p);
  const s = kids.get(par);
  if (s) { s.delete(p); if (!s.size) kids.delete(par); }
}
function applyPut(p, d, t) {
  if (!docs.has(p)) indexAdd(p);
  docs.set(p, { d, t });
}
function applyDel(p) {
  if (docs.delete(p)) indexDel(p);
}

function loadStore() {
  let n = 0;
  try {
    const s = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
    for (const [p, v] of Object.entries(s.docs || {})) { applyPut(p, v.d, v.t || 0); n++; }
  } catch (e) {
    if (e.code !== 'ENOENT') { console.error('Snapshot nicht lesbar:', e.message); process.exit(1); }
  }
  let j = 0, bad = 0;
  try {
    const txt = fs.readFileSync(JOURNAL, 'utf8');
    for (const line of txt.split('\n')) {
      if (!line) continue;
      try {
        const o = JSON.parse(line);
        if (o.x) applyDel(o.p); else applyPut(o.p, o.d, o.t || 0);
        j++;
      } catch { bad++; } // abgebrochene letzte Zeile nach Absturz
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  log(`Geladen: ${docs.size} Dokumente (Snapshot ${n}, Journal ${j}${bad ? `, ${bad} defekte Zeilen ignoriert` : ''})`);
  return j;
}

let journalLines = loadStore();
let jfd = fs.openSync(JOURNAL, 'a');
let dirty = false;

function journal(obj) {
  fs.writeSync(jfd, JSON.stringify(obj) + '\n');
  journalLines++;
  dirty = true;
}

function writeSnapshot() {
  const out = { v: 1, saved: new Date().toISOString(), docs: {} };
  for (const [p, v] of docs) out.docs[p] = v;
  const tmp = SNAP + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  fs.writeSync(fd, JSON.stringify(out));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, SNAP);
  fs.closeSync(jfd);
  fs.writeFileSync(JOURNAL, '');
  jfd = fs.openSync(JOURNAL, 'a');
  journalLines = 0;
  dirty = false;
}

function dailyBackup() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(DATA_DIR, 'backups', `${day}.json`);
    if (fs.existsSync(file) || !docs.size) return;
    writeSnapshot();
    fs.copyFileSync(SNAP, file);
    const all = fs.readdirSync(path.join(DATA_DIR, 'backups')).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) fs.unlinkSync(path.join(DATA_DIR, 'backups', f));
    log('Tagesbackup geschrieben:', path.basename(file));
  } catch (e) { console.error('Backup fehlgeschlagen:', e.message); }
}

function cleanupTables() {
  if (!(TABLE_TTL_DAYS > 0)) return;
  const limit = Date.now() - TABLE_TTL_DAYS * 864e5;
  const old = new Set();
  for (const [p, v] of docs) {
    const m = /^tables\/([A-Z0-9]+)$/.exec(p);
    if (m && v.t < limit) old.add(m[1]);
  }
  for (const code of old) {
    for (const p of [...docs.keys()]) {
      if (p === 'tables/' + code || p.startsWith('tables/' + code + '/')) { applyDel(p); journal({ x: 1, p }); notify(p); }
    }
  }
  if (old.size) log(`Alte Tische entfernt: ${old.size}`);
}

setInterval(() => {
  try {
    cleanupTables();
    if (dirty && journalLines > 2000) writeSnapshot();
    dailyBackup();
  } catch (e) { console.error(e); }
}, 10 * 60 * 1000).unref();
setTimeout(() => { cleanupTables(); dailyBackup(); }, 5000).unref();

/* ----------------------------------------------------------- path rules */
const SEG = /^[A-Za-z0-9_-]{1,64}$/;
function parsePath(p) {
  if (typeof p !== 'string' || !p || p.length > 300) return null;
  const segs = p.split('/');
  if (segs.length > 8 || !segs.every(s => SEG.test(s))) return null;
  return segs;
}
const ALLOWED_ROOT = new Set(['data', 'tables']);
function pathOk(segs, kind) {
  if (!segs || !ALLOWED_ROOT.has(segs[0])) return false;
  if (kind === 'doc' && segs.length % 2 !== 0) return false;
  if (kind === 'col' && segs.length % 2 !== 1) return false;
  if (segs[0] === 'data') return segs[1] === 'users' && segs.length >= 4 && /^[0-9a-f]{16}$/.test(segs[2]);
  if (segs[0] === 'tables') return /^[A-Z0-9]{4,8}$/.test(segs[1]);
  return false;
}

/* Die öffentliche Nutzer-ID ist ein Hash der Gerätekennung; die Kennung selbst
   bleibt geheim und verlässt das Gerät nur im Header X-Key. */
const KEY_RE = /^[A-Z2-9]{20}$/;
const pubId = key => crypto.createHash('sha256').update('spieleblock:' + key).digest('hex').slice(0, 16);

function authorize(req, segs) {
  // 'data/users/<id>/...' nur mit passender Gerätekennung
  if (segs[0] !== 'data') return true;
  const key = String(req.headers['x-key'] || '');
  return KEY_RE.test(key) && pubId(key) === segs[2];
}

/* --------------------------------------------------------- subscriptions */
/** cid -> {res, watches: Map(id -> {kind, path}), seq} */
const clients = new Map();

function snapDoc(p) {
  const v = docs.get(p);
  return { exists: !!v, data: v ? v.d : null };
}
function snapCol(p) {
  const s = kids.get(p);
  const out = [];
  if (s) for (const full of s) out.push({ id: full.slice(full.lastIndexOf('/') + 1), data: docs.get(full).d });
  return out;
}
function send(c, obj) {
  try { c.res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch { /* wird beim close entfernt */ }
}
function pushWatch(c, id, w) {
  if (w.kind === 'doc') send(c, { id, ...snapDoc(w.path) });
  else send(c, { id, docs: snapCol(w.path) });
}
function notify(p) {
  const par = parentOf(p);
  for (const c of clients.values()) {
    for (const [id, w] of c.watches) {
      if ((w.kind === 'doc' && w.path === p) || (w.kind === 'col' && w.path === par)) pushWatch(c, id, w);
    }
  }
}

/* ------------------------------------------------------------- HTTP util */
const buckets = new Map();
function limited(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.t > 60000) { b = { t: now, n: 0 }; buckets.set(ip, b); }
  return ++b.n > RATE_PER_MIN;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 120000) buckets.delete(k); }, 60000).unref();

const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function json(res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(code === 413 ? { Connection: 'close' } : null), ...extra });
  res.end(body);
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    req.on('data', ch => {
      size += ch.length;
      if (over) return;
      if (size > max) { over = true; chunks.length = 0; reject(Object.assign(new Error('too large'), { status: 413 })); return; }
      chunks.push(ch);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function accessOk(req) {
  return !ACCESS_KEY || safeEq(req.headers['x-access'] || '', ACCESS_KEY);
}
const isPlainObject = v => v && typeof v === 'object' && !Array.isArray(v);

/* ------------------------------------------------------------------- API */
async function api(req, res, url) {
  const ip = clientIp(req);
  if (limited(ip)) return json(res, 429, { error: 'rate_limited' });

  if (url.pathname === '/api/info') {
    return json(res, 200, { app: 'spieleblock', needAccess: !!ACCESS_KEY, ok: accessOk(req) });
  }
  if (!accessOk(req)) return json(res, 401, { error: 'unauthenticated' });

  if (url.pathname === '/api/me') {
    const key = String(req.headers['x-key'] || '');
    if (!KEY_RE.test(key)) return json(res, 400, { error: 'invalid_key' });
    return json(res, 200, { uid: pubId(key) });
  }

  if (url.pathname === '/api/stream' && req.method === 'GET') {
    const cid = url.searchParams.get('cid') || '';
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(cid)) return json(res, 400, { error: 'invalid_argument' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const old = clients.get(cid);
    if (old) { try { old.res.end(); } catch { /* */ } }
    const c = { res, watches: new Map() };
    clients.set(cid, c);
    send(c, { hello: true, t: Date.now() });
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* */ } }, 20000);
    req.on('close', () => { clearInterval(hb); if (clients.get(cid) === c) clients.delete(cid); });
    return;
  }

  if (url.pathname === '/api/watch' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch { return json(res, 400, { error: 'invalid_argument' }); }
    const c = clients.get(String(body.cid || ''));
    if (!c) return json(res, 404, { error: 'no_stream' });
    const list = Array.isArray(body.set) ? body.set.slice(0, 40) : null;
    if (!list) return json(res, 400, { error: 'invalid_argument' });
    const next = new Map();
    for (const w of list) {
      if (!w || typeof w.id !== 'string' || w.id.length > 40 || (w.kind !== 'doc' && w.kind !== 'col')) continue;
      const segs = parsePath(w.path);
      if (!pathOk(segs, w.kind) || !authorize(req, segs)) continue;
      next.set(w.id, { kind: w.kind, path: w.path });
    }
    const fresh = [];
    for (const [id, w] of next) {
      const o = c.watches.get(id);
      if (!o || o.path !== w.path || o.kind !== w.kind) fresh.push([id, w]);
    }
    c.watches = next;
    for (const [id, w] of fresh) pushWatch(c, id, w);
    return json(res, 200, { ok: true, n: next.size });
  }

  const kind = url.pathname === '/api/doc' ? 'doc' : url.pathname === '/api/col' ? 'col' : null;
  if (!kind) return json(res, 404, { error: 'not_found' });
  const p = url.searchParams.get('path');
  const segs = parsePath(p);
  if (!pathOk(segs, kind)) return json(res, 400, { error: 'invalid_argument' });
  if (!authorize(req, segs)) return json(res, 403, { error: 'permission_denied' });

  if (req.method === 'GET') {
    return json(res, 200, kind === 'doc' ? snapDoc(p) : { docs: snapCol(p) });
  }
  if (kind !== 'doc') return json(res, 405, { error: 'method_not_allowed' });

  if (req.method === 'PUT') {
    let raw;
    try { raw = await readBody(req, MAX_DOC_BYTES); } catch (e) { return json(res, e.status || 400, { error: e.status === 413 ? 'out_of_range' : 'invalid_argument' }); }
    let d;
    try { d = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid_argument' }); }
    if (!isPlainObject(d)) return json(res, 400, { error: 'invalid_argument' });
    if (!docs.has(p) && docs.size >= MAX_DOCS) return json(res, 507, { error: 'resource_exhausted' });
    const t = Date.now();
    applyPut(p, d, t);
    journal({ p, d, t });
    notify(p);
    return json(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    if (docs.has(p)) { applyDel(p); journal({ x: 1, p }); notify(p); }
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'method_not_allowed' });
}

/* ---------------------------------------------------------------- static */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const cache = new Map(); // abs path -> {mtime, raw, gz, etag}
function staticFile(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.resolve(PUBLIC_DIR, '.' + rel);
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  let st;
  try { st = fs.statSync(abs); if (!st.isFile()) throw 0; } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
  let e = cache.get(abs);
  if (!e || e.mtime !== st.mtimeMs) {
    const raw = fs.readFileSync(abs);
    const ext = path.extname(abs).toLowerCase();
    const comp = ['.html', '.js', '.css', '.json', '.svg', '.webmanifest'].includes(ext);
    e = { mtime: st.mtimeMs, raw, gz: comp ? zlib.gzipSync(raw, { level: 9 }) : null, etag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"', ext };
    cache.set(abs, e);
  }
  const headers = {
    'Content-Type': MIME[e.ext] || 'application/octet-stream',
    ETag: e.etag,
    'Cache-Control': e.ext === '.woff2' || e.ext === '.png' ? 'public, max-age=604800' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (req.headers['if-none-match'] === e.etag) { res.writeHead(304, headers); return res.end(); }
  const useGz = e.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (e.gz) headers.Vary = 'Accept-Encoding';
  if (useGz) headers['Content-Encoding'] = 'gzip';
  const body = useGz ? e.gz : e.raw;
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ---------------------------------------------------------------- server */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return staticFile(req, res, url);
  } catch (e) {
    console.error('Fehler:', e && e.stack || e);
    if (!res.headersSent) json(res, 500, { error: 'internal' }); else try { res.end(); } catch { /* */ }
  }
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;
server.requestTimeout = 0; // SSE-Verbindungen sind lang

function shutdown(sig) {
  log(`${sig}: speichere und beende`);
  try { writeSnapshot(); } catch (e) { console.error(e); }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  log(`Spieleblock läuft auf http://${HOST}:${PORT}  (Daten: ${DATA_DIR}${ACCESS_KEY ? ', Zugangscode aktiv' : ''})`);
});
