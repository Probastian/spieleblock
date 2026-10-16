/* Spieleblock – Anbindung an den eigenen Server.
   Stellt window.claude.use('user'|'db'|'downloads') bereit, damit die App
   unverändert läuft. Alles läuft über die eigene Domain (kein Fremdserver). */
(function () {
  'use strict';
  var LS_KEY = 'sb.key', LS_PUB = 'sb.pub', LS_ACC = 'sb.access';
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } }
  function ldel(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }

  /* ---------- Gerätekennung (geheim) ---------- */
  function normKey(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function validKey(k) { return /^[A-Z2-9]{20}$/.test(k) && !/[IO]/.test(k); }
  function genKey() {
    var out = '', a = new Uint8Array(40);
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 20; i++) out += ALPHA[a[i] % ALPHA.length];
    return out;
  }
  var key = lget(LS_KEY);
  if (!key || !validKey(key)) { key = genKey(); lset(LS_KEY, key); }
  function pretty(k) { return k.match(/.{5}/g).join('-'); }

  window.__SB = {
    uid: function () { return pretty(key); },
    setUid: function (v) {
      var k = normKey(v);
      if (!validKey(k)) return false;
      if (k !== key) { lset(LS_KEY, k); ldel(LS_PUB); }
      setTimeout(function () { location.reload(); }, 150);
      return true;
    },
  };

  /* ---------- HTTP ---------- */
  var access = lget(LS_ACC) || '';
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  var needAccessUI = null;

  function headers(extra) {
    var h = { 'X-Key': key };
    if (access) h['X-Access'] = access;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function req(method, url, body, timeout) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 15000) : null;
    return fetch(url, {
      method: method,
      headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : null),
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined,
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (r.status === 401) { askAccess(); throw err('unauthenticated'); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw err(j.error || (r.status === 400 ? 'invalid_argument' : r.status === 403 ? 'permission_denied' : 'unavailable'));
        return j;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw err('unavailable', e && e.message);
    });
  }

  /* ---------- Zugangscode (nur wenn der Server einen verlangt) ---------- */
  function askAccess() {
    if (needAccessUI) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(30,25,15,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif';
    wrap.innerHTML = '<form style="background:#FFFDF6;color:#2B2A33;border-radius:14px;padding:22px;max-width:340px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.35)">' +
      '<div style="font-size:19px;font-weight:700;margin-bottom:6px">Zugangscode</div>' +
      '<div style="font-size:14px;color:#4B4958;margin-bottom:12px">Dieser Spieleblock ist geschützt. Den Code hat dir der Betreiber gegeben.</div>' +
      '<input type="password" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border:2px solid #B5AC95;border-radius:10px;background:#fff;color:#2B2A33" aria-label="Zugangscode">' +
      '<div class="e" style="color:#C0392B;font-size:13px;min-height:18px;margin-top:6px"></div>' +
      '<button type="submit" style="width:100%;font-size:17px;padding:12px;border:0;border-radius:10px;background:#D6453D;color:#fff;font-weight:700">Weiter</button></form>';
    document.body.appendChild(wrap);
    needAccessUI = wrap;
    var f = wrap.querySelector('form'), inp = wrap.querySelector('input');
    inp.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim();
      fetch('/api/info', { headers: { 'X-Access': v }, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.ok) { lset(LS_ACC, v); location.reload(); } else { wrap.querySelector('.e').textContent = 'Der Code stimmt nicht.'; }
      }).catch(function () { wrap.querySelector('.e').textContent = 'Server nicht erreichbar.'; });
    });
  }

  /* ---------- Snapshots ---------- */
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function DocSnap(id, exists, data) { this.id = id; this.exists = !!exists; this._d = data; }
  DocSnap.prototype.data = function () { return this.exists ? clone(this._d) : undefined; };
  function QuerySnap(docs) { this.docs = docs; this.size = docs.length; this.empty = !docs.length; }
  QuerySnap.prototype.forEach = function (fn) { this.docs.forEach(fn); };

  /* ---------- Live-Verbindung (SSE per fetch, Header möglich) ---------- */
  var cid = (function () { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ALPHA[b % ALPHA.length]; }).join('') + 'xyz'; })();
  var watches = {}; // id -> {kind, path, cb, eb}
  var wseq = 0, streaming = false, connected = false, backoff = 1000, lastByte = 0, ctl = null;

  function pushWatches() {
    if (!connected) return Promise.resolve();
    var list = Object.keys(watches).map(function (id) { return { id: id, kind: watches[id].kind, path: watches[id].path }; });
    return req('POST', '/api/watch', { cid: cid, set: list }).catch(function () { /* beim nächsten Verbindungsaufbau erneut */ });
  }
  function onMsg(m) {
    if (m.hello) { connected = true; backoff = 1000; pushWatches(); return; }
    var w = watches[m.id];
    if (!w) return;
    try {
      if (w.kind === 'doc') w.cb(new DocSnap(w.path.slice(w.path.lastIndexOf('/') + 1), m.exists, m.data));
      else w.cb(new QuerySnap((m.docs || []).map(function (d) { return new DocSnap(d.id, true, d.data); })));
    } catch (e) { if (window.console) console.error(e); }
  }
  function startStream() {
    if (streaming) return;
    streaming = true;
    var dec = new TextDecoder(), buf = '';
    ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    lastByte = Date.now();
    fetch('/api/stream?cid=' + cid, { headers: headers(), cache: 'no-store', signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (r.status === 401) { askAccess(); throw err('unauthenticated'); }
      if (!r.ok || !r.body) throw err('unavailable');
      var rd = r.body.getReader();
      function pump() {
        return rd.read().then(function (x) {
          if (x.done) throw err('closed');
          lastByte = Date.now();
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            var chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            chunk.split('\n').forEach(function (line) {
              if (line.indexOf('data: ') === 0) { try { onMsg(JSON.parse(line.slice(6))); } catch (e) { /* */ } }
            });
          }
          return pump();
        });
      }
      return pump();
    }).catch(function () { /* weiter unten */ }).then(function () {
      streaming = false; connected = false;
      if (!Object.keys(watches).length) return;
      setTimeout(startStream, backoff);
      backoff = Math.min(backoff * 2, 15000);
    });
  }
  // tote Verbindungen erkennen (Server sendet alle 20 s ein Lebenszeichen)
  setInterval(function () {
    if (streaming && Date.now() - lastByte > 50000 && ctl) { try { ctl.abort(); } catch (e) { /* */ } }
  }, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Object.keys(watches).length) {
      if (!streaming) { backoff = 1000; startStream(); }
      else if (Date.now() - lastByte > 30000 && ctl) { try { ctl.abort(); } catch (e) { /* */ } }
    }
  });
  window.addEventListener('online', function () {
    if (Object.keys(watches).length && !streaming) { backoff = 1000; startStream(); }
  });

  function subscribe(kind, path, cb, eb) {
    var id = 'w' + (++wseq);
    watches[id] = { kind: kind, path: path, cb: cb, eb: eb };
    if (connected) pushWatches(); else startStream();
    return function () { delete watches[id]; if (connected) pushWatches(); };
  }

  /* ---------- db ---------- */
  var q = encodeURIComponent;
  function DocRef(path) { this.path = path; this.id = path.slice(path.lastIndexOf('/') + 1); }
  DocRef.prototype.get = function () {
    var self = this;
    return req('GET', '/api/doc?path=' + q(this.path)).then(function (j) { return new DocSnap(self.id, j.exists, j.data); });
  };
  DocRef.prototype.set = function (data) { return req('PUT', '/api/doc?path=' + q(this.path), data).then(function () { }); };
  DocRef.prototype.delete = function () { return req('DELETE', '/api/doc?path=' + q(this.path)).then(function () { }); };
  DocRef.prototype.onSnapshot = function (cb, eb) { return subscribe('doc', this.path, cb, eb); };
  DocRef.prototype.collection = function (name) { return new ColRef(this.path + '/' + name); };
  function ColRef(path) { this.path = path; }
  ColRef.prototype.get = function () {
    return req('GET', '/api/col?path=' + q(this.path)).then(function (j) {
      return new QuerySnap((j.docs || []).map(function (d) { return new DocSnap(d.id, true, d.data); }));
    });
  };
  ColRef.prototype.onSnapshot = function (cb, eb) { return subscribe('col', this.path, cb, eb); };
  ColRef.prototype.doc = function (id) { return new DocRef(this.path + '/' + id); };

  var db = {
    doc: function (p) { return new DocRef(p); },
    collection: function (p) { return new ColRef(p); },
  };

  /* ---------- user ---------- */
  var pub = lget(LS_PUB);
  var pubP = null;
  function getPub() {
    if (pub) return Promise.resolve(pub);
    if (!pubP) pubP = req('GET', '/api/me').then(function (j) { pub = j.uid; lset(LS_PUB, pub); return pub; }).catch(function (e) { pubP = null; throw e; });
    return pubP;
  }
  var user = {
    id: function () { return getPub(); },
    me: function () { return getPub().then(function (id) { return { id: id }; }); },
    can: function () { return Promise.resolve(true); },
    isOwner: function () { return true; },
    canEdit: function () { return true; },
  };

  /* ---------- downloads (Backup-Datei) ---------- */
  var downloads = {
    save: function (o) {
      return new Promise(function (resolve, reject) {
        try {
          var blob = new Blob([o.data], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = o.filename || 'backup.json';
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          resolve();
        } catch (e) { reject(e); }
      });
    },
  };

  window.claude = {
    use: function (name) {
      if (name === 'db') return Promise.resolve(db);
      if (name === 'user') return Promise.resolve(user);
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.resolve(null);
    },
  };

  /* ---------- Offline-Start (nur mit https oder localhost) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
})();
