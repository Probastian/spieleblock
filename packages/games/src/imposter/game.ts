import { cleanCategoryIds, IMPOSTER_CATEGORIES, wordCategory } from '../party/words';
import { cleanIndexes, cleanIndexMap, cleanText, intOr, partyPlayers, popSnap, pushSnap, sanitizePoints, type PartyPlayer } from '../core/party';
import type { BaseGame, SeatedPlayer } from '../core/types';
import { clampInt, newId, pickOne, shuffle } from '../core/util';

/**
 * `reveal`: jeder sieht heimlich seine Rolle. `talk`: reihum Hinweise geben. `vote`: abstimmen.
 * `guess`: der erwischte Imposter darf das Wort noch raten. `result`: aufgelöst, Punkte verteilt.
 */
export type ImposterPhase = 'reveal' | 'talk' | 'vote' | 'guess' | 'result';

export interface ImposterRules {
  /** Anzahl Runden, 0 = offen. */
  rounds: number;
  /** Anzahl Imposter (bei wenigen Spielern weniger). */
  imposters: number;
  /** Der Imposter erfährt die Kategorie. */
  hint: boolean;
  /** Erlaubte Kategorien, leer = alle. */
  categories: string[];
}

export interface ImposterRound {
  n: number;
  category: string;
  word: string;
  /** Indizes der Imposter in `players`. */
  imposters: number[];
  /** Wer die erste Runde Hinweise beginnt. */
  starter: number;
  phase: ImposterPhase;
  /** Wer seine Rolle gesehen hat. */
  seen: number[];
  /** Abstimmung: Wähler → Verdächtiger. Leer, wenn die Runde gemeinsam entschieden hat. */
  votes: Record<string, number>;
  /** Wer die Runde verdächtigt, `null` bei Gleichstand oder noch offen. */
  accused: number | null;
  /** Hat der erwischte Imposter das Wort erraten? */
  guessed?: boolean;
  /** Punkte dieser Runde je Spieler (erst im Ergebnis). */
  gain?: number[];
}

export interface ImposterSummary {
  n: number;
  word: string;
  category: string;
  imposters: number[];
  accused: number | null;
  caught: boolean;
  guessed: boolean;
  gain: number[];
}

export interface ImposterGame extends BaseGame<PartyPlayer> {
  type: 'imposter';
  rules: ImposterRules;
  current: ImposterRound | null;
  history: ImposterSummary[];
  /** Schon gespielte Wörter, damit sie sich nicht wiederholen. */
  used: string[];
}

export interface ImposterOptions extends ImposterRules {}

export const DEFAULT_RULES: ImposterRules = { rounds: 5, imposters: 1, hint: true, categories: [] };
export const MAX_HISTORY = 40;
export const MAX_USED = 400;
const SNAP_KEYS = ['current', 'history', 'used', 'players'] as const;

export function normalizeRules(raw: unknown): ImposterRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    rounds: intOr(r['rounds'], DEFAULT_RULES.rounds, 0, 20),
    imposters: intOr(r['imposters'], DEFAULT_RULES.imposters, 1, 2),
    hint: r['hint'] === undefined ? DEFAULT_RULES.hint : !!r['hint'],
    categories: cleanCategoryIds(r['categories'], IMPOSTER_CATEGORIES),
  };
}

