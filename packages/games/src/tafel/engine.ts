import type { GameEngine } from '../core/engine';
import { rank } from '../core/rank';
import { reopenGame } from '../core/lifecycle';
import { num, pluralize } from '../core/util';
import * as T from './game';
import { MAX_ROUNDS, type TafelGame, type TafelOptions } from './game';

const DEFAULTS: TafelOptions = { mode: 'high', target: 0 };

export const tafelEngine: GameEngine<TafelGame, TafelOptions> = {
  id: 'tafel',
  higherIsBetter: false,
  minPlayers: 1,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: DEFAULTS,
  localKeys: [],

  normalizeOptions(raw) {
    const o = (raw ?? {}) as Partial<TafelOptions>;
    return { mode: o.mode === 'low' ? 'low' : 'high', target: Math.max(0, num(o.target) | 0) };
  },
  create: (players, options) => T.create(players, options),

  rematch(g, nameOf) {
    const ps = g.players.map(p => ({ pid: p.pid, name: nameOf(p), color: p.color }));
    return T.create([...ps.slice(1), ps[0]!], { mode: g.mode, target: g.target });
  },

  result(g) {
    const totals = T.totals(g);
    const last = g.rounds[g.rounds.length - 1];
    const n = g.rounds.length;
    return rank(
      g.players.map((p, i) => ({ i, pid: p.pid, name: p.name, color: p.color, total: totals[i]!, last: last ? +last[i]! || 0 : null, sub: pluralize(n, 'Runde', 'Runden') })),
      g.mode !== 'low',
    );
  },

  label: () => 'Punktetafel',
  statsKey: () => 'tafel',
  trendLabel: () => 'Punktetafel',
  progress: g => (g.rounds.length ? pluralize(g.rounds.length, 'Runde', 'Runden') : 'Noch keine Runde'),
  isEmpty: g => !g.rounds.length,
  cannotFinish: g => (g.rounds.length > 0 ? null : 'Trag zuerst eine Runde ein'),
  finishWarning: () => '',
  endNote: () => '',

  describeUndo(g) {
    const last = g.undo[g.undo.length - 1];
    if (!last) return null;
    if (last.k === 'add') return 'Letzte Runde entfernen';
    return last.k === 'edit' ? `Änderung an Runde ${last.idx + 1} zurücknehmen` : `Runde ${last.idx + 1} wiederherstellen`;
  },

  undo(g) {
    const u = g.undo.pop();
    if (!u) return null;
    if (u.k === 'add') {
      g.rounds.pop();
      reopenGame(g);
    } else if (u.k === 'edit') g.rounds[u.idx] = u.prev;
    else g.rounds.splice(u.idx, 0, u.prev);
    return {};
  },

  sanitize(out, raw) {
    const g = raw as Record<string, any>;
    out.mode = g['mode'] === 'low' ? 'low' : 'high';
    out.target = Math.max(0, num(g['target']) | 0);
    out.rounds = (Array.isArray(g['rounds']) ? g['rounds'] : []).slice(0, MAX_ROUNDS).map((r: unknown) => out.players.map((_, i) => num(Array.isArray(r) ? r[i] : 0)));
  },
};
