import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest']);
/** Angular hängt einen Hash an Dateinamen: main-ABCD1234.js. Solche Dateien ändern sich nie. */
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/;

interface CacheEntry {
  mtime: number;
  raw: Buffer;
  gz: Buffer | null;
  etag: string;
  ext: string;
}

/**
 * Liefert die gebaute Web-App aus. Unbekannte Pfade ohne Dateiendung gehen an index.html,
 * damit die Adressen der App (/spiel/…, /spieler) auch beim Neuladen funktionieren.
 */
export function createStaticHandler(publicDir: string) {
  const root = path.resolve(publicDir);
  const cache = new Map<string, CacheEntry>();

  const notFound = (res: ServerResponse) => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  };

  function resolveFile(pathname: string): { abs: string; stat: fs.Stats } | null {
    let rel: string;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const abs = path.resolve(root, '.' + rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;
    try {
      const stat = fs.statSync(abs);
      if (stat.isFile()) return { abs, stat };
    } catch {
      /* fällt unten auf index.html zurück */
    }
    if (path.extname(rel)) return null;
    const index = path.join(root, 'index.html');
    try {
      return { abs: index, stat: fs.statSync(index) };
    } catch {
      return null;
    }
  }

  function load(abs: string, stat: fs.Stats): CacheEntry {
    let e = cache.get(abs);
    if (!e || e.mtime !== stat.mtimeMs) {
      const raw = fs.readFileSync(abs);
      const ext = path.extname(abs).toLowerCase();
      e = {
        mtime: stat.mtimeMs,
        raw,
        gz: COMPRESSIBLE.has(ext) ? zlib.gzipSync(raw, { level: 9 }) : null,
        etag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"',
        ext,
      };
      cache.set(abs, e);
    }
    return e;
  }

  return function serve(req: IncomingMessage, res: ServerResponse, url: URL): void {
    const file = resolveFile(url.pathname);
    if (!file) return notFound(res);
    const e = load(file.abs, file.stat);

    const immutable = HASHED.test(file.abs) || e.ext === '.woff2' || e.ext === '.png';
    const headers: Record<string, string | number> = {
      'Content-Type': MIME[e.ext] ?? 'application/octet-stream',
      ETag: e.etag,
      'Cache-Control': immutable ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    if (req.headers['if-none-match'] === e.etag) {
      res.writeHead(304, headers);
      return void res.end();
    }
    const useGzip = !!e.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (e.gz) headers['Vary'] = 'Accept-Encoding';
    if (useGzip) headers['Content-Encoding'] = 'gzip';
    const body = useGzip ? e.gz! : e.raw;
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  };
}
