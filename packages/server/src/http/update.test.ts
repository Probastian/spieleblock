import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HEADERS, generateDeviceKey, type UpdateResponse } from '@spieleblock/shared';
import { startTestServer, type TestServer } from '../test-support';
import { REQUEST_COOLDOWN_MS, REQUEST_FILE, STATUS_FILE, createUpdateControl, parseStatus } from './update';

let srv: TestServer | undefined;
afterEach(async () => {
  await srv?.close();
  srv = undefined;
});

const status = (over: Record<string, unknown> = {}) => JSON.stringify({ checkedAt: 1_700_000_000_000, state: 'current', current: 'v2.2.0', latest: 'v2.2.0', ...over });

describe('Status lesen', () => {
  it('akzeptiert, was update.sh schreibt', () => {
    expect(parseStatus(status())).toEqual({ checkedAt: 1_700_000_000_000, state: 'current', current: 'v2.2.0', latest: 'v2.2.0' });
    expect(parseStatus(status({ state: 'failed', latest: '' }))).toMatchObject({ state: 'failed', latest: '' });
    expect(parseStatus(status({ state: 'updated' }))?.state).toBe('updated');
  });

  it('verwirft alles Ungültige', () => {
    expect(parseStatus('kein json')).toBeNull();
    expect(parseStatus('')).toBeNull();
    expect(parseStatus(status({ state: 'boom' }))).toBeNull();
    expect(parseStatus(status({ checkedAt: 'gestern' }))).toBeNull();
    expect(parseStatus(status({ checkedAt: 0 }))).toBeNull();
    expect(parseStatus(status({ current: '<script>alert(1)</script>' }))).toBeNull();
    expect(parseStatus(status({ latest: 'v'.repeat(40) }))).toBeNull();
  });
});

describe('Anforderung', () => {
  const dir = () => fs.mkdtempSync(path.join(fs.realpathSync(process.env['TMPDIR'] ?? '/tmp'), 'upd-'));

  it('legt die Datei an und hält den Mindestabstand ein', () => {
    const dataDir = dir();
    let t = 1_000_000;
    const control = createUpdateControl({ dataDir, updateFromUi: true }, () => t);
    expect(control.request()).toBe(true);
    expect(fs.readFileSync(path.join(dataDir, REQUEST_FILE), 'utf8')).toBe('1000000');
    fs.rmSync(path.join(dataDir, REQUEST_FILE)); // das Skript hat sie abgeholt
    t += REQUEST_COOLDOWN_MS - 1;
    expect(control.request()).toBe(false);
    expect(fs.existsSync(path.join(dataDir, REQUEST_FILE))).toBe(false);
    t += 1;
    expect(control.request()).toBe(true);
  });

  it('liest den Status nur, wenn die Funktion eingeschaltet ist', () => {
    const dataDir = dir();
    fs.writeFileSync(path.join(dataDir, STATUS_FILE), status());
    expect(createUpdateControl({ dataDir, updateFromUi: false }).status()).toMatchObject({ enabled: false, status: null });
    expect(createUpdateControl({ dataDir, updateFromUi: true }).status()).toMatchObject({ enabled: true, status: { current: 'v2.2.0' } });
  });
});

describe('API /api/update', () => {
  const key = { [HEADERS.deviceKey]: generateDeviceKey() };

  it('ist ohne UPDATE_FROM_UI aus: Status leer, Anforderung abgelehnt, keine Datei', async () => {
    srv = await startTestServer();
    fs.writeFileSync(path.join(srv.dir, 'data', STATUS_FILE), status(), { flag: 'w' });
    const get = await (await fetch(srv.url + '/api/update', { headers: key })).json();
    expect(get).toMatchObject({ enabled: false, status: null });
    const post = await fetch(srv.url + '/api/update', { method: 'POST', headers: key });
    expect(post.status).toBe(404);
    expect(fs.existsSync(path.join(srv.dir, 'data', REQUEST_FILE))).toBe(false);
  });

  it('fordert an, zeigt den Status und bremst Wiederholungen', async () => {
    srv = await startTestServer({ updateFromUi: true });
    const data = path.join(srv.dir, 'data');
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, STATUS_FILE), status({ state: 'updated', current: 'v2.3.0', latest: 'v2.3.0' }));

    const first = await fetch(srv.url + '/api/update', { method: 'POST', headers: key });
    expect(first.status).toBe(200);
    const body = (await first.json()) as UpdateResponse;
    expect(body).toMatchObject({ enabled: true, status: { state: 'updated', current: 'v2.3.0' } });
    expect(body.now).toBeGreaterThan(1_700_000_000_000);
    expect(fs.existsSync(path.join(data, REQUEST_FILE))).toBe(true);

    expect((await fetch(srv.url + '/api/update', { method: 'POST', headers: key })).status).toBe(429);
    expect((await fetch(srv.url + '/api/update', { method: 'DELETE', headers: key })).status).toBe(405);
  });

  it('verlangt den Zugangscode, wenn einer gesetzt ist', async () => {
    srv = await startTestServer({ updateFromUi: true, accessKey: 'geheim' });
    expect((await fetch(srv.url + '/api/update')).status).toBe(401);
    expect((await fetch(srv.url + '/api/update', { method: 'POST' })).status).toBe(401);
    const ok = await fetch(srv.url + '/api/update', { headers: { [HEADERS.access]: 'geheim' } });
    expect(ok.status).toBe(200);
  });
});
