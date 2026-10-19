import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rotatePlayers, snapLabel } from '../core/party';
import { rank } from '../core/rank';
import { pluralize } from '../core/util';
import * as Hi from './game';
import type { HiloGame, HiloOptions } from './game';

export const hiloEngine: GameEngine<HiloGame, HiloOptions> = {
  id: 'hilo',
  higherIsBetter: true,
  minPlayers: 1,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: Hi.DEFAULT_RULES,
  localKeys: [],

  normalizeOptions: raw => Hi.normalizeRules(raw),
  create: (players, options) => Hi.create(players, options),
  rematch: (g, nameOf) => Hi.create(rotatePlayers(g.players.map(p => ({ ...p, name: nameOf(p) }))), g.rules),

  result(g) {
    return rank(
      g.players.map((p, i) => ({ i, pid: p.pid, name: p.name, color: p.color, total: p.score, sub: `Serie ${p.best} · ${pluralize(p.lives, 'Leben', 'Leben')} übrig` })),
      true,
    );
  },

  label: g => (g.cat ? `Mehr oder weniger: ${g.cat.name}` : 'Mehr oder weniger'),
  statsKey: g => `hilo-${g.cat?.id ?? ''}-${g.rules.lives}-${g.players.length > 1 ? 'multi' : 'solo'}`,
  trendLabel: () => 'Mehr oder weniger',

  progress(g) {
    if (!g.started) return 'Noch nicht gestartet';
    const top = [...g.players].sort((a, b) => b.score - a.score)[0]!;
    return `${g.cat?.name ?? ''} · ${top.name} führt mit ${top.score}`;
  },

  isEmpty: g => !g.started || (g.pos <= 1 && g.phase === 'guess' && !Object.keys(g.answers).length),
  cannotFinish: g => (g.started ? null : 'Das Spiel hat noch nicht begonnen'),
  finishWarning: g => (Hi.isOver(g) ? '' : 'Das Spiel ist noch nicht zu Ende.'),
  endNote: () => '',

  describeUndo: g => snapLabel(g),
  undo(g) {
    if (!Hi.undo(g)) return null;
    reopenGame(g);
    return {};
  },

  sanitize: Hi.sanitize,
};
