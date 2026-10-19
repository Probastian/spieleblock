import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rotatePlayers, snapLabel } from '../core/party';
import { rank } from '../core/rank';
import { pluralize } from '../core/util';
import * as W from './game';
import type { WhoamiGame, WhoamiOptions } from './game';

export const whoamiEngine: GameEngine<WhoamiGame, WhoamiOptions> = {
  id: 'whoami',
  higherIsBetter: true,
  minPlayers: 2,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: W.DEFAULT_RULES,
  localKeys: [],

  normalizeOptions: raw => W.normalizeRules(raw),
  create: (players, options) => W.create(players, options),
  rematch: (g, nameOf) => W.create(rotatePlayers(g.players.map(p => ({ ...p, name: nameOf(p) }))), g.rules),

  result(g) {
    const rounds = W.roundsPlayed(g);
    return rank(
      g.players.map((p, i) => ({ i, pid: p.pid, name: p.name, color: p.color, total: p.points, sub: pluralize(rounds, 'Runde', 'Runden') })),
      true,
    );
  },

  label: g => (g.rules.mode === 'forehead' ? 'Stirnraten' : 'Wer bin ich?'),
  statsKey: g => `whoami-${g.rules.mode}-${g.rules.rounds}-${g.rules.seconds}`,
  trendLabel: g => (g.rules.mode === 'forehead' ? 'Stirnraten' : 'Wer bin ich?'),

  progress(g) {
    if (g.rules.mode === 'forehead') return `Zug ${Math.min(g.huDone + 1, g.players.length * g.rules.rounds)} von ${g.players.length * g.rules.rounds}`;
    if (!g.figure) return 'Noch nicht gestartet';
    return `Runde ${g.figure.n}${g.rules.rounds ? ' von ' + g.rules.rounds : ''}`;
  },

  isEmpty: g => (g.rules.mode === 'forehead' ? !g.hu && !g.huDone : !g.history.length && !g.figure?.solved.length),
  cannotFinish: g => (g.history.length ? null : 'Spielt zuerst eine Runde zu Ende'),
  finishWarning: g => (W.allPlayed(g) ? '' : 'Es sind noch nicht alle Runden gespielt.'),
  endNote: () => '',

  describeUndo: g => snapLabel(g),
  undo(g) {
    if (!W.undo(g)) return null;
    reopenGame(g);
    return {};
  },

  sanitize: W.sanitize,
};
