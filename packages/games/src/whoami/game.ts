import { cleanIndexes, cleanText, intOr, partyPlayers, popSnap, pushSnap, sanitizePoints, type PartyPlayer } from '../core/party';
import type { BaseGame, SeatedPlayer } from '../core/types';
import { clampInt, newId, num, shuffle } from '../core/util';
import { cleanCategoryIds, FIGURE_CATEGORIES, HEADSUP_CATEGORIES, wordCategory } from '../party/words';

/**
 * `table`: Jeder bekommt eine Figur, die er nicht sieht, die anderen sehen sie. Fragen mit Ja/Nein, wer zuerst weiß, wer er ist, gewinnt.
 * `forehead`: Ein Handy, ein Begriff auf dem Display; die anderen erklären, wer dran ist, rät.
 */
export type WhoamiMode = 'table' | 'forehead';

export interface WhoamiRules {
  mode: WhoamiMode;
  /** Runden (Tisch) bzw. Durchgänge je Spieler (Stirn); beim Tisch 0 = offen. */
  rounds: number;
  /** Dauer eines Zugs im Stirnraten. */
  seconds: number;
  /** Erlaubte Kategorien, leer = alle der Spielart. */
  categories: string[];
}

export interface FigureRound {
  n: number;
  /** Figur je Spieler (Index wie `players`). */
  figures: string[];
  /** Spieler in der Reihenfolge, in der sie ihre Figur erraten haben. */
  solved: number[];
  over: boolean;
  gain?: number[];
}

export interface HeadsUpTurn {
  phase: 'run' | 'over';
  /** Zeitpunkt (ms), zu dem der Zug endet. */
  endsAt: number;
  /** Noch ungespielte Begriffe, der nächste steht vorn. */
  words: string[];
  done: { w: string; ok: boolean }[];
}

export interface WhoamiSummary {
  n: number;
  gain: number[];
}

export interface WhoamiGame extends BaseGame<PartyPlayer> {
  type: 'whoami';
  rules: WhoamiRules;
  figure: FigureRound | null;
  hu: HeadsUpTurn | null;
  /** Gespielte Züge im Stirnraten. */
  huDone: number;
  /** Begriffsvorrat fürs Stirnraten. */
  deck: string[];
  history: WhoamiSummary[];
}

export type WhoamiOptions = WhoamiRules;

export const DEFAULT_RULES: WhoamiRules = { mode: 'table', rounds: 3, seconds: 60, categories: [] };
export const SECONDS = [30, 60, 90] as const;
export const MAX_HISTORY = 40;
export const MAX_DECK = 300;
const TURN_WORDS = 40;
const SNAP_KEYS = ['figure', 'hu', 'huDone', 'deck', 'history', 'turn', 'players'] as const;

export const allowedCategories = (mode: WhoamiMode): readonly string[] => (mode === 'table' ? FIGURE_CATEGORIES : HEADSUP_CATEGORIES);

export function normalizeRules(raw: unknown): WhoamiRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  const mode: WhoamiMode = r['mode'] === 'forehead' ? 'forehead' : 'table';
  const seconds = num(r['seconds'], DEFAULT_RULES.seconds);
  return {
    mode,
    rounds: mode === 'forehead' ? intOr(r['rounds'], 1, 1, 5) : intOr(r['rounds'], DEFAULT_RULES.rounds, 0, 20),
    seconds: (SECONDS as readonly number[]).includes(seconds) ? seconds : DEFAULT_RULES.seconds,
    categories: cleanCategoryIds(r['categories'], allowedCategories(mode)),
  };
}

export function create(players: SeatedPlayer[], o: Partial<WhoamiRules> = {}): WhoamiGame {
  const now = Date.now();
  return {
    id: 'g' + newId(),
    type: 'whoami',
    rules: normalizeRules(o),
    players: partyPlayers(players),
    figure: null,
    hu: null,
    huDone: 0,
    deck: [],
    history: [],
    undo: [],
    view: 0,
    turn: 0,
    status: 'active',
    created: now,
    u: now,
  };
}

/** Alle erlaubten Begriffe der gewählten Kategorien. */
export function wordPool(g: WhoamiGame): string[] {
  const ids = g.rules.categories.length ? g.rules.categories : allowedCategories(g.rules.mode);
  return [...new Set(ids.flatMap(id => wordCategory(id)?.words ?? []))];
}