export function create(players: SeatedPlayer[], o: Partial<ImposterRules> = {}): ImposterGame {
  const now = Date.now();
  return {
    id: 'g' + newId(),
    type: 'imposter',
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

/** Mehr als die Hälfte der Runde darf nie Imposter sein. */
export const imposterCount = (g: ImposterGame): number => Math.max(1, Math.min(g.rules.imposters, Math.floor((g.players.length - 1) / 2)));

export const isImposter = (g: ImposterGame, pi: number): boolean => !!g.current?.imposters.includes(pi);

/** Alle Runden gespielt? Nur bei fester Rundenzahl. */
export function allPlayed(g: ImposterGame): boolean {
  return g.rules.rounds > 0 && g.history.length >= g.rules.rounds && (!g.current || g.current.phase === 'result');
}

/** Neue Runde: Wort ziehen, Imposter bestimmen. Gibt eine Fehlermeldung zurück oder `null`. */
export function startRound(g: ImposterGame, random: () => number = Math.random): string | null {
  if (g.current && g.current.phase !== 'result') return 'Die Runde läuft noch';
  if (g.rules.rounds > 0 && g.history.length >= g.rules.rounds) return 'Alle Runden sind gespielt';
  if (g.players.length < 3) return 'Mindestens 3 Spieler';

  const ids = g.rules.categories.length ? g.rules.categories : IMPOSTER_CATEGORIES;
  const cats = ids.map(wordCategory).filter((c): c is NonNullable<typeof c> => !!c);
  if (!cats.length) return 'Keine Kategorie gewählt';
  pushSnap(g, SNAP_KEYS, g.current ? 'Nächste Runde zurücknehmen' : 'Start zurücknehmen');

  const cat = pickOne(cats, random);
  let fresh = cat.words.filter(w => !g.used.includes(w));
  if (!fresh.length) {
    g.used = g.used.filter(w => !cat.words.includes(w));
    fresh = [...cat.words];
  }
  const word = pickOne(fresh, random);
  g.used = [...g.used, word].slice(-MAX_USED);
  const imposters = shuffle(
    g.players.map((_, i) => i),
    random,
  )
    .slice(0, imposterCount(g))
    .sort((a, b) => a - b);

  g.current = { n: g.history.length + 1, category: cat.name, word, imposters, starter: Math.floor(random() * g.players.length), phase: 'reveal', seen: [], votes: {}, accused: null };
  return null;
}

/** Spieler `pi` hat seine Rolle gesehen. Haben es alle, beginnt die Gesprächsrunde. */
export function see(g: ImposterGame, pi: number): void {
  const c = g.current;
  if (!c || c.phase !== 'reveal' || !g.players[pi] || c.seen.includes(pi)) return;
  c.seen.push(pi);
  if (c.seen.length >= g.players.length) c.phase = 'talk';
}

/** Ohne Warten weiter (z. B. wenn jemand nicht mehr am Tisch ist). */
export function skipReveal(g: ImposterGame): void {
  const c = g.current;
  if (c?.phase === 'reveal') c.phase = 'talk';
}

export function startVote(g: ImposterGame): string | null {
  const c = g.current;
  if (!c || c.phase !== 'talk') return 'Gerade wird nicht geredet';
  pushSnap(g, SNAP_KEYS, 'Abstimmung zurücknehmen');
  c.phase = 'vote';
  c.votes = {};
  return null;
}

/** Wer ist verdächtig? Einzige größte Stimmenzahl, sonst `null`. */
export function tally(g: ImposterGame): { accused: number | null; counts: number[] } {
  const c = g.current;
  const counts = g.players.map(() => 0);
  for (const target of Object.values(c?.votes ?? {})) counts[target]!++;
  const max = Math.max(0, ...counts);
  const tops = counts.flatMap((n, i) => (n === max && max > 0 ? [i] : []));
  return { accused: tops.length === 1 ? tops[0]! : null, counts };
}

/** Wer hat noch nicht abgestimmt? */
export const pendingVotes = (g: ImposterGame): number[] => g.players.map((_, i) => i).filter(i => g.current?.phase === 'vote' && g.current.votes[i] === undefined);

/** Spieler `voter` verdächtigt `target`. Haben alle gewählt, wird ausgewertet. */
export function vote(g: ImposterGame, voter: number, target: number): string | null {
  const c = g.current;
  if (!c || c.phase !== 'vote') return 'Gerade wird nicht abgestimmt';
  if (!g.players[voter] || !g.players[target]) return 'Ungültiger Spieler';
  if (voter === target) return 'Du kannst nicht für dich selbst stimmen';
  c.votes[voter] = target;
  if (!pendingVotes(g).length) settleVote(g, tally(g).accused);
  return null;
}

/** Ohne auf die Übrigen zu warten auswerten. */
export function closeVote(g: ImposterGame): string | null {
  const c = g.current;
  if (!c || c.phase !== 'vote') return 'Gerade wird nicht abgestimmt';
  if (!Object.keys(c.votes).length) return 'Noch niemand hat abgestimmt';
  settleVote(g, tally(g).accused);
  return null;
}

/** Die Runde hat sich gemeinsam auf einen Verdächtigen geeinigt (ein Handy für alle). */
export function accuse(g: ImposterGame, target: number): string | null {
  const c = g.current;
  if (!c || c.phase !== 'vote') return 'Gerade wird nicht abgestimmt';
  if (!g.players[target]) return 'Ungültiger Spieler';
  c.votes = {};
  settleVote(g, target);
  return null;
}

function settleVote(g: ImposterGame, accused: number | null): void {
  const c = g.current!;
  c.accused = accused;
  if (accused !== null && c.imposters.includes(accused)) c.phase = 'guess';
  else finishRound(g);
}

/** Der erwischte Imposter hat geraten – stimmte das Wort? */
export function judgeGuess(g: ImposterGame, right: boolean): string | null {
  const c = g.current;
  if (!c || c.phase !== 'guess') return 'Gerade wird nicht geraten';
  c.guessed = right;
  finishRound(g);
  return null;
}

/**
 * Punkte einer Runde. Imposter, der durchgerutscht ist: 2. Erwischter Imposter: 1, wenn er das Wort errät.
 * Wer nicht Imposter ist: 1, wenn er einen Imposter verdächtigt hat (bei gemeinsamer Entscheidung: wenn die Runde einen erwischt hat).
 */
export function scoreRound(c: ImposterRound, n: number): number[] {
  const caught = c.accused !== null && c.imposters.includes(c.accused);
  const group = !Object.keys(c.votes).length;
  return Array.from({ length: n }, (_, i) => {
    if (c.imposters.includes(i)) return c.accused === i ? (c.guessed ? 1 : 0) : 2;
    if (group) return caught ? 1 : 0;
    return c.imposters.includes(c.votes[i] ?? -1) ? 1 : 0;
  });
}

function finishRound(g: ImposterGame): void {
  const c = g.current!;
  c.gain = scoreRound(c, g.players.length);
  c.gain.forEach((x, i) => (g.players[i]!.points += x));
  c.phase = 'result';
  const caught = c.accused !== null && c.imposters.includes(c.accused);
  g.history.push({ n: c.n, word: c.word, category: c.category, imposters: [...c.imposters], accused: c.accused, caught, guessed: !!c.guessed, gain: [...c.gain] });
  if (g.history.length > MAX_HISTORY) g.history.shift();
}

export const undo = (g: ImposterGame): boolean => popSnap(g);

// ------------------------------------------------------------- Dokument bereinigen
function cleanRound(raw: unknown, n: number): ImposterRound | null {
  const c = raw as Record<string, any> | null;
  if (!c || typeof c !== 'object') return null;
  const word = cleanText(c['word'], 60);
  if (!word) return null;
  const imposters = cleanIndexes(c['imposters'], n);
  if (!imposters.length || imposters.length >= n) return null;
  const phase: ImposterPhase = ['reveal', 'talk', 'vote', 'guess', 'result'].includes(c['phase']) ? c['phase'] : 'reveal';
  const out: ImposterRound = {
    n: clampInt(c['n'], 1, 99),
    category: cleanText(c['category'], 40, '?'),
    word,
    imposters,
    starter: clampInt(c['starter'], 0, n - 1),
    phase,
    seen: cleanIndexes(c['seen'], n),
    votes: cleanIndexMap(c['votes'], n),
    accused: c['accused'] === null || c['accused'] === undefined ? null : clampInt(c['accused'], 0, n - 1),
  };
  for (const k of Object.keys(out.votes)) if (+k === out.votes[k]) delete out.votes[k];
  if (c['guessed'] !== undefined) out.guessed = !!c['guessed'];
  if (phase === 'result') {
    out.gain = Array.from({ length: n }, (_, i) => clampInt(Array.isArray(c['gain']) ? c['gain'][i] : 0, -50, 50));
  }
  return out;
}

export function sanitizeSummary(raw: unknown, n: number): ImposterSummary | null {
  const h = raw as Record<string, any> | null;
  if (!h || typeof h !== 'object') return null;
  return {
    n: clampInt(h['n'], 1, 99),
    word: cleanText(h['word'], 60, '?'),
    category: cleanText(h['category'], 40, '?'),
    imposters: cleanIndexes(h['imposters'], n),
    accused: h['accused'] === null || h['accused'] === undefined ? null : clampInt(h['accused'], 0, n - 1),
    caught: !!h['caught'],
    guessed: !!h['guessed'],
    gain: Array.from({ length: n }, (_, i) => clampInt(Array.isArray(h['gain']) ? h['gain'][i] : 0, -50, 50)),
  };
}

export function sanitize(out: ImposterGame, raw: Record<string, any>): void {
  const n = out.players.length;
  sanitizePoints(out, raw);
  out.rules = normalizeRules(raw['rules']);
  out.current = cleanRound(raw['current'], n);
  out.history = (Array.isArray(raw['history']) ? raw['history'] : []).slice(-MAX_HISTORY).map((h: unknown) => sanitizeSummary(h, n)).filter((h: ImposterSummary | null): h is ImposterSummary => !!h);
  out.used = (Array.isArray(raw['used']) ? raw['used'] : []).slice(-MAX_USED).map((w: unknown) => cleanText(w, 60)).filter(Boolean);
}
