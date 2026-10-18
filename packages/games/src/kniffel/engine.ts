import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rank } from '../core/rank';
import type { ResultRow, SeatedPlayer } from '../core/types';
import { clampInt, num } from '../core/util';
import { FIELDS_BY_ID, fieldsOf, isVariantKey, VARIANTS } from './fields';
import * as K from './game';
import type { KniffelGame, KniffelOptions } from './game';

const DEFAULTS: KniffelOptions = { variant: 'classic', extraKniffel: false, firstHand: false, input: 'dice' };

export const kniffelEngine: GameEngine<KniffelGame, KniffelOptions> = {
  id: 'kniffel',
  higherIsBetter: true,
  minPlayers: 1,
  maxPlayers: 8,
  includeInTrend: true,
  defaultOptions: DEFAULTS,
  localKeys: ['dice', 'rolls', 'first', 'input'],

  normalizeOptions(raw) {
    const o = (raw ?? {}) as Partial<KniffelOptions>;
    return {
      variant: isVariantKey(o.variant) ? o.variant : DEFAULTS.variant,
      extraKniffel: !!o.extraKniffel,
      firstHand: !!o.firstHand,
      input: o.input === 'number' ? 'number' : 'dice',
    };
  },

  create: (players, options) => K.create(players, options),

  rematch(g, nameOf) {
    const ps = g.players.map(p => ({ pid: p.pid, name: nameOf(p), color: p.color }));
    return K.create([...ps.slice(1), ps[0]!] as SeatedPlayer[], { variant: g.variant, extraKniffel: g.extra, firstHand: g.firstRule, input: g.input });
  },

  result(g): ResultRow[] {
    return rank(
      g.players.map((p, i) => {
        if (g.legacy) return { i, pid: p.pid, name: p.name, color: p.color, total: num(p.total), sub: 'Aus der ersten Version übernommen' };
        const t = K.totals(g, p);
        return {
          i,
          pid: p.pid,
          name: p.name,
          color: p.color,
          total: t.total,
          sub: `Oben ${t.up} · Bonus ${t.bon} · Unten ${t.low}${t.kb ? ` · Extra ${t.kb}` : ''}${t.hand ? ` · Hand ${t.hand}` : ''}`,
        };
      }),
    );
  },

  label: g => VARIANTS[g.variant].name,
  statsKey: g => 'kniffel:' + g.variant,
  trendLabel: g => VARIANTS[g.variant].name,
  progress: g => `Runde ${K.currentRound(g)} von ${K.allFields(g).length}`,
  isEmpty: g => g.players.every(p => !Object.keys(p.scores).length && !p.extra && !p.fh) && g.dice.every(x => !x),
  cannotFinish: () => null,
  finishWarning: g => (g.players.some(p => K.openFields(g, p).length) ? 'Nochmal tippen: offene Felder zählen 0' : ''),
  endNote: g => (g.players.some(p => K.openFields(g, p).length) ? 'Vorzeitig ausgewertet: offene Felder zählen 0.' : ''),

  describeUndo(g) {
    const last = g.undo[g.undo.length - 1];
    if (!last) return null;
    const who = g.players[last.pi]?.name ?? '?';
    if (last.kind === 'xk') return `Extra-Kniffel bei ${who}`;
    if (last.kind === 'fh') return `Erste Hand bei ${who}`;
    return `${FIELDS_BY_ID[last.fid]?.name ?? last.fid} bei ${who}`;
  },

  undo(g) {
    const r = K.undo(g);
    if (!r) return null;
    reopenGame(g);
    return { fieldId: r.fieldId };
  },

  sanitize(out, raw) {
    const g = raw as Record<string, any>;
    out.variant = isVariantKey(g['variant']) ? g['variant'] : 'classic';
    out.extra = !!g['extra'];
    out.firstRule = !!g['firstRule'];
    out.first = false;
    out.input = g['input'] === 'number' ? 'number' : 'dice';
    out.dice = Array.isArray(g['dice']) && g['dice'].length === 5 ? g['dice'].map((x: unknown) => clampInt(x, 0, 6)) : [0, 0, 0, 0, 0];
    out.rolls = clampInt(g['rolls'], 0, 3);
    if (g['record'] && num(g['record'].best)) out.record = { best: num(g['record'].best), prev: num(g['record'].prev) };
    out.players.forEach((p, i) => {
      const src = (g['players'] ?? [])[i] ?? {};
      p.scores = {};
      for (const [k, v] of Object.entries<any>(src.scores ?? {})) if (FIELDS_BY_ID[k] && Number.isFinite(+v)) p.scores[k] = +v;
      p.extra = Math.max(0, num(src.extra) | 0);
      p.fh = Math.max(0, num(src.fh) | 0);
    });
  },
};

export { fieldsOf };