/** Ist das Spiel durchgespielt? */
export function allPlayed(g: WhoamiGame): boolean {
  if (g.rules.mode === 'forehead') return g.huDone >= g.players.length * g.rules.rounds && (!g.hu || g.hu.phase === 'over');
  return g.rules.rounds > 0 && g.history.length >= g.rules.rounds && (!g.figure || g.figure.over);
}

export const roundsPlayed = (g: WhoamiGame): number => (g.rules.mode === 'forehead' ? Math.floor(g.huDone / Math.max(1, g.players.length)) : g.history.length);

// ------------------------------------------------------------- Am Tisch
/** Neue Runde: jeder bekommt eine eigene Figur. */
export function startRound(g: WhoamiGame, random: () => number = Math.random): string | null {
  if (g.rules.mode !== 'table') return 'Nur am Tisch';
  if (g.figure && !g.figure.over) return 'Die Runde läuft noch';
  if (g.rules.rounds > 0 && g.history.length >= g.rules.rounds) return 'Alle Runden sind gespielt';
  const pool = wordPool(g);
  if (pool.length < g.players.length) return 'Zu wenige Figuren';
  pushSnap(g, SNAP_KEYS, g.figure ? 'Nächste Runde zurücknehmen' : 'Start zurücknehmen');
  g.figure = { n: g.history.length + 1, figures: shuffle(pool, random).slice(0, g.players.length), solved: [], over: false };
  return null;
}

/** Spieler `pi` weiß, wer er ist. Wer als Vorletzter fertig wird, beendet die Runde (der Letzte bekommt nichts). */
export function solve(g: WhoamiGame, pi: number): string | null {
  const f = g.figure;
  if (!f || f.over) return 'Gerade läuft keine Runde';
  if (!g.players[pi]) return 'Ungültiger Spieler';
  if (f.solved.includes(pi)) return null;
  f.solved.push(pi);
  if (f.solved.length >= g.players.length - 1) endRound(g);
  return null;
}

/** Aus Versehen „Ich weiß es“ getippt. */
export function unsolve(g: WhoamiGame, pi: number): void {
  const f = g.figure;
  if (!f || f.over) return;
  f.solved = f.solved.filter(i => i !== pi);
}

/** Runde beenden, auch wenn noch nicht alle fertig sind. */
export function endRound(g: WhoamiGame): string | null {
  const f = g.figure;
  if (!f || f.over) return 'Gerade läuft keine Runde';
  const n = g.players.length;
  const gain = Array.from({ length: n }, () => 0);
  f.solved.forEach((pi, k) => (gain[pi] = n - k));
  gain.forEach((x, i) => (g.players[i]!.points += x));
  f.gain = gain;
  f.over = true;
  g.history.push({ n: f.n, gain });
  if (g.history.length > MAX_HISTORY) g.history.shift();
  return null;
}

// ------------------------------------------------------------- Stirnraten
/** Der Spieler am Zug beginnt seinen Zug. `now` in ms. */
export function startTurn(g: WhoamiGame, now: number, random: () => number = Math.random): string | null {
  if (g.rules.mode !== 'forehead') return 'Nur beim Stirnraten';
  if (g.hu) return 'Der Zug läuft schon';
  if (g.huDone >= g.players.length * g.rules.rounds) return 'Alle Züge sind gespielt';
  pushSnap(g, SNAP_KEYS, 'Zug zurücknehmen');
  if (g.deck.length < TURN_WORDS) g.deck = [...g.deck, ...shuffle(wordPool(g), random)].slice(0, MAX_DECK);
  g.hu = { phase: 'run', endsAt: now + g.rules.seconds * 1000, words: g.deck.splice(0, TURN_WORDS), done: [] };
  return null;
}

const GRACE_MS = 1500;

/** Begriff richtig oder übersprungen. */
export function mark(g: WhoamiGame, ok: boolean, now: number): string | null {
  const t = g.hu;
  if (!t || t.phase !== 'run') return 'Gerade läuft kein Zug';
  if (now > t.endsAt + GRACE_MS) {
    closeRun(g);
    return 'Die Zeit ist um';
  }
  const w = t.words.shift();
  if (w === undefined) return 'Keine Begriffe mehr';
  t.done.push({ w, ok });
  if (!t.words.length) closeRun(g);
  return null;
}

