import { cleanText, intOr, popSnap, pushSnap } from '../core/party';
import type { BaseGame, SeatedPlayer } from '../core/types';
import { clampInt, isId, newId, num, shuffle } from '../core/util';

/** Ein Eintrag mit Zahlenwert, z. B. „Hamburg“ mit 1,85 Mio. Einwohnern. */
export interface HiloItem {
  name: string;
  value: number;
  /** Zusatz zur Unterscheidung, z. B. das Land. */
  note?: string;
}

/** Die gewählte Kategorie, so wie sie im Spiel festgehalten ist. */
export interface HiloCategory {
  id: string;
  name: string;
  /** Was verglichen wird, z. B. „Einwohner“. */
  metric: string;
  /** Einheit hinter der Zahl, z. B. „m“. */
  unit: string;
}

export type HiloGuess = 'more' | 'less';

export interface HiloRules {
  /** Leben je Spieler. */
  lives: number;
  /** `all`: alle tippen gleichzeitig. `turns`: reihum, nur wer dran ist. */
  mode: 'all' | 'turns';
  /** Kategorie für das nächste Spiel. */
  category: string;
}

export interface HiloPlayer extends SeatedPlayer {
  lives: number;
  score: number;
  /** Beste Serie richtiger Antworten. */
  best: number;
  streak: number;
}

export interface HiloGame extends BaseGame<HiloPlayer> {
  type: 'hilo';
  rules: HiloRules;
  cat: HiloCategory | null;
  started: boolean;
  /** Alle Einträge in Spielreihenfolge. Das Vergleichsobjekt ist `items[pos - 1]`, das gesuchte `items[pos]`. */
  items: HiloItem[];
  pos: number;
  phase: 'guess' | 'reveal';
  /** Antworten der aktuellen Frage: Spieler → Tipp. */
  answers: Record<string, HiloGuess>;
  /** Nach dem Auflösen: Spieler → richtig? */
  verdict: Record<string, boolean>;
}

export type HiloOptions = HiloRules;

export const DEFAULT_RULES: HiloRules = { lives: 3, mode: 'all', category: '' };
export const LIVES = [1, 3, 5] as const;
export const MAX_ITEMS = 150;
export const MIN_ITEMS = 12;
const SNAP_KEYS = ['pos', 'phase', 'answers', 'verdict', 'players', 'turn'] as const;

export function normalizeRules(raw: unknown): HiloRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lives = intOr(r['lives'], DEFAULT_RULES.lives, 1, 9);
  return {
    lives: (LIVES as readonly number[]).includes(lives) ? lives : DEFAULT_RULES.lives,
    mode: r['mode'] === 'turns' ? 'turns' : 'all',
    category: typeof r['category'] === 'string' && isId(r['category']) ? r['category'] : '',
  };
}

export function create(players: SeatedPlayer[], o: Partial<HiloRules> = {}): HiloGame {
  const now = Date.now();
  const rules = normalizeRules(o);
  return {
    id: 'g' + newId(),
    type: 'hilo',
    rules,
    cat: null,
    started: false,
    players: players.map(p => ({ pid: p.pid, name: p.name, color: p.color, lives: rules.lives, score: 0, best: 0, streak: 0 })),
    items: [],
    pos: 1,
    phase: 'guess',
    answers: {},
    verdict: {},
    undo: [],
    view: 0,
    turn: 0,
    status: 'active',
    created: now,
    u: now,
  };
}

export const reference = (g: HiloGame): HiloItem | null => (g.started ? (g.items[g.pos - 1] ?? null) : null);
export const challenger = (g: HiloGame): HiloItem | null => (g.started ? (g.items[g.pos] ?? null) : null);

export const alive = (g: HiloGame): number[] => g.players.map((_, i) => i).filter(i => g.players[i]!.lives > 0);

/** Wer in dieser Frage tippen darf. */
export function expected(g: HiloGame): number[] {
  const a = alive(g);
  if (g.rules.mode === 'turns') return a.includes(g.turn) ? [g.turn] : a.slice(0, 1);
  return a;
}

/** Ist das Spiel vorbei? Ein Spieler bleibt übrig (bei mehreren), niemand mehr, oder die Einträge sind aus. */
export function isOver(g: HiloGame): boolean {
  if (!g.started) return false;
  const left = alive(g).length;
  if (g.players.length > 1 ? left <= 1 : left === 0) return g.phase === 'reveal' || !g.items[g.pos];
  return g.phase === 'reveal' && !g.items[g.pos + 1];
}

/** Mischt die Einträge und legt los. Gibt eine Fehlermeldung zurück oder `null`. */
export function start(g: HiloGame, cat: HiloCategory, items: HiloItem[], random: () => number = Math.random): string | null {
  if (g.started) return 'Das Spiel läuft schon';
  const seen = new Set<string>();
  const clean = items.map(cleanItem).filter((it): it is HiloItem => !!it && !seen.has(it.name) && !!seen.add(it.name));
  if (clean.length < MIN_ITEMS) return `Zu wenige Einträge: mindestens ${MIN_ITEMS} nötig, ${clean.length} gefunden`;
  g.cat = cleanCategory(cat);
  g.items = shuffle(clean, random).slice(0, MAX_ITEMS);
  g.started = true;
  g.pos = 1;
  g.phase = 'guess';
  g.answers = {};
  g.verdict = {};
  g.undo = [];
  for (const p of g.players) Object.assign(p, { lives: g.rules.lives, score: 0, best: 0, streak: 0 });
  return null;
}

