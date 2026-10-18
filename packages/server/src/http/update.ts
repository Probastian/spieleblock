import fs from 'node:fs';
import path from 'node:path';
import type { UpdateResponse, UpdateStatus } from '@spieleblock/shared';
import type { Config } from '../config';

export const REQUEST_FILE = 'update-request';
export const STATUS_FILE = 'update-status.json';
/** Mindestabstand zwischen zwei Anforderungen. Das Update-Skript braucht ohnehin einige Sekunden. */
export const REQUEST_COOLDOWN_MS = 10_000;

const VERSION_RE = /^[A-Za-z0-9._-]{0,32}$/;

/** Liest `update-status.json` und gibt nur Werte zurück, die der Server auch selbst für gültig hält. */
export function parseStatus(text: string): UpdateStatus | null {
  try {
    const s = JSON.parse(text) as Partial<Record<keyof UpdateStatus, unknown>>;
    const state = s.state;
    if (state !== 'current' && state !== 'updated' && state !== 'failed') return null;
    const checkedAt = Number(s.checkedAt);
    if (!Number.isFinite(checkedAt) || checkedAt <= 0) return null;
    const current = String(s.current ?? '');
    const latest = String(s.latest ?? '');
    if (!VERSION_RE.test(current) || !VERSION_RE.test(latest)) return null;
    return { checkedAt, state, current, latest };
  } catch {
    return null;
  }
}

/**
 * Die Schnittstelle zum Update-Skript. Der Server läuft ohne Rechte und kann sich nicht selbst aktualisieren;
 * er legt nur eine Datei an, auf die eine systemd-Path-Unit reagiert, und liest, was das Skript hinterlassen hat.
 */
export function createUpdateControl(config: Pick<Config, 'dataDir' | 'updateFromUi'>, now: () => number = Date.now) {
  const requestPath = path.join(config.dataDir, REQUEST_FILE);
  const statusPath = path.join(config.dataDir, STATUS_FILE);
  let lastRequest = 0;

  return {
    enabled: config.updateFromUi,

    status(): UpdateResponse {
      let status: UpdateStatus | null = null;
      if (config.updateFromUi) {
        try {
          status = parseStatus(fs.readFileSync(statusPath, 'utf8'));
        } catch {
          /* noch keine Prüfung gelaufen */
        }
      }
      return { enabled: config.updateFromUi, status, now: now() };
    },

    /** Fordert eine Prüfung an. `false`, wenn gerade erst eine angefordert wurde. */
    request(): boolean {
      const t = now();
      if (t - lastRequest < REQUEST_COOLDOWN_MS) return false;
      lastRequest = t;
      fs.writeFileSync(requestPath, String(t));
      return true;
    },
  };
}
