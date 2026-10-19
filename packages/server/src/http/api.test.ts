import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateDeviceKey, HEADERS, userMetaPath } from '@spieleblock/shared';
import { publicId } from '../auth';
import { startTestServer, type TestServer } from '../test-support';

let srv: TestServer;
const key = generateDeviceKey();
const uid = publicId(key);
const asUser = { [HEADERS.deviceKey]: key };

const call = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) => fetch(srv.url + path, init);
const put = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(`/api/doc?path=${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify(body), headers });

beforeEach(async () => {
  srv = await startTestServer();
});
afterEach(() => srv.close());

describe('API', () => {
  it('meldet sich und leitet die Nutzer-ID aus der Gerätekennung ab', async () => {
    expect(await (await call('/healthz')).text()).toBe('ok');
    expect(await (await call('/api/info')).json()).toEqual({ app: 'spieleblock', needAccess: false, ok: true, version: 'v1.2.3', spotifyClientId: '', tmdb: false });
    expect(await (await call('/api/me', { headers: asUser })).json()).toEqual({ uid });
    expect((await call('/api/me', { headers: { [HEADERS.deviceKey]: 'kaputt' } })).status).toBe(400);
  });

  it('speichert Nutzerdaten nur mit der richtigen Kennung', async () => {
    const path = userMetaPath(uid);
    expect((await put(path, { players: [] })).status).toBe(403);
    expect((await put(path, { players: [] }, { [HEADERS.deviceKey]: generateDeviceKey() })).status).toBe(403);
    expect((await put(path, { players: ['x'] }, asUser)).status).toBe(200);

    const got = await call(`/api/doc?path=${encodeURIComponent(path)}`, { headers: asUser });
    expect(await got.json()).toEqual({ exists: true, data: { players: ['x'] } });
    const col = await call(`/api/col?path=${encodeURIComponent(path + '/games')}`, { headers: asUser });
    expect(await col.json()).toEqual({ docs: [] });
  });

  it('lässt Tische für alle offen, prüft aber Pfade und Größe', async () => {
    expect((await put('tables/ABCDE', { game: 1 })).status).toBe(200);
    expect(await (await call('/api/doc?path=tables/ABCDE')).json()).toEqual({ exists: true, data: { game: 1 } });
    expect((await put('geheim/alles', {})).status).toBe(400);
    expect((await put('tables/ABCDE/seats', {})).status).toBe(400); // Sammlung ist kein Dokument
    expect((await put('tables/ABCDE', [1, 2])).status).toBe(400);
    expect((await put('tables/ABCDE', { big: 'x'.repeat(5000) })).status).toBe(413);
    expect((await call('/api/doc?path=tables/ABCDE', { method: 'DELETE' })).status).toBe(200);
    expect(await (await call('/api/doc?path=tables/ABCDE')).json()).toEqual({ exists: false, data: null });
  });

  it('verlangt den Zugangscode, wenn einer eingerichtet ist', async () => {
    await srv.close();
    srv = await startTestServer({ accessKey: 'sesam' });
    expect(await (await call('/api/info')).json()).toMatchObject({ needAccess: true, ok: false });
    expect((await call('/api/doc?path=tables/ABCDE')).status).toBe(401);
    const headers = { [HEADERS.access]: 'sesam' };
    expect(await (await call('/api/info', { headers })).json()).toMatchObject({ ok: true });
    expect((await call('/api/doc?path=tables/ABCDE', { headers })).status).toBe(200);
  });

  it('begrenzt Anfragen pro Minute', async () => {
    await srv.close();
    srv = await startTestServer({ ratePerMin: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await call('/api/info')).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });
});

describe('Live-Verbindung', () => {
  async function connect(cid: string) {
    const res = await call(`/api/stream?cid=${cid}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const next = async (): Promise<any> => {
      for (;;) {
        const i = buffer.indexOf('\n\n');
        if (i >= 0) {
          const chunk = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const line = chunk.split('\n').find(l => l.startsWith('data: '));
          if (line) return JSON.parse(line.slice(6));
          continue;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error('Stream zu Ende');
        buffer += decoder.decode(value, { stream: true });
      }
    };
    return { next, close: () => reader.cancel() };
  }
  const watch = (cid: string, set: unknown[]) =>
    call('/api/watch', { method: 'POST', body: JSON.stringify({ cid, set }), headers: { 'Content-Type': 'application/json' } });

  it('schickt den Stand beim Abonnieren und danach jede Änderung', async () => {
    const stream = await connect('client-1234');
    expect((await stream.next()).hello).toBe(true);
    await put('tables/LIVEA', { n: 1 });
    expect((await watch('client-1234', [{ id: 'w1', kind: 'doc', path: 'tables/LIVEA' }, { id: 'w2', kind: 'col', path: 'tables/LIVEA/seats' }])).status).toBe(200);
    expect(await stream.next()).toEqual({ id: 'w1', exists: true, data: { n: 1 } });
    expect(await stream.next()).toEqual({ id: 'w2', docs: [] });

    await put('tables/LIVEA', { n: 2 });
    expect(await stream.next()).toEqual({ id: 'w1', exists: true, data: { n: 2 } });
    await put('tables/LIVEA/seats/3', { uid: 'u' });
    expect(await stream.next()).toEqual({ id: 'w2', docs: [{ id: '3', data: { uid: 'u' } }] });
    await stream.close();
  });

  it('ignoriert Abos auf fremde Nutzerdaten', async () => {
    const stream = await connect('client-5678');
    await stream.next();
    const res = await watch('client-5678', [{ id: 'w1', kind: 'doc', path: userMetaPath(uid) }]);
    expect(await res.json()).toEqual({ ok: true, n: 0 });
    expect((await watch('unbekannt-123', [])).status).toBe(404);
    await stream.close();
  });
});

describe('Statische Dateien', () => {
  it('liefert index.html auch für App-Adressen und cached gehashte Dateien lange', async () => {
    const index = await call('/spiel/abc');
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('<title>test</title>');
    expect(index.headers.get('cache-control')).toBe('no-cache');

    const js = await call('/main-ABCD1234.js');
    expect(js.headers.get('cache-control')).toContain('max-age=604800');
    expect(js.headers.get('content-type')).toContain('javascript');

    expect((await call('/gibt-es-nicht.js')).status).toBe(404);
    expect((await call('/..%2f..%2fetc/passwd')).status).not.toBe(200);
    const etag = js.headers.get('etag')!;
    expect((await call('/main-ABCD1234.js', { headers: { 'If-None-Match': etag } })).status).toBe(304);
  });
});