/** Letzte Wertung zurücknehmen (nur während der Zug läuft). */
export function unmark(g: WhoamiGame): boolean {
  const t = g.hu;
  if (!t || t.phase !== 'run') return false;
  const last = t.done.pop();
  if (!last) return false;
  t.words.unshift(last.w);
  return true;
}

/** Zeit abgelaufen (die Oberfläche ruft das auf, sobald `endsAt` erreicht ist). */
export function tick(g: WhoamiGame, now: number): boolean {
  const t = g.hu;
  if (!t || t.phase !== 'run' || now < t.endsAt) return false;
  closeRun(g);
  return true;
}

/** Zug vorzeitig beenden. */
export function stopTurn(g: WhoamiGame): void {
  if (g.hu?.phase === 'run') closeRun(g);
}

function closeRun(g: WhoamiGame): void {
  const t = g.hu!;
  const ok = t.done.filter(d => d.ok).length;
  t.phase = 'over';
  g.players[g.turn]!.points += ok;
  g.history.push({ n: g.history.length + 1, gain: g.players.map((_, i) => (i === g.turn ? ok : 0)) });
  if (g.history.length > MAX_HISTORY) g.history.shift();
}

/** Nach der Auswertung: der Nächste ist dran. */
export function nextTurn(g: WhoamiGame): string | null {
  if (!g.hu || g.hu.phase !== 'over') return 'Der Zug ist noch nicht vorbei';
  pushSnap(g, SNAP_KEYS, 'Nächsten Zug zurücknehmen');
  g.hu = null;
  g.huDone++;
  g.turn = (g.turn + 1) % g.players.length;
  return null;
}

export const undo = (g: WhoamiGame): boolean => popSnap(g);

/** Richtig geratene Begriffe in diesem Zug. */
export const turnScore = (t: HeadsUpTurn | null): number => t?.done.filter(d => d.ok).length ?? 0;

// ------------------------------------------------------------- Dokument bereinigen
export function sanitize(out: WhoamiGame, raw: Record<string, any>): void {
  const n = out.players.length;
  sanitizePoints(out, raw);
  out.rules = normalizeRules(raw['rules']);
  out.huDone = clampInt(raw['huDone'], 0, 200);

  const f = raw['figure'] as Record<string, any> | null | undefined;
  out.figure = null;
  if (f && typeof f === 'object' && Array.isArray(f['figures'])) {
    const figures: string[] = Array.from({ length: n }, (_, i) => cleanText(f['figures'][i], 60, '?'));
    const over = !!f['over'];
    out.figure = { n: clampInt(f['n'], 1, 99), figures, solved: cleanIndexes(f['solved'], n), over };
    if (over) out.figure.gain = Array.from({ length: n }, (_, i) => clampInt(Array.isArray(f['gain']) ? f['gain'][i] : 0, 0, 20));
  }

  const t = raw['hu'] as Record<string, any> | null | undefined;
  out.hu = null;
  if (t && typeof t === 'object') {
    out.hu = {
      phase: t['phase'] === 'over' ? 'over' : 'run',
      endsAt: Math.max(0, num(t['endsAt'])),
      words: (Array.isArray(t['words']) ? t['words'] : []).slice(0, TURN_WORDS).map((w: unknown) => cleanText(w, 60)).filter(Boolean),
      done: (Array.isArray(t['done']) ? t['done'] : []).slice(0, 200).map((d: any) => ({ w: cleanText(d?.w, 60), ok: !!d?.ok })).filter((d: { w: string }) => d.w),
    };
  }
  out.deck = (Array.isArray(raw['deck']) ? raw['deck'] : []).slice(0, MAX_DECK).map((w: unknown) => cleanText(w, 60)).filter(Boolean);
  out.history = (Array.isArray(raw['history']) ? raw['history'] : []).slice(-MAX_HISTORY).map((h: any) => ({ n: clampInt(h?.n, 1, 999), gain: Array.from({ length: n }, (_, i) => clampInt(Array.isArray(h?.gain) ? h.gain[i] : 0, 0, 200)) }));
}
