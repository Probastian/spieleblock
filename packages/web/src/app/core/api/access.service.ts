import { Injectable, signal } from '@angular/core';
import { ENDPOINTS, HEADERS, type InfoResponse } from '@spieleblock/shared';
import { readText, writeText } from '../util/storage';

const LS_ACCESS = 'sb.access';

/** Optionaler Zugangscode, den der Betreiber auf dem Server festlegen kann. */
@Injectable({ providedIn: 'root' })
export class AccessService {
  readonly code = readText(LS_ACCESS) ?? '';
  /** Der Server hat 401 gemeldet: die Abfrage wird gezeigt. */
  readonly required = signal(false);

  require(): void {
    this.required.set(true);
  }

  /** Prüft den Code beim Server; bei Erfolg wird er gemerkt und die App neu geladen. */
  async submit(value: string): Promise<'ok' | 'wrong' | 'unreachable'> {
    try {
      const res = await fetch(ENDPOINTS.info, { headers: { [HEADERS.access]: value }, cache: 'no-store' });
      const info = (await res.json()) as InfoResponse;
      if (!info.ok) return 'wrong';
      writeText(LS_ACCESS, value);
      location.reload();
      return 'ok';
    } catch {
      return 'unreachable';
    }
  }
}