/** Spieler `pi` tippt: hat das gesuchte Objekt mehr oder weniger? Haben alle getippt, wird aufgelöst. */
export function answer(g: HiloGame, pi: number, guess: HiloGuess): string | null {
  if (!g.started || g.phase !== 'guess') return 'Gerade wird nicht getippt';
  if (!expected(g).includes(pi)) return 'Du bist gerade nicht dran';
  if (guess !== 'more' && guess !== 'less') return 'Ungültiger Tipp';
  g.answers[pi] = guess;
  if (expected(g).every(i => g.answers[i] !== undefined)) resolve(g);
  return null;
}

/** Wer noch tippen muss. */
export const waitingFor = (g: HiloGame): number[] => (g.phase === 'guess' ? expected(g).filter(i => g.answers[i] === undefined) : []);

/** Ohne auf die Übrigen zu warten auflösen: Wer nicht getippt hat, verliert ein Leben. */
export function closeGuessing(g: HiloGame): string | null {
  if (!g.started || g.phase !== 'guess') return 'Gerade wird nicht getippt';
  if (!Object.keys(g.answers).length) return 'Noch niemand hat getippt';
  resolve(g);
  return null;
}

/** Stimmt ein Tipp? Bei gleichen Werten sind beide richtig. */
export function isRight(ref: HiloItem, next: HiloItem, guess: HiloGuess): boolean {
  if (next.value === ref.value) return true;
  return guess === 'more' ? next.value > ref.value : next.value < ref.value;
}

function resolve(g: HiloGame): void {
  const ref = reference(g)!;
  const next = challenger(g)!;
  pushSnap(g, SNAP_KEYS, 'Antworten zurücknehmen');
  g.verdict = {};
  for (const pi of expected(g)) {
    const guess = g.answers[pi];
    const p = g.players[pi]!;
    const ok = guess !== undefined && isRight(ref, next, guess);
    g.verdict[pi] = ok;
    if (ok) {
      p.score++;
      p.streak++;
      p.best = Math.max(p.best, p.streak);
    } else {
      p.lives = Math.max(0, p.lives - 1);
      p.streak = 0;
    }
  }
  g.phase = 'reveal';
}

/** Nächste Frage: das aufgedeckte Objekt wird zum Vergleichsobjekt. */
export function next(g: HiloGame): string | null {
  if (!g.started || g.phase !== 'reveal') return 'Erst auflösen';
  if (isOver(g)) return 'Das Spiel ist vorbei';
  pushSnap(g, SNAP_KEYS, 'Nächste Frage zurücknehmen');
  g.pos++;
  g.phase = 'guess';
  g.answers = {};
  g.verdict = {};
  if (g.rules.mode === 'turns') {
    for (let k = 1; k <= g.players.length; k++) {
      const pi = (g.turn + k) % g.players.length;
      if (g.players[pi]!.lives > 0) {
        g.turn = pi;
        break;
      }
    }
  }
  return null;
}

export const undo = (g: HiloGame): boolean => popSnap(g);

// ------------------------------------------------------------- Dokument bereinigen
export function cleanItem(raw: unknown): HiloItem | null {
  const r = raw as Record<string, unknown> | null;
  const name = cleanText(r?.['name'], 60);
  const value = Number(r?.['value']);
  if (!name || !Number.isFinite(value)) return null;
  const note = cleanText(r?.['note'], 40);
  return { name, value, ...(note ? { note } : {}) };
}

function cleanCategory(raw: unknown): HiloCategory | null {
  const c = raw as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || !isId(c['id'])) return null;
  return { id: c['id'], name: cleanText(c['name'], 40, '?'), metric: cleanText(c['metric'], 30, '?'), unit: cleanText(c['unit'], 12) };
}

export function sanitize(out: HiloGame, raw: Record<string, any>): void {
  const n = out.players.length;
  out.rules = normalizeRules(raw['rules']);
  out.cat = cleanCategory(raw['cat']);
  out.items = (Array.isArray(raw['items']) ? raw['items'] : []).slice(0, MAX_ITEMS).map(cleanItem).filter((it: HiloItem | null): it is HiloItem => !!it);
  out.started = !!raw['started'] && !!out.cat && out.items.length >= 2;
  out.pos = clampInt(raw['pos'], 1, Math.max(1, out.items.length - 1));
  out.phase = raw['phase'] === 'reveal' ? 'reveal' : 'guess';
  const players: unknown[] = Array.isArray(raw['players']) ? raw['players'] : [];
  out.players.forEach((p, i) => {
    const q = (players[i] ?? {}) as Record<string, unknown>;
    p.lives = clampInt(q['lives'], 0, 9);
    p.score = clampInt(q['score'], 0, 999);
    p.best = clampInt(q['best'], 0, 999);
    p.streak = clampInt(q['streak'], 0, 999);
  });
  out.answers = {};
  out.verdict = {};
  if (raw['answers'] && typeof raw['answers'] === 'object') {
    for (const [k, v] of Object.entries(raw['answers'])) {
      const i = Math.round(num(k, -1));
      if (i >= 0 && i < n && (v === 'more' || v === 'less')) out.answers[i] = v;
    }
  }
  if (out.phase === 'reveal' && raw['verdict'] && typeof raw['verdict'] === 'object') {
    for (const [k, v] of Object.entries(raw['verdict'])) {
      const i = Math.round(num(k, -1));
      if (i >= 0 && i < n) out.verdict[i] = !!v;
    }
  }
  if (!out.started) out.phase = 'guess';
}
