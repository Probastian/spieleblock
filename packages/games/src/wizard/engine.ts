import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rank } from '../core/rank';
import { clampInt } from '../core/util';
import * as W from './game';
import type { WizardGame, WizardOptions } from './game';

const DEFAULTS: WizardOptions = { len: 'full' };

export const wizardEngine: GameEngine<WizardGame, WizardOptions> = {
  id: 'wizard',
  higherIsBetter: true,
  minPlayers: 3,
  maxPlayers: 6,
  includeInTrend: true,
  defaultOptions: DEFAULTS,
  localKeys: [],

  normalizeOptions: raw => ({ len: (raw as Partial<WizardOptions> | null)?.len === 'short' ? 'short' : 'full' }),
  create: (players, options) => W.create(players, options),

  rematch(g, nameOf) {
    const ps = g.players.map(p => ({ pid: p.pid, name: nameOf(p), color: p.color }));
    return W.create([...ps.slice(1), ps[0]!], { len: g.len });
  },

  result(g) {
    const cum = W.cumulative(g);
    const done = cum[0]!.length - 1;
    return rank(
      g.players.map((p, i) => {
        const hits = g.rounds.filter(r => r.t && r.b[i] === r.t[i]).length;
        return { i, pid: p.pid, name: p.name, color: p.color, total: cum[i]![done]!, sub: done ? `${hits} von ${done} Ansagen richtig` : 'Noch keine Runde' };
      }),
      true,
    );
  },

  label: g => (g.len === 'short' ? 'Wizard kurz' : 'Wizard'),
  statsKey: g => 'wizard:' + g.players.length + (g.len === 'short' ? 'k' : ''),
  trendLabel: g => `${g.len === 'short' ? 'Wizard kurz' : 'Wizard'} · ${g.players.length} Spieler`,
  progress(g) {
    const total = W.totalRounds(g);
    return W.roundsDone(g) >= total ? 'Alle Runden gespielt' : `Runde ${Math.min(total, W.state(g).k)} von ${total}`;
  },
  isEmpty: g => !g.rounds.length,
  cannotFinish: g => (W.roundsDone(g) > 0 ? null : 'Schließe zuerst eine Runde ab'),
  finishWarning: g => (W.roundsDone(g) < W.totalRounds(g) ? 'Nochmal tippen: das Spiel ist noch nicht zu Ende' : ''),
  endNote: g => (W.roundsDone(g) < W.totalRounds(g) ? `Vorzeitig ausgewertet nach ${W.roundsDone(g)} von ${W.totalRounds(g)} Runden.` : ''),

  describeUndo(g) {
    const last = g.undo[g.undo.length - 1];
    if (!last) return null;
    if (last.k === 'add') return 'Letzte Ansagen entfernen';
    return last.k === 'edit' ? `Änderung an Runde ${last.idx + 1} zurücknehmen` : `Runde ${last.idx + 1} wiederherstellen`;
  },

  undo(g) {
    const u = g.undo.pop();
    if (!u) return null;
    if (u.k === 'add') g.rounds.pop();
    else if (u.k === 'edit') g.rounds[u.idx] = u.prev;
    else g.rounds.splice(u.idx, 0, u.prev);
    reopenGame(g);
    return {};
  },

  sanitize(out, raw) {
    const g = raw as Record<string, any>;
    out.len = g['len'] === 'short' ? 'short' : 'full';
    const total = W.totalRounds(out);
    const limit = (v: unknown, k: number) => clampInt(v, 0, k);
    out.rounds = (Array.isArray(g['rounds']) ? g['rounds'] : []).slice(0, total).map((r: any, k: number) => {
      r = r ?? {};
      const b = out.players.map((_, i) => limit(Array.isArray(r.b) ? r.b[i] : 0, k + 1));
      const t = Array.isArray(r.t) ? out.players.map((_, i) => limit(r.t[i], k + 1)) : null;
      return { b, t };
    });
    // Nur die letzte Runde darf noch offen sein
    const cut = out.rounds.findIndex((r, k) => !r.t && k < out.rounds.length - 1);
    if (cut >= 0) out.rounds = out.rounds.slice(0, cut + 1);
  },
};
