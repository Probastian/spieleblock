import { Injectable, inject, signal } from '@angular/core';
import { ENDPOINTS, type InfoResponse, type UpdateResponse } from '@spieleblock/shared';
import { isApiError } from './api-error';
import { ApiHttp } from './http.service';
import { outcomeOf } from './update-result';

export type UpdatePhase = 'idle' | 'waiting' | 'current' | 'updated' | 'failed' | 'timeout' | 'busy' | 'disabled' | 'error';

const POLL_MS = 2000;
/** So lange warten wir auf das Ergebnis. Das Skript braucht meist wenige Sekunden. */
const WAIT_MS = 90_000;
/** So lange warten wir nach einer Installation auf den neu gestarteten Server. */
const RESTART_WAIT_MS = 40_000;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Update-Prüfung aus der Oberfläche. Der Server kann sich nicht selbst aktualisieren; er legt nur eine Anforderung ab,
 * das Update-Skript (systemd) prüft und installiert, und wir lesen das Ergebnis, sobald es da ist.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly http = inject(ApiHttp);

  readonly data = signal<UpdateResponse | null>(null);
  readonly phase = signal<UpdatePhase>('idle');

  async load(): Promise<void> {
    try {
      this.data.set(await this.http.request<UpdateResponse>('GET', ENDPOINTS.update));
    } catch {
      /* ohne Server gibt es nichts anzuzeigen */
    }
  }

  async check(): Promise<void> {
    if (this.phase() === 'waiting') return;
    this.phase.set('waiting');

    let requestedAt: number;
    try {
      const r = await this.http.request<UpdateResponse>('POST', ENDPOINTS.update);
      this.data.set(r);
      requestedAt = r.now;
    } catch (e) {
      this.phase.set(isApiError(e, 'rate_limited') ? 'busy' : isApiError(e, 'not_found') ? 'disabled' : 'error');
      return;
    }

    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      try {
        const r = await this.http.request<UpdateResponse>('GET', ENDPOINTS.update);
        const outcome = outcomeOf(r, requestedAt);
        if (outcome) {
          this.data.set(r);
          this.phase.set(outcome);
          if (outcome === 'updated') void this.reloadWhenNew(r.status!.current);
          return;
        }
      } catch {
        /* der Server startet gerade neu: weiter warten */
      }
    }
    this.phase.set('timeout');
  }

  /** Nach einer Installation neu laden, sobald der Server in der neuen Version antwortet. Offene Spiele bleiben erhalten (sie liegen im Browser-Speicher). */
  private async reloadWhenNew(version: string): Promise<void> {
    const deadline = Date.now() + RESTART_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(1500);
      try {
        const info = (await (await fetch(ENDPOINTS.info, { cache: 'no-store' })).json()) as Partial<InfoResponse>;
        if (info.version === version) {
          await sleep(600);
          location.reload();
          return;
        }
      } catch {
        /* noch nicht wieder da */
      }
    }
  }
}
