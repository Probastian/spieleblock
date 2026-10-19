import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rotatePlayers, snapLabel } from '../core/party';
import { rank } from '../core/rank';
import { pluralize } from '../core/util';
import * as V from './game';
import type { WavelengthGame, WavelengthOptions } from './game';

export const wavelengthEngine: GameEngine<WavelengthGame, WavelengthOptions> = {
  id: 'wavelength',
  higherIsBetter: true,
  minPlayers: 2,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: V.DEFAULT_RULES,
  localKeys: [],

  normalizeOptions: raw => V.normalizeRules(raw),
  create: (players, options) => V.create(players, options),
  rematch: (g, nameOf) => V.create(rotatePlayers(g.players.map(p => ({ ...p, name: nameOf(p) }))), g.rules),

  result(g) {
    return rank(
      g.players.map((p, i) => ({ i, pid: p.pid, name: p.name, color: p.color, total: p.points, sub: pluralize(g.history.filter(h => h.giver === i).length, 'Hinweis', 'Hinweise') })),
      true,
    );
  },

  label: () => 'Wavelength',
  statsKey: g => `wavelength-${g.rules.team ? 'team' : 'solo'}-${g.rules.laps}-${g.players.length}`,
  trendLabel: () => 'Wavelength',

  progress(g) {
    if (!g.current) return 'Noch nicht gestartet';
    const total = V.roundsTotal(g);
    return `Runde ${g.current.n}${total ? ' von ' + total : ''}`;
  },

  isEmpty: g => !g.history.length && (!g.current || g.current.phase === 'clue'),
  cannotFinish: g => (g.history.length ? null : 'Spielt zuerst eine Runde zu Ende'),
  finishWarning: g => (V.allPlayed(g) ? '' : 'Es sind noch nicht alle Runden gespielt.'),
  endNote: () => '',

  describeUndo: g => snapLabel(g),
  undo(g) {
    if (!V.undo(g)) return null;
    reopenGame(g);
    return {};
  },

  sanitize: V.sanitize,
};
