import { cleanIndexes, cleanText, intOr, partyPlayers, popSnap, pushSnap, sanitizePoints, type PartyPlayer } from '../core/party';
import type { BaseGame, SeatedPlayer } from '../core/types';
import { clampInt, newId, num, pickOne } from '../core/util';
import { SPECTRA } from './spectra';

/**
 * `clue`: Wer gibt, sieht das Ziel und denkt sich einen Hinweis aus. `guess`: Die anderen stellen ihren Regler ein.
 * `reveal`: Ziel aufgedeckt, Punkte verteilt.
 */
export type WavePhase = 'clue' | 'guess' | 'reveal';

export interface WavelengthRules {
  /** Durchgänge: so oft gibt jeder Spieler einen Hinweis. 0 = offen. */
  laps: number;
  /** Alle stellen gemeinsam einen Regler ein (wie im Brettspiel) statt jeder für sich. */
  team: boolean;
}

export interface WaveRound {
  n: number;
  left: string;
  right: string;
  /** Geheimes Ziel, 0 (ganz links) bis 100 (ganz rechts). */
  target: number;
  /** Wer den Hinweis gibt. */
  giver: number;
  phase: WavePhase;
  clue: string;
  /** Regler der Rater: Spieler → Position. Im Team-Modus gilt `team`. */
  guesses: Record<string, number>;
  team: number | null;
  /** Wer seinen Regler festgemacht hat. Im Team-Modus gilt `teamLocked`. */
  locked: number[];
  teamLocked: boolean;
  /** Punkte dieser Runde (erst nach dem Aufdecken). */
  gain?: number[];
}

export interface WaveSummary {
  n: number;
  left: string;
  right: string;
  target: number;
  giver: number;
  gain: number[];
}

export interface WavelengthGame extends BaseGame<PartyPlayer> {
  type: 'wavelength';
  rules: WavelengthRules;
  current: WaveRound | null;
  history: WaveSummary[];
  /** Schon gespielte Paare (`links|rechts`). */
  used: string[];
}

export type WavelengthOptions = WavelengthRules;

export const DEFAULT_RULES: WavelengthRules = { laps: 1, team: false };
export const MAX_HISTORY = 40;
const SNAP_KEYS = ['current', 'history', 'used', 'players', 'turn'] as const;

/** Halbe Breite der Trefferfelder in Prozent der Skala und ihre Punkte. */
export const ZONES: readonly { reach: number; points: number }[] = [
  { reach: 5, points: 4 },
  { reach: 11, points: 3 },
  { reach: 18, points: 2 },
];

export function pointsFor(guess: number, target: number): number {
  const d = Math.abs(guess - target);
  return ZONES.find(z => d <= z.reach)?.points ?? 0;
}

export function normalizeRules(raw: unknown): WavelengthRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  return { laps: intOr(r['laps'], DEFAULT_RULES.laps, 0, 3), team: !!r['team'] };
}

export function create(players: SeatedPlayer[], o: Partial<WavelengthRules> = {}): WavelengthGame {
  const now = Date.now();
  return {
    id: 'g' + newId(),
    type: 'wavelength',
    rules: normalizeRules(o),
    players: partyPlayers(players),
    current: null,
    history: [],
    used: [],
    undo: [],
    view: 0,
    turn: 0,
    status: 'active',
    created: now,
    u: now,
  };
}

export const roundsTotal = (g: WavelengthGame): number => (g.rules.laps ? g.rules.laps * g.players.length : 0);

export function allPlayed(g: WavelengthGame): boolean {
  const total = roundsTotal(g);
  return total > 0 && g.history.length >= total && (!g.current || g.current.phase === 'reveal');
}

/** Alle außer dem Hinweisgeber. */
export const guessers = (g: WavelengthGame): number[] => g.players.map((_, i) => i).filter(i => i !== g.current?.giver);

/** Neue Runde: Paar ziehen, Ziel würfeln, der Nächste gibt den Hinweis. */
export function startRound(g: WavelengthGame, random: () => number = Math.random): string | null {
  if (g.current && g.current.phase !== 'reveal') return 'Die Runde läuft noch';
  const total = roundsTotal(g);
  if (total && g.history.length >= total) return 'Alle Runden sind gespielt';
  if (g.players.length < 2) return 'Mindestens 2 Spieler';
  pushSnap(g, SNAP_KEYS, g.current ? 'Nächste Runde zurücknehmen' : 'Start zurücknehmen');

  const key = (s: readonly [string, string]) => `${s[0]}|${s[1]}`;
  let fresh = SPECTRA.filter(s => !g.used.includes(key(s)));
  if (!fresh.length) {
    g.used = [];
    fresh = [...SPECTRA];
  }
  const s = pickOne(fresh, random);
  g.used = [...g.used, key(s)].slice(-SPECTRA.length);
  const giver = g.current ? (g.current.giver + 1) % g.players.length : g.turn % g.players.length;
  g.turn = giver;
  g.current = {
    n: g.history.length + 1,
    left: s[0],
    right: s[1],
    target: 8 + Math.floor(random() * 85),
    giver,
    phase: 'clue',
    clue: '',
    guesses: {},
    team: null,
    locked: [],
    teamLocked: false,
  };
  return null;
}

/** Der Hinweis ist gegeben (optional als Text). Die anderen sind dran. */
export function giveClue(g: WavelengthGame, clue = ''): string | null {
  const c = g.current;
  if (!c || c.phase !== 'clue') return 'Gerade wird kein Hinweis gegeben';
  pushSnap(g, SNAP_KEYS, 'Hinweis zurücknehmen');
  c.clue = clue.trim().slice(0, 80);
  c.phase = 'guess';
  return null;
}

