import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createApp, type App } from './app';
import type { Config } from './config';

export interface TestServer {
  app: App;
  url: string;
  dir: string;
  close(): Promise<void>;
}

export const silentLog = { info() {}, error() {} };

export function testConfig(dir: string, overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    host: '127.0.0.1',
    dataDir: path.join(dir, 'data'),
    publicDir: path.join(dir, 'public'),
    accessKey: '',
    tableTtlDays: 30,
    backupKeep: 14,
    maxDocs: 1000,
    maxDocBytes: 4096,
    ratePerMin: 10_000,
    log: false,
    version: 'v1.2.3',
    updateFromUi: false,
    spotifyClientId: '',
    ...overrides,
  };
}

/** Startet einen echten Server auf einem freien Port in einem frischen Ordner. */
export async function startTestServer(overrides: Partial<Config> = {}, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spieleblock-'))): Promise<TestServer> {
  fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'public', 'index.html'), '<!doctype html><title>test</title>');
  fs.writeFileSync(path.join(dir, 'public', 'main-ABCD1234.js'), 'console.log(1)');
  const app = createApp(testConfig(dir, overrides), silentLog);
  await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address() as AddressInfo;
  return {
    app,
    dir,
    url: `http://127.0.0.1:${port}`,
    async close() {
      app.server.closeAllConnections();
      await new Promise<void>(resolve => app.server.close(() => resolve()));
      app.shutdown();
    },
  };
}
