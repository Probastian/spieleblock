import type { EngineLookup } from './engine';
import type { BaseGame } from './types';
import { clampInt, isId, num } from './util';

export const MAX_SEATS = 8;

/**
 * Macht aus einem beliebigen Dokument ein gültiges Spiel oder `null`.
 * Alles, was von außen kommt (Server, Backup, Live-Tisch), geht hier durch.
 */
export function sanitizeGame(raw: unknown, engineOf: EngineLookup): BaseGame | null {
  const g = raw as Record<string, any> | null;
  if (!g || typeof g !== 'object' || !isId(g['id'])) return null;
  const engine = engineOf(String(g['type']));
  if (!engine) return null;

  const legacy = !!g['legacy'];
  const players = (Array.isArray(g['players']) ? g['players'] : []).slice(0, MAX_SEATS).map((p: any) => {
    const seat: any = {
      pid: isId(p?.pid) ? p.pid : null,
      name: String(p?.name ?? '?').slice(0, 16),
      color: ((num(p?.color) | 0) % 8 + 8) % 8,
    };
    if (legacy) seat.total = num(p?.total);
    return seat;
  });
  if (!players.length) return null;

  const out: BaseGame = {
    id: g['id'],
    type: engine.id,
    status: g['status'] === 'finished' ? 'finished' : 'active',
    created: num(g['created']),
    u: num(g['u']),
    del: !!g['del'],
    legacy,
    undo: [],
    players,
    view: clampInt(g['view'], 0, players.length - 1),
    turn: clampInt(g['turn'], 0, players.length - 1),
  };
  if (g['finishedAt']) out.finishedAt = num(g['finishedAt']);
  engine.sanitize(out, g);
  return out;
}
