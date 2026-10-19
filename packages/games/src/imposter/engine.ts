import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rotatePlayers, snapLabel } from '../core/party';
import { rank } from '../core/rank';
import { pluralize } from '../core/util';
import * as I from './game';
import type { ImposterGame, ImposterOptions } from './game';

export const imposterEngine: GameEngine<ImposterGame, ImposterOptions> = {
  id: 'imposter',
  higherIsBetter: true,
  minPlayers: 3,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: I.DEFAULT_RULES,
  localKeys: [],

  normalizeOptions: raw => I.normalizeRules(raw),
  create: (players, options) => I.create(players, options),
  rematch: (g, nameOf) => I.create(rotatePlayers(g.players.map(p => ({ ...p, name: nameOf(p) }))), g.rules),

  result(g) {
    return rank(
      g.players.map((p, i) => {
        const times = g.history.filter(h => h.imposters.includes(i)).length;
        return { i, pid: p.pid, name: p.name, color: p.color, total: p.points, sub: `${pluralize(times, 'Mal', 'Mal')} Imposter` };
      }),
      true,
    );
  },

  label: () => 'Imposter',
  statsKey: g => `imposter-${g.rules.rounds}`,
  trendLabel: () => 'Imposter',

  progress(g) {
    if (!g.history.length && (!g.current || g.current.phase !== 'result')) return g.current ? `Runde ${g.current.n}` : 'Noch nicht gestartet';
    const total = g.rules.rounds ? ` von ${g.rules.rounds}` : '';
    return `Runde ${g.current?.n ?? g.history.length}${total}`;
  },

  isEmpty: g => !g.history.length && (!g.current || g.current.phase === 'reveal'),
  cannotFinish: g => (g.history.length ? null : 'Spielt zuerst eine Runde zu Ende'),
  finishWarning: g => (I.allPlayed(g) ? '' : 'Es sind noch nicht alle Runden gespielt.'),
  endNote: () => '',

  describeUndo: g => snapLabel(g),
  undo(g) {
    if (!I.undo(g)) return null;
    reopenGame(g);
    return {};
  },

  sanitize: I.sanitize,
};
