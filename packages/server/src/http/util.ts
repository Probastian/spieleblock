import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ErrorCode } from '@spieleblock/shared';

export function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(status === 413 ? { Connection: 'close' } : null),
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

export const sendError = (res: ServerResponse, status: number, error: ErrorCode): void => sendJson(res, status, { error });

export class BodyTooLarge extends Error {
  readonly status = 413;
}

export function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let over = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (over) return;
      if (size > maxBytes) {
        over = true;
        chunks.length = 0;
        reject(new BodyTooLarge('too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Hinter einem Proxy steht die echte Adresse im ersten Eintrag von X-Forwarded-For. */
export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = String((Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket.remoteAddress || '');
  return raw.split(',')[0]!.trim();
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
