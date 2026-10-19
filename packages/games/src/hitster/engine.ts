import type { GameEngine } from '../core/engine';
import { reopenGame } from '../core/lifecycle';
import { rank } from '../core/rank';
import { clampInt, pluralize } from '../core/util';
import * as H from './game';
import { cleanCard, cleanCards, MAX_CARDS, MAX_LINE, MAX_TOKENS, type HitsterGame, type HitsterOptions } from './game';

const DEFAULTS: HitsterOptions = { ...H.DEFAULT_RULES, source: null, decks: [], years: {} };

/** Die Zeitstrahl-Regeln, einmal für Songs (`hitster`) und einmal für Filme (`film`). */
function timelineEngine(kind: H.TimelineKind): GameEngine<HitsterGame, HitsterOptions> {
  const film = kind === 'film';
  const engine: GameEngine<HitsterGame, HitsterOptions> = {
    id: kind,
    higherIsBetter: true,
    minPlayers: 1,
    maxPlayers: 8,
    includeInTrend: false,
    defaultOptions: film ? { ...DEFAULTS, guessReward: 0 } : DEFAULTS,
    localKeys: [],

    normalizeOptions(raw) {
      const o = (raw ?? {}) as Record<string, unknown>;
      return { ...H.normalizeRules(o, film), source: H.normalizeDeckRef(o['source']), decks: H.normalizeDecks(o['decks']), years: H.normalizeYears(o['years']) };
    },

    /** Zwei Geräte haben Playlists und Jahre ergänzt: nichts davon soll verloren gehen. Eigene Korrekturen gehen vor. */
    mergeOptions(newer, older) {
      const decks = new Map(older.decks.map(d => [d.id, d]));
      for (const d of newer.decks) if (!decks.has(d.id) || d.at >= decks.get(d.id)!.at) decks.set(d.id, d);
      const years = { ...older.years };
      for (const [id, e] of Object.entries(newer.years)) if (years[id]?.src !== 'user' || e.src === 'user') years[id] = e;
      return engine.normalizeOptions({ ...newer, decks: [...decks.values()], years });
    },
    create: (players, options) => H.create(players, options, kind),

    rematch(g, nameOf) {
      const ps = g.players.map(p => ({ pid: p.pid, name: nameOf(p), color: p.color }));
      return H.create([...ps.slice(1), ps[0]!], { ...g.rules, source: g.source }, kind);
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

    label: () => (film ? 'Film-Zeitstrahl' : 'Hitster'),
    // Karten bis zum Ziel sind nur bei gleichem Ziel vergleichbar.
    statsKey: g => `${kind}-${g.rules.goal}`,
    trendLabel: () => (film ? 'Film-Zeitstrahl' : 'Hitster'),

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
        case 'confirm':
          return 'Bestätigung zurücknehmen';
        case 'end':
          return 'Zug zurücknehmen';
        case 'skip':
          return 'Überspringen zurücknehmen';
        case 'guess':
          return 'Token zurücknehmen';
        case 'veto':
          return 'Einspruch zurücknehmen';
        case 'pass':
          return 'Verzicht zurücknehmen';
        case 'close':
          return 'Einspruchsrunde zurücknehmen';
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
      out.rules = H.normalizeRules(g['rules'], film);
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
        const n = out.players.length;
        const line = out.players[out.turn]!.line;
        const slot = c['slot'] === null || c['slot'] === undefined ? null : clampInt(c['slot'], 0, line.length);

        // Einsprüche: Zuordnung Spieler → Platz. Ältere Fassungen speicherten eine Liste `[{ pi, slot }]`.
        const rawVetoes: [unknown, unknown][] = Array.isArray(c['vetoes'])
          ? c['vetoes'].map((v: any) => [v?.pi, v?.slot])
          : c['vetoes'] && typeof c['vetoes'] === 'object' ? Object.entries(c['vetoes']) : [];
        const vetoes: Record<string, number> = {};
        for (const [k, v] of rawVetoes) {
          const pi = clampInt(k, 0, n - 1);
          const vs = clampInt(v, 0, line.length);
          // nicht der Spieler am Zug, je Spieler und je Platz nur einer, nie der gewählte Platz
          if (pi !== out.turn && vs !== slot && vetoes[pi] === undefined && !Object.values(vetoes).includes(vs)) vetoes[pi] = vs;
        }
        const passed: Record<string, true> = {};
        if (c['passed'] && typeof c['passed'] === 'object') {
          for (const k of Object.keys(c['passed'])) {
            const pi = clampInt(k, 0, n - 1);
            if (pi !== out.turn && vetoes[pi] === undefined && c['passed'][k]) passed[pi] = true;
          }
        }

        let phase: H.HitsterPhase = c['phase'] === 'revealed' ? 'revealed' : c['phase'] === 'veto' ? 'veto' : c['phase'] === 'placed' ? 'placed' : 'listen';
        // Ältere Fassung: Einsprüche liefen noch im Zustand „gelegt“
        if (phase === 'placed' && Object.keys(vetoes).length) phase = 'veto';
        // Ohne gewählten Platz gibt es nichts zu bestätigen oder aufzulösen
        if (phase !== 'listen' && slot === null) phase = 'listen';

        const current: H.HitsterCurrent = { card, phase, slot };
        if (phase === 'revealed') current.ok = !!c['ok'];
        if (phase === 'veto' || phase === 'revealed') {
          if (Object.keys(vetoes).length) current.vetoes = vetoes;
          if (Object.keys(passed).length) current.passed = passed;
        }
        if (phase === 'revealed') {
          const by = c['stolenBy'] === undefined ? -1 : clampInt(c['stolenBy'], 0, n - 1);
          if (!current.ok && by >= 0 && by !== out.turn) current.stolenBy = by;
          if (c['guessed']) current.guessed = true;
        }
        out.current = current;
      }
      out.undo = [];
    },
  };
  return engine;
}

export const hitsterEngine = timelineEngine('hitster');
export const filmEngine = timelineEngine('film');
