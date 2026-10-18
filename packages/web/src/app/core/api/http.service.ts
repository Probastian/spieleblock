import { Injectable, inject } from '@angular/core';
import { HEADERS, type ErrorBody, type ErrorCode } from '@spieleblock/shared';
import { AccessService } from './access.service';
import { ApiError } from './api-error';
import { DeviceService } from './device.service';

const DEFAULT_TIMEOUT_MS = 15_000;

/** Dünne Schicht über `fetch`: Header, Zeitlimit, Fehlercodes. (Kein HttpClient, weil der Event-Stream Header braucht.) */
@Injectable({ providedIn: 'root' })
export class ApiHttp {
  private readonly device = inject(DeviceService);
  private readonly access = inject(AccessService);

  headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { [HEADERS.deviceKey]: this.device.key, ...extra };
    if (this.access.code) h[HEADERS.access] = this.access.code;
    return h;
  }

  async request<T>(method: string, url: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: this.headers(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: ctl.signal,
      });
    } catch (e) {
      throw new ApiError('unavailable', (e as Error)?.message);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) {
      this.access.require();
      throw new ApiError('unauthenticated');
    }
    const json = (await res.json().catch(() => ({}))) as Partial<ErrorBody> & T;
    if (!res.ok) throw new ApiError(json.error ?? fallbackCode(res.status));
    return json;
  }

  /** Öffnet den Event-Stream; der Aufrufer liest den Body. */
  async openStream(url: string, signal: AbortSignal): Promise<Response> {
    const res = await fetch(url, { headers: this.headers(), cache: 'no-store', signal });
    if (res.status === 401) {
      this.access.require();
      throw new ApiError('unauthenticated');
    }
    if (!res.ok || !res.body) throw new ApiError('unavailable');
    return res;
  }
}

function fallbackCode(status: number): ErrorCode {
  return status === 400 ? 'invalid_argument' : status === 403 ? 'permission_denied' : 'unavailable';
}
