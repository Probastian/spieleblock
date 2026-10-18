import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rank } from '../core/rank';
import { clampInt, pluralize } from '../core/util';
import * as H from './game';
import { cleanCard, cleanCards, MAX_CARDS, MAX_LINE, MAX_TOKENS, type HitsterGame, type HitsterOptions } from './game';

const DEFAULTS: HitsterOptions = { ...H.DEFAULT_RULES, source: null, decks: [], years: {} };

export const hitsterEngine: GameEngine<HitsterGame, HitsterOptions> = {
  id: 'hitster',
  higherIsBetter: true,
  minPlayers: 1,
  maxPlayers: 8,
  includeInTrend: false,
  defaultOptions: DEFAULTS,
  localKeys: [],

  normalizeOptions(raw) {
    const o = (raw ?? {}) as Record<string, unknown>;
    return { ...H.normalizeRules(o), source: H.normalizeDeckRef(o['source']), decks: H.normalizeDecks(o['decks']), years: H.normalizeYears(o['years']) };
  },

  /** Zwei Geräte haben Playlists und Jahre ergänzt: nichts davon soll verloren gehen. Eigene Korrekturen gehen vor. */
  mergeOptions(newer, older) {
    const decks = new Map(older.decks.map(d => [d.id, d]));
    for (const d of newer.decks) if (!decks.has(d.id) || d.at >= decks.get(d.id)!.at) decks.set(d.id, d);
    const years = { ...older.years };
    for (const [id, e] of Object.entries(newer.years)) if (years[id]?.src !== 'user' || e.src === 'user') years[id] = e;
    return hitsterEngine.normalizeOptions({ ...newer, decks: [...decks.values()], years });
  },
  create: (players, options) => H.create(players, options),

  rematch(g, nameOf) {
    const ps = g.players.map(p => ({ pid: p.pid, name: nameOf(p), color: p.color }));
    return H.create([...ps.slice(1), ps[0]!], { ...g.rules, source: g.source });
  },

  result(g) {
    return rank(
      g.players.map((p, i) => ({
        i,
        pid: p.pid,
        name: p.name,
        color: p.color,
        total: p.line.length,
        sub: `${pluralize(p.tokens, 'Token', 'Token')}`,
      })),
      true,
    );
  },

  label: () => 'Hitster',
  // Karten bis zum Ziel sind nur bei gleichem Ziel vergleichbar.
  statsKey: g => `hitster-${g.rules.goal}`,
  trendLabel: () => 'Hitster',

  progress(g) {
    if (!g.started) return 'Noch nicht gestartet';
    const top = [...g.players].sort((a, b) => b.line.length - a.line.length)[0]!;
    return `${top.name} führt mit ${top.line.length} von ${g.rules.goal}`;
  },

  isEmpty: g => !g.started || (!g.current && !g.discard.length && g.players.every(p => p.line.length <= 1)),
  cannotFinish: g => (g.started ? null : 'Das Spiel hat noch nicht begonnen'),
  finishWarning: g => (H.reached(g) ? '' : `Noch niemand hat ${g.rules.goal} Karten.`),
  endNote: () => '',

  describeUndo(g) {
    const u = g.undo[g.undo.length - 1];
    if (!u) return null;
    switch (u.k) {
      case 'draw':
        return 'Karte zurücklegen';
      case 'place':
        return 'Platz zurücknehmen';
      case 'reveal':
        return 'Auflösung zurücknehmen';
      case 'end':
        return 'Zug zurücknehmen';
      case 'skip':
        return 'Überspringen zurücknehmen';
      case 'guess':
        return 'Token zurücknehmen';
      case 'buy':
        return 'Kauf zurücknehmen';
      case 'year':
        return 'Jahr zurücksetzen';
    }
  },

  undo(g) {
    const done = H.undo(g);
    if (!done) return null;
    reopenGame(g);
    return {};
  },

  sanitize(out, raw) {
    const g = raw as Record<string, any>;
    const players: unknown[] = Array.isArray(g['players']) ? g['players'] : [];
    out.rules = H.normalizeRules(g['rules']);
    out.source = H.normalizeDeckRef(g['source']);
    out.started = !!g['started'];
    out.deck = cleanCards(g['deck'], MAX_CARDS);
    out.discard = cleanCards(g['discard'], MAX_CARDS);
    out.players.forEach((p, i) => {
      const raw = (players[i] ?? {}) as Record<string, unknown>;
      p.line = cleanCards(raw['line'], MAX_LINE).sort((a, b) => a.year - b.year);
      p.tokens = clampInt(raw['tokens'], 0, MAX_TOKENS);
    });

    const c = g['current'] as Record<string, any> | null | undefined;
    const card = cleanCard(c?.['card']);
    out.current = null;
    if (out.started && c && card) {
      const phase = c['phase'] === 'revealed' ? 'revealed' : c['phase'] === 'placed' ? 'placed' : 'listen';
      const line = out.players[out.turn]!.line;
      const slot = c['slot'] === null || c['slot'] === undefined ? null : clampInt(c['slot'], 0, line.length);
      // Ohne gewählten Platz gibt es nichts aufzulösen
      const safe = phase !== 'listen' && slot === null ? 'listen' : phase;
      out.current = { card, phase: safe, slot, ...(safe === 'revealed' ? { ok: !!c['ok'] } : {}) };
    }
    out.undo = [];
  },
};