const clampPos = (v: unknown): number => Math.max(0, Math.min(100, Math.round(num(v, 50))));

/** Regler setzen (solange er nicht festgemacht ist). Im Team-Modus gilt `pi` nicht. */
export function setGuess(g: WavelengthGame, pi: number | null, pos: number): string | null {
  const c = g.current;
  if (!c || c.phase !== 'guess') return 'Gerade wird nicht geraten';
  if (g.rules.team) {
    if (c.teamLocked) return null;
    c.team = clampPos(pos);
    return null;
  }
  if (pi === null || !g.players[pi] || pi === c.giver) return 'Ungültiger Spieler';
  if (c.locked.includes(pi)) return null;
  c.guesses[pi] = clampPos(pos);
  return null;
}

/** Regler festmachen. Sind alle fertig, wird aufgedeckt. */
export function lock(g: WavelengthGame, pi: number | null): string | null {
  const c = g.current;
  if (!c || c.phase !== 'guess') return 'Gerade wird nicht geraten';
  if (g.rules.team) {
    if (c.team === null) c.team = 50;
    c.teamLocked = true;
    reveal(g);
    return null;
  }
  if (pi === null || !g.players[pi] || pi === c.giver) return 'Ungültiger Spieler';
  if (c.guesses[pi] === undefined) c.guesses[pi] = 50;
  if (!c.locked.includes(pi)) c.locked.push(pi);
  if (guessers(g).every(i => c.locked.includes(i))) reveal(g);
  return null;
}

/** Ändern vor dem Aufdecken, solange noch nicht alle fertig sind. */
export function unlock(g: WavelengthGame, pi: number): void {
  const c = g.current;
  if (c?.phase === 'guess') c.locked = c.locked.filter(i => i !== pi);
}

/** Ziel aufdecken und werten. Wer noch nicht festgemacht hat, zählt mit seinem aktuellen Regler (ohne Regler: 0 Punkte). */
export function reveal(g: WavelengthGame): string | null {
  const c = g.current;
  if (!c || c.phase !== 'guess') return 'Gerade wird nicht geraten';
  pushSnap(g, SNAP_KEYS, 'Aufdecken zurücknehmen');
  const n = g.players.length;
  const gain = Array.from({ length: n }, () => 0);
  if (g.rules.team) {
    const pts = c.team === null ? 0 : pointsFor(c.team, c.target);
    gain.forEach((_, i) => (gain[i] = pts));
  } else {
    const gs = guessers(g);
    for (const i of gs) gain[i] = c.guesses[i] === undefined ? 0 : pointsFor(c.guesses[i]!, c.target);
    // Wer gut erklärt, bekommt den Durchschnitt (aufgerundet)
    gain[c.giver] = gs.length ? Math.ceil(gs.reduce((a, i) => a + gain[i]!, 0) / gs.length) : 0;
  }
  gain.forEach((x, i) => (g.players[i]!.points += x));
  c.gain = gain;
  c.phase = 'reveal';
  g.history.push({ n: c.n, left: c.left, right: c.right, target: c.target, giver: c.giver, gain: [...gain] });
  if (g.history.length > MAX_HISTORY) g.history.shift();
  return null;
}

export const undo = (g: WavelengthGame): boolean => popSnap(g);

// ------------------------------------------------------------- Dokument bereinigen
export function sanitize(out: WavelengthGame, raw: Record<string, any>): void {
  const n = out.players.length;
  sanitizePoints(out, raw);
  out.rules = normalizeRules(raw['rules']);
  out.used = (Array.isArray(raw['used']) ? raw['used'] : []).slice(-SPECTRA.length).map((s: unknown) => cleanText(s, 120)).filter(Boolean);
  out.history = (Array.isArray(raw['history']) ? raw['history'] : []).slice(-MAX_HISTORY).map((h: any) => ({
    n: clampInt(h?.n, 1, 999),
    left: cleanText(h?.left, 60, '?'),
    right: cleanText(h?.right, 60, '?'),
    target: clampInt(h?.target, 0, 100),
    giver: clampInt(h?.giver, 0, n - 1),
    gain: Array.from({ length: n }, (_, i) => clampInt(Array.isArray(h?.gain) ? h.gain[i] : 0, 0, 20)),
  }));

  const c = raw['current'] as Record<string, any> | null | undefined;
  out.current = null;
  if (c && typeof c === 'object') {
    const giver = clampInt(c['giver'], 0, n - 1);
    const phase: WavePhase = c['phase'] === 'reveal' ? 'reveal' : c['phase'] === 'guess' ? 'guess' : 'clue';
    const guesses: Record<string, number> = {};
    if (c['guesses'] && typeof c['guesses'] === 'object') {
      for (const [k, v] of Object.entries(c['guesses'])) {
        const i = Math.round(num(k, -1));
        if (i >= 0 && i < n && i !== giver) guesses[i] = clampPos(v);
      }
    }
    out.current = {
      n: clampInt(c['n'], 1, 999),
      left: cleanText(c['left'], 60, '?'),
      right: cleanText(c['right'], 60, '?'),
      target: clampInt(c['target'], 0, 100),
      giver,
      phase,
      clue: cleanText(c['clue'], 80),
      guesses,
      team: c['team'] === null || c['team'] === undefined ? null : clampPos(c['team']),
      locked: cleanIndexes(c['locked'], n).filter(i => i !== giver),
      teamLocked: !!c['teamLocked'],
    };
    if (phase === 'reveal') out.current.gain = Array.from({ length: n }, (_, i) => clampInt(Array.isArray(c['gain']) ? c['gain'][i] : 0, 0, 20));
  }
  out.turn = clampInt(out.turn, 0, n - 1);
}
