import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { HEADERS, isDeviceKey, ownerOf } from '@spieleblock/shared';

/** Die öffentliche Nutzer-ID ist ein Hash der Gerätekennung; die Kennung selbst bleibt geheim. */
export const publicId = (deviceKey: string): string => crypto.createHash('sha256').update('spieleblock:' + deviceKey).digest('hex').slice(0, 16);

const header = (req: IncomingMessage, name: string): string => {
  const v = req.headers[name.toLowerCase()];
  return String(Array.isArray(v) ? v[0] : (v ?? ''));
};

export const deviceKeyOf = (req: IncomingMessage): string => header(req, HEADERS.deviceKey);

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export class Auth {
  constructor(private readonly accessKey: string) {}

  get needsAccessCode(): boolean {
    return !!this.accessKey;
  }

  /** Stimmt der Zugangscode (oder ist keiner eingerichtet)? */
  accessOk(req: IncomingMessage): boolean {
    return !this.accessKey || safeEqual(header(req, HEADERS.access), this.accessKey);
  }

  /** Nutzerdaten sind nur mit der passenden Gerätekennung zugänglich; Tische sind offen für alle mit Zugang. */
  canUsePath(req: IncomingMessage, segments: string[]): boolean {
    const owner = ownerOf(segments);
    if (owner === null) return true;
    const key = deviceKeyOf(req);
    return isDeviceKey(key) && publicId(key) === owner;
  }
}
