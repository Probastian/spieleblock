import http from 'node:http';
import { ENDPOINTS } from '@spieleblock/shared';
import { Auth } from './auth';
import type { Config } from './config';
import { createApiHandler } from './http/api';
import { createStaticHandler } from './http/static';
import { StreamHub } from './http/stream-hub';
import { sendError } from './http/util';
import type { Logger } from './logger';
import { RateLimiter } from './rate-limit';
import { DocumentStore } from './store/document-store';

export interface App {
  server: http.Server;
  store: DocumentStore;
  hub: StreamHub;
  /** Speichert und räumt auf. Der Aufrufer schließt den Server. */
  shutdown(): void;
}

/** Setzt Speicher, Live-Verbindungen, API und statische Dateien zu einem HTTP-Server zusammen. */
export function createApp(config: Config, log: Logger): App {
  let hub!: StreamHub;
  const store = new DocumentStore({ ...config, log, onChange: p => hub.notify(p) });
  hub = new StreamHub(store);
  const limiter = new RateLimiter(config.ratePerMin);
  const handleApi = createApiHandler({ config, store, hub, auth: new Auth(config.accessKey), limiter });
  const serveStatic = createStaticHandler(config.publicDir);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      if (url.pathname === ENDPOINTS.health) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return void res.end('ok');
      }
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return void res.end();
      }
      return serveStatic(req, res, url);
    } catch (e) {
      log.error('Fehler:', (e as Error)?.stack ?? e);
      if (!res.headersSent) sendError(res, 500, 'internal');
      else
        try {
          res.end();
        } catch {
          /* Verbindung ist schon weg */
        }
    }
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 0; // Event-Streams sind lang

  const maintenance = setInterval(() => store.maintain(), 10 * 60 * 1000);
  const firstRun = setTimeout(() => store.maintain(), 5000);
  maintenance.unref();
  firstRun.unref();

  return {
    server,
    store,
    hub,
    shutdown() {
      clearInterval(maintenance);
      clearTimeout(firstRun);
      limiter.stop();
      store.close();
    },
  };
}
