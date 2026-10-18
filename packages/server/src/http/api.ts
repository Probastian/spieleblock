import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ENDPOINTS,
  MAX_WATCHES,
  isAllowedPath,
  isDeviceKey,
  parsePath,
  type CollectionResponse,
  type DocResponse,
  type InfoResponse,
  type MeResponse,
  type PathKind,
  type WatchRequest,
  type WatchSpec,
} from '@spieleblock/shared';
import { Auth, deviceKeyOf, publicId } from '../auth';
import type { Config } from '../config';
import type { RateLimiter } from '../rate-limit';
import type { DocumentStore } from '../store/document-store';
import type { StreamHub } from './stream-hub';
import { BodyTooLarge, clientIp, isPlainObject, readBody, sendError, sendJson } from './util';

export interface ApiDeps {
  config: Config;
  store: DocumentStore;
  hub: StreamHub;
  auth: Auth;
  limiter: RateLimiter;
}

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const WATCH_ID_MAX = 40;
const WATCH_BODY_MAX = 64 * 1024;

/** Der Handler für alle Pfade unter /api. */
export function createApiHandler(deps: ApiDeps) {
  const { config, store, hub, auth, limiter } = deps;

  const docResponse = (p: string): DocResponse => {
    const data = store.get(p);
    return { exists: data !== null, data };
  };
  const colResponse = (p: string): CollectionResponse => ({ docs: store.children(p) });

  async function handleWatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: Partial<WatchRequest>;
    try {
      body = JSON.parse(await readBody(req, WATCH_BODY_MAX));
    } catch {
      return sendError(res, 400, 'invalid_argument');
    }
    const cid = String(body.cid ?? '');
    if (!hub.has(cid)) return sendError(res, 404, 'no_stream');
    if (!Array.isArray(body.set)) return sendError(res, 400, 'invalid_argument');

    const next = new Map<string, WatchSpec>();
    for (const w of body.set.slice(0, MAX_WATCHES)) {
      if (!w || typeof w.id !== 'string' || w.id.length > WATCH_ID_MAX || (w.kind !== 'doc' && w.kind !== 'col')) continue;
      const segments = parsePath(w.path);
      if (!isAllowedPath(segments, w.kind) || !auth.canUsePath(req, segments)) continue;
      next.set(w.id, { id: w.id, kind: w.kind, path: w.path });
    }
    hub.setWatches(cid, next);
    sendJson(res, 200, { ok: true, n: next.size });
  }

  async function handleDocument(req: IncomingMessage, res: ServerResponse, url: URL, kind: PathKind): Promise<void> {
    const p = url.searchParams.get('path');
    const segments = parsePath(p);
    if (!isAllowedPath(segments, kind)) return sendError(res, 400, 'invalid_argument');
    if (!auth.canUsePath(req, segments)) return sendError(res, 403, 'permission_denied');

    if (req.method === 'GET') return sendJson(res, 200, kind === 'doc' ? docResponse(p!) : colResponse(p!));
    if (kind !== 'doc') return sendError(res, 405, 'method_not_allowed');

    if (req.method === 'PUT') {
      let doc: unknown;
      try {
        doc = JSON.parse(await readBody(req, config.maxDocBytes));
      } catch (e) {
        return e instanceof BodyTooLarge ? sendError(res, 413, 'out_of_range') : sendError(res, 400, 'invalid_argument');
      }
      if (!isPlainObject(doc)) return sendError(res, 400, 'invalid_argument');
      if (!store.put(p!, doc)) return sendError(res, 507, 'resource_exhausted');
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      store.delete(p!);
      return sendJson(res, 200, { ok: true });
    }
    return sendError(res, 405, 'method_not_allowed');
  }

  return async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (limiter.isLimited(clientIp(req))) return sendError(res, 429, 'rate_limited');

    const route = url.pathname;
    if (route === ENDPOINTS.info) {
      const info: InfoResponse = { app: 'spieleblock', needAccess: auth.needsAccessCode, ok: auth.accessOk(req), version: config.version };
      return sendJson(res, 200, info);
    }
    if (!auth.accessOk(req)) return sendError(res, 401, 'unauthenticated');

    if (route === ENDPOINTS.me) {
      const key = deviceKeyOf(req);
      if (!isDeviceKey(key)) return sendError(res, 400, 'invalid_key');
      const me: MeResponse = { uid: publicId(key) };
      return sendJson(res, 200, me);
    }

    if (route === ENDPOINTS.stream && req.method === 'GET') {
      const cid = url.searchParams.get('cid') ?? '';
      if (!CLIENT_ID_RE.test(cid)) return sendError(res, 400, 'invalid_argument');
      return hub.connect(cid, req, res);
    }
    if (route === ENDPOINTS.watch && req.method === 'POST') return handleWatch(req, res);

    if (route === ENDPOINTS.doc) return handleDocument(req, res, url, 'doc');
    if (route === ENDPOINTS.col) return handleDocument(req, res, url, 'col');
    return sendError(res, 404, 'not_found');
  };
}
