import type { BaseGame, SeatedPlayer } from '../core/types';
import { clampInt, isId, newId, num, pushUndo, shuffle } from '../core/util';

/** Eine Song-Karte. Die Spotify-Adresse ergibt sich aus der ID (`trackUri`). */
export interface HitsterCard {
  /** Spotify-Track-ID (Film-Zeitstrahl: `m<TMDB-ID>` oder `f-<Kürzel>`). */
  id: string;
  title: string;
  /** Interpret; beim Film der Originaltitel oder leer. */
  artist: string;
  year: number;
  /** Bild-ID des Albumcovers bei Spotify (`i.scdn.co/image/<ID>`) oder Dateiname des Plakats bei TMDB (`abc.jpg`). Fehlt, wenn es keines gibt. */
  cover?: string;
}

export interface HitsterPlayer extends SeatedPlayer {
  /** Der Zeitstrahl, immer nach Jahr sortiert. */
  line: HitsterCard[];
  tokens: number;
}

/**
 * `listen`: Karte gezogen, noch nicht gelegt. `placed`: Platz gewählt, der Spieler kann ihn noch ändern.
 * `veto`: Platz bestätigt, die anderen entscheiden über einen Einspruch. `revealed`: aufgelöst, Zug noch nicht beendet.
 */
export type HitsterPhase = 'listen' | 'placed' | 'veto' | 'revealed';

export interface HitsterCurrent {
  card: HitsterCard;
  phase: HitsterPhase;
  /** Einfügeplatz im Zeitstrahl des Spielers am Zug: 0 = vor der ersten Karte, `line.length` = hinter der letzten. */
  slot: number | null;
  /** Nur nach dem Auflösen: richtig gelegt? */
  ok?: boolean;
  /** Einsprüche: Spieler (Index in `players`) → gewählter Platz. Als Zuordnung statt Liste, damit gleichzeitige Einsprüche am Live-Tisch sich nicht überschreiben. */
  vetoes?: Record<string, number>;
  /** Spieler, die „kein Einspruch“ gesagt haben. */
  passed?: Record<string, true>;
  /** Nur nach dem Auflösen: Wer die falsch gelegte Karte per Einspruch gewonnen hat (Index in `players`). */
  stolenBy?: number;
  /** Token für Titel und Interpret wurde für diese Karte schon vergeben. */
  guessed?: boolean;
}


export interface DeckRef {
  /** Spotify-Playlist-ID. */
  id: string;
  name: string;
}

/** Eine gemerkte Playlist in der Bibliothek. */
export interface DeckInfo extends DeckRef {
  /** Spielbare Songs beim letzten Import. */
  count: number;
  /** Zuletzt importiert (ms). */
  at: number;
  /** Titelbild der Playlist (nur Adressen von Spotifys Bilderservern). */
  image?: string;
}

/** Woher ein Jahr stammt: Spotify (Albumdatum), MusicBrainz (frühestes Erscheinen) oder von Hand. */
export type YearSource = 'spotify' | 'mb' | 'user';

export interface YearEntry {
  y: number;
  src: YearSource;
  /** Quellen widersprechen sich oder stützen sich auf einen einzelnen Treffer: bitte prüfen. */
  unsure?: boolean;
}

export interface HitsterRules {
  /** Karten im Zeitstrahl, mit denen man gewinnt. */
  goal: number;
  startTokens: number;
  /** Token für „Song überspringen“. */
  skipCost: number;
  /** Token für Titel und Interpret richtig genannt. */
  guessReward: number;
  /** Token für „Karte kaufen“, 0 = aus. */
  buyCost: number;
  /** Token für einen Einspruch gegen die Platzierung eines anderen, 0 = aus. */
  vetoCost: number;
}

export interface HitsterOptions extends HitsterRules {
  /** Playlist für das nächste Spiel. */
  source: DeckRef | null;
  /** Gemerkte Playlists. */
  decks: DeckInfo[];
  /** Geprüfte Jahre je Spotify-Track-ID. Gilt für alle Playlists. */
  years: Record<string, YearEntry>;
}

export type HitsterUndo =
  | { k: 'draw' }
  | { k: 'place'; prev: number | null }
  | { k: 'confirm'; auto: boolean }
  | { k: 'veto'; pi: number; cost: number; auto: boolean }
  | { k: 'pass'; pi: number; auto: boolean }
  | { k: 'close'; pis: number[] }
  | { k: 'end'; turn: number; current: HitsterCurrent }
  | { k: 'skip'; cost: number }
  | { k: 'guess'; pi: number; delta: number }
  | { k: 'buy'; pi: number; id: string; cost: number }
  | { k: 'year'; id: string; prev: number };

/** Die Zeitstrahl-Engine gibt es zweimal: mit Musik (`hitster`) und mit Filmen (`film`). */
export type TimelineKind = 'hitster' | 'film';

export interface HitsterGame extends BaseGame<HitsterPlayer> {
  type: TimelineKind;
  rules: HitsterRules;
  /** Aus welcher Playlist der Stapel gebaut wird. */
  source: DeckRef | null;
  /** Stapel gemischt und Startkarten verteilt? Davor wartet das Spiel auf `start`. */
  started: boolean;
  deck: HitsterCard[];
  discard: HitsterCard[];
  current: HitsterCurrent | null;
  undo: HitsterUndo[];
}

export const DEFAULT_RULES: HitsterRules = { goal: 10, startTokens: 2, skipCost: 1, guessReward: 1, buyCost: 3, vetoCost: 1 };
/** Bild-IDs bei Spotify sind 40 Hex-Zeichen. */
export const COVER_RE = /^[a-f0-9]{40}$/;
/** Plakate bei TMDB heißen z. B. `qJ2tW6WMUDux911r6m7haRef0WH.jpg`. */
export const POSTER_RE = /^[A-Za-z0-9_-]{8,60}\.(jpg|png|webp)$/;
export const MAX_CARDS = 400;
export const MAX_DECKS = 30;
export const PLAYLIST_IMAGE_RE = /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\/[^\s"'()<>]{1,200}$/i;
export const MAX_YEARS = 2000;
export const MAX_LINE = 100;
export const MAX_TOKENS = 99;
export const MIN_YEAR = 1900;
export const maxYear = (): number => new Date().getFullYear() + 1;

/** Adresse des Covers oder `null`. Die Bilder liefert das Spotify-CDN. */
export const coverUrl = (card: Pick<HitsterCard, 'cover'>): string | null => {
  if (!card.cover) return null;
  return POSTER_RE.test(card.cover) ? `https://image.tmdb.org/t/p/w342/${card.cover}` : `https://i.scdn.co/image/${card.cover}`;
};

export const trackUri = (card: Pick<HitsterCard, 'id'>): string => `spotify:track:${card.id}`;

export function normalizeRules(raw: unknown, film = false): HitsterRules {
  const r = (raw ?? {}) as Partial<Record<keyof HitsterRules, unknown>>;
  const pick = (v: unknown, fallback: number, min: number, max: number) => (v === undefined ? fallback : clampInt(v, min, max));
  return {
    goal: pick(r.goal, DEFAULT_RULES.goal, 3, 30),
    startTokens: pick(r.startTokens, DEFAULT_RULES.startTokens, 0, 10),
    skipCost: pick(r.skipCost, DEFAULT_RULES.skipCost, 0, 5),
    guessReward: film ? 0 : pick(r.guessReward, DEFAULT_RULES.guessReward, 0, 3),
    buyCost: pick(r.buyCost, DEFAULT_RULES.buyCost, 0, 10),
    vetoCost: pick(r.vetoCost, DEFAULT_RULES.vetoCost, 0, 3),
  };
}

export function normalizeDeckRef(raw: unknown): DeckRef | null {
  const d = raw as Partial<DeckRef> | null | undefined;
  if (!d || !isId(d.id)) return null;
  return { id: d.id, name: String(d.name ?? '').slice(0, 80) || 'Playlist' };
}

const SOURCE_PRIORITY: Record<YearSource, number> = { user: 0, mb: 1, spotify: 2 };

export function cleanYear(raw: unknown): YearEntry | null {
  const e = raw as Partial<Record<keyof YearEntry, unknown>> | null;
  if (!e || typeof e !== 'object') return null;
  const y = Math.round(num(e.y));
  if (y < MIN_YEAR || y > maxYear()) return null;
  const src: YearSource = e.src === 'user' ? 'user' : e.src === 'mb' ? 'mb' : 'spotify';
  return { y, src, ...(e.unsure && src !== 'user' ? { unsure: true } : {}) };
}

/** Gültige Jahres-Zuordnung, begrenzt. Eigene Korrekturen bleiben zuletzt übrig, wenn es zu viele werden. */
export function normalizeYears(raw: unknown): Record<string, YearEntry> {
  const entries: [string, YearEntry][] = [];
  if (raw && typeof raw === 'object') {
    for (const [id, value] of Object.entries(raw)) {
      const e = isId(id) ? cleanYear(value) : null;
      if (e) entries.push([id, e]);
    }
  }
  entries.sort((a, b) => SOURCE_PRIORITY[a[1].src] - SOURCE_PRIORITY[b[1].src]);
  return Object.fromEntries(entries.slice(0, MAX_YEARS));
}

export function normalizeDecks(raw: unknown): DeckInfo[] {
  const seen = new Set<string>();
  const out: DeckInfo[] = [];
  for (const d of Array.isArray(raw) ? raw : []) {
    const ref = normalizeDeckRef(d);
    if (!ref || seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push({ ...ref, count: clampInt(d?.count, 0, 10000), at: num(d?.at), ...(typeof d?.image === 'string' && PLAYLIST_IMAGE_RE.test(d.image) ? { image: d.image } : {}) });
    if (out.length >= MAX_DECKS) break;
  }
  return out;
}

/** Macht aus beliebiger Eingabe eine gültige Karte oder `null`. */
export function cleanCard(raw: unknown): HitsterCard | null {
  const c = raw as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || !isId(c['id'])) return null;
  const year = Math.round(num(c['year']));
  if (year < MIN_YEAR || year > maxYear()) return null;
  const card: HitsterCard = { id: c['id'], title: String(c['title'] ?? '?').slice(0, 80), artist: String(c['artist'] ?? '?').slice(0, 60), year };
  if (typeof c['cover'] === 'string' && (COVER_RE.test(c['cover']) || POSTER_RE.test(c['cover']))) card.cover = c['cover'];
  return card;
}

export function cleanCards(raw: unknown, max: number): HitsterCard[] {
  return (Array.isArray(raw) ? raw : []).slice(0, max).map(cleanCard).filter((c): c is HitsterCard => !!c);
}

export function create(players: SeatedPlayer[], o: Partial<HitsterOptions> = {}, type: TimelineKind = 'hitster'): HitsterGame {
  const now = Date.now();
  const rules = normalizeRules(o);
  // Bei Filmen gibt es keinen Titel zu raten: Der steht auf der Karte.
  if (type === 'film') rules.guessReward = 0;
  return {
    id: 'g' + newId(),
    type,
    rules,
    source: normalizeDeckRef(o.source),
    started: false,
    players: players.map(p => ({ pid: p.pid, name: p.name, color: p.color, line: [], tokens: rules.startTokens })),
    deck: [],
    discard: [],
    current: null,
    undo: [],
    view: 0,
    turn: 0,
    status: 'active',
    created: now,
    u: now,
  };
}

export { shuffle };

/** Position, an der ein Jahr in einen sortierten Zeitstrahl passt (hinter gleichen Jahren). */
export function insertionIndex(line: readonly HitsterCard[], year: number): number {
  let i = line.length;
  while (i > 0 && line[i - 1]!.year > year) i--;
  return i;
}

/** Liegt die Karte an diesem Platz richtig? Gleiche Jahre zählen immer als richtig. */
export function fits(line: readonly HitsterCard[], slot: number, year: number): boolean {
  if (slot < 0 || slot > line.length) return false;
  const before = line[slot - 1];
  const after = line[slot];
  return (!before || before.year <= year) && (!after || year <= after.year);
}

export const active = (g: HitsterGame): HitsterPlayer => g.players[g.turn]!;

/** Wer hat das Ziel erreicht? `null`, wenn niemand. */
export function reached(g: HitsterGame): string[] | null {
  if (!g.started) return null;
  const names = g.players.filter(p => p.line.length >= g.rules.goal).map(p => p.name);
  return names.length ? names : null;
}

/**
 * Mischt die Karten, teilt jedem Spieler eine Startkarte aus und legt den Rest als Stapel hin.
 * Gibt eine Fehlermeldung zurück, wenn es nicht geht.
 */
export function start(g: HitsterGame, cards: HitsterCard[], random: () => number = Math.random): string | null {
  if (g.started) return 'Das Spiel läuft schon';
  const seen = new Set<string>();
  const unique = cleanCards(cards, Infinity).filter(c => !seen.has(c.id) && !!seen.add(c.id));
  const needed = g.players.length + 5;
  if (unique.length < needed) return `Zu wenige ${g.type === 'film' ? 'Filme' : 'Songs'}: mindestens ${needed} nötig, ${unique.length} gefunden`;

  // Erst mischen, dann kürzen: sonst käme von einer langen Playlist immer nur der Anfang ins Spiel
  const mixed = shuffle(unique, random).slice(0, MAX_CARDS);
  for (const p of g.players) {
    p.line = [mixed.pop()!];
    p.tokens = g.rules.startTokens;
  }
  g.deck = mixed;
  g.discard = [];
  g.current = null;
  g.started = true;
  g.turn = 0;
  g.undo = [];
  return null;
}

/** Zieht die oberste Karte für den Spieler am Zug. */
export function draw(g: HitsterGame): string | null {
  if (!g.started || g.current) return null;
  const card = g.deck.shift();
  if (!card) return null;
  g.current = { card, phase: 'listen', slot: null };
  pushUndo(g.undo, { k: 'draw' });
  return 'Neue Karte';
}

/** Wählt den Platz im Zeitstrahl. Solange nicht aufgelöst ist, darf er geändert werden. */
export function place(g: HitsterGame, slot: number): boolean {
  const c = g.current;
  if (!c || (c.phase !== 'listen' && c.phase !== 'placed')) return false;
  const line = active(g).line;
  if (!Number.isInteger(slot) || slot < 0 || slot > line.length) return false;
  pushUndo(g.undo, { k: 'place', prev: c.slot });
  c.slot = slot;
  c.phase = 'placed';
  return true;
}

/**
 * Wertet die gelegte Karte. Richtig: sie kommt in den Zeitstrahl des Spielers am Zug. Falsch: Wer per Einspruch
 * einen passenden Platz gewählt hat (der Erste reihum nach dem Spieler am Zug), bekommt sie in den eigenen
 * Zeitstrahl, sonst ist sie raus.
 */
function applyReveal(g: HitsterGame): { ok: boolean; by: number | null } {
  const c = g.current!;
  const line = active(g).line;
  const ok = fits(line, c.slot!, c.card.year);
  let by: number | null = null;
  if (ok) line.splice(c.slot!, 0, c.card);
  else {
    const n = g.players.length;
    for (let k = 1; k < n && by === null; k++) {
      const pi = (g.turn + k) % n;
      const slot = c.vetoes?.[pi];
      if (slot !== undefined && fits(line, slot, c.card.year)) by = pi;
    }
    if (by !== null) {
      const mine = g.players[by]!.line;
      mine.splice(insertionIndex(mine, c.card.year), 0, c.card);
      c.stolenBy = by;
    } else g.discard.push(c.card);
  }
  c.phase = 'revealed';
  c.ok = ok;
  return { ok, by };
}

/** Nimmt eine Auflösung zurück. `back` ist die Phase davor (`placed`, oder `veto`, wenn die Einspruchsrunde lief). */
function unapplyReveal(g: HitsterGame, back: 'placed' | 'veto'): void {
  const c = g.current!;
  const take = (line: HitsterCard[]) => {
    const at = line.findIndex(x => x.id === c.card.id);
    if (at >= 0) line.splice(at, 1);
  };
  if (c.ok) take(active(g).line);
  else if (c.stolenBy !== undefined) take(g.players[c.stolenBy]!.line);
  else g.discard.pop();
  c.phase = back;
  delete c.ok;
  delete c.stolenBy;
}

/** Meldung zum Ergebnis einer aufgelösten Karte. */
export function revealMessage(g: HitsterGame): string {
  const c = g.current;
  if (!c || c.phase !== 'revealed') return '';
  if (c.ok) return `Richtig! ${c.card.year}`;
  return c.stolenBy !== undefined ? `${c.card.year}: ${g.players[c.stolenBy]!.name} gewinnt die Karte per Einspruch` : `Leider falsch: ${c.card.year}`;
}

/** Gibt es überhaupt jemanden, der widersprechen könnte? Sonst entfällt die Einspruchsrunde. */
function vetoPossible(g: HitsterGame): boolean {
  return g.rules.vetoCost > 0 && g.players.some((p, i) => i !== g.turn && p.tokens >= g.rules.vetoCost);
}

/**
 * Wer in der Einspruchsrunde noch entscheiden muss: nicht der Spieler am Zug, nicht wer schon Einspruch eingelegt oder
 * „kein Einspruch“ gesagt hat, und nur, wer sich einen Einspruch leisten kann (alle anderen widersprechen ohnehin nicht).
 */
export function pendingVeto(g: HitsterGame): number[] {
  const c = g.current;
  if (!c || c.phase !== 'veto') return [];
  return g.players.map((_, i) => i).filter(i => i !== g.turn && c.vetoes?.[i] === undefined && !c.passed?.[i] && g.players[i]!.tokens >= g.rules.vetoCost);
}

/** Haben alle entschieden, wird automatisch aufgelöst. Gibt zurück, ob aufgelöst wurde. */
function settle(g: HitsterGame): boolean {
  if (pendingVeto(g).length) return false;
  applyReveal(g);
  const last = g.undo[g.undo.length - 1];
  // Aktion und automatische Auflösung sind ein Schritt: ein Rückgängig nimmt beides zurück
  if (last?.k === 'veto' || last?.k === 'pass') last.auto = true;
  return true;
}

/**
 * Der Spieler am Zug bestätigt seinen Platz. Danach können die anderen widersprechen. Gibt es niemanden, der sich einen
 * Einspruch leisten kann (oder sind Einsprüche aus), wird sofort aufgelöst. Gibt `null` zurück, wenn nichts zu bestätigen ist.
 */
export function confirm(g: HitsterGame): { resolved: boolean } | null {
  const c = g.current;
  if (!c || c.phase !== 'placed' || c.slot === null) return null;
  if (vetoPossible(g)) {
    c.phase = 'veto';
    pushUndo(g.undo, { k: 'confirm', auto: false });
    return { resolved: false };
  }
  applyReveal(g);
  pushUndo(g.undo, { k: 'confirm', auto: true });
  return { resolved: true };
}

/**
 * Einspruch: Ein anderer Spieler setzt Token ein und nennt einen anderen Platz im Zeitstrahl des Spielers am Zug.
 * Geht nur in der Einspruchsrunde, einmal je Spieler, und jeder Platz nur einmal. Das Token ist weg, egal wie es ausgeht.
 * Haben danach alle entschieden, wird aufgelöst. Gibt eine Fehlermeldung zurück oder `null`, wenn es geklappt hat.
 */
export function veto(g: HitsterGame, pi: number, slot: number): string | null {
  const c = g.current;
  const cost = g.rules.vetoCost;
  if (cost <= 0) return 'Einsprüche sind ausgeschaltet';
  if (!c || c.phase !== 'veto' || c.slot === null) return 'Einspruch geht erst, wenn der Platz bestätigt ist';
  const p = g.players[pi];
  if (!p || pi === g.turn) return 'Der Spieler am Zug kann keinen Einspruch einlegen';
  if (c.vetoes?.[pi] !== undefined || c.passed?.[pi]) return `${p.name} hat schon entschieden`;
  if (p.tokens < cost) return 'Zu wenige Token';
  if (!Number.isInteger(slot) || slot < 0 || slot > active(g).line.length) return 'Ungültiger Platz';
  if (slot === c.slot || Object.values(c.vetoes ?? {}).includes(slot)) return 'Dieser Platz ist schon belegt';
  p.tokens -= cost;
  (c.vetoes ??= {})[pi] = slot;
  pushUndo(g.undo, { k: 'veto', pi, cost, auto: false });
  settle(g);
  return null;
}

/** „Kein Einspruch“: Der Spieler verzichtet. Haben danach alle entschieden, wird aufgelöst. Gibt eine Fehlermeldung oder `null` zurück. */
export function pass(g: HitsterGame, pi: number): string | null {
  const c = g.current;
  if (!c || c.phase !== 'veto') return 'Gerade läuft keine Einspruchsrunde';
  const p = g.players[pi];
  if (!p || pi === g.turn) return 'Der Spieler am Zug entscheidet hier nichts';
  if (c.vetoes?.[pi] !== undefined || c.passed?.[pi]) return `${p.name} hat schon entschieden`;
  (c.passed ??= {})[pi] = true;
  pushUndo(g.undo, { k: 'pass', pi, auto: false });
  settle(g);
  return null;
}

/** Beendet die Einspruchsrunde, ohne auf die Übrigen zu warten (z. B. weil jemand nicht mehr am Tisch ist). Wer noch nicht entschieden hat, widerspricht nicht. */
export function closeVeto(g: HitsterGame): string | null {
  const c = g.current;
  if (!c || c.phase !== 'veto') return 'Gerade läuft keine Einspruchsrunde';
  const pis = pendingVeto(g);
  for (const pi of pis) (c.passed ??= {})[pi] = true;
  pushUndo(g.undo, { k: 'close', pis });
  applyReveal(g);
  return null;
}

/** Beendet den Zug und gibt an den nächsten Spieler weiter. */
export function endTurn(g: HitsterGame): { next: number; reached: string[] | null } | null {
  const c = g.current;
  if (!c || c.phase !== 'revealed') return null;
  pushUndo(g.undo, { k: 'end', turn: g.turn, current: { ...c } });
  const winners = reached(g);
  g.current = null;
  g.turn = (g.turn + 1) % g.players.length;
  return { next: g.turn, reached: winners };
}

/** Song überspringen: kostet Token, die Karte wandert auf den Ablagestapel und eine neue wird gezogen. */
export function skip(g: HitsterGame): string | null {
  const c = g.current;
  const p = active(g);
  if (!c || c.phase !== 'listen') return 'Überspringen geht nur, bevor die Karte gelegt ist';
  if (p.tokens < g.rules.skipCost) return 'Zu wenige Token';
  if (!g.deck.length) return 'Der Stapel ist leer';
  p.tokens -= g.rules.skipCost;
  g.discard.push(c.card);
  g.current = { card: g.deck.shift()!, phase: 'listen', slot: null };
  pushUndo(g.undo, { k: 'skip', cost: g.rules.skipCost });
  return null;
}

/** Titel und Interpret richtig genannt: Token für den Spieler am Zug. Erst nach dem Auflösen (dann ist es nachprüfbar) und einmal je Karte. */
export function rewardGuess(g: HitsterGame): string | null {
  const c = g.current;
  if (!g.started || !c || c.phase !== 'revealed' || c.guessed) return null;
  const p = active(g);
  const delta = Math.min(g.rules.guessReward, MAX_TOKENS - p.tokens);
  if (delta <= 0) return null;
  p.tokens += delta;
  c.guessed = true;
  pushUndo(g.undo, { k: 'guess', pi: g.turn, delta });
  return `${p.name}: +${delta} Token`;
}

/** Kauft die oberste Karte des Stapels und legt sie an die richtige Stelle. */
export function buyCard(g: HitsterGame): string | null {
  const p = active(g);
  const cost = g.rules.buyCost;
  if (!g.started || cost <= 0) return null;
  if (g.current && g.current.phase !== 'listen') return 'Kaufen geht nur vor dem Legen';
  if (p.tokens < cost) return 'Zu wenige Token';
  const card = g.deck.shift();
  if (!card) return 'Der Stapel ist leer';
  p.tokens -= cost;
  p.line.splice(insertionIndex(p.line, card.year), 0, card);
  pushUndo(g.undo, { k: 'buy', pi: g.turn, id: card.id, cost });
  return `${card.title} · ${card.year} gekauft`;
}

/** Sucht eine Karte überall im Spiel. */
function findCards(g: HitsterGame, id: string): HitsterCard[] {
  const all = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.line)];
  if (g.current) all.push(g.current.card);
  return all.filter(c => c.id === id);
}

function setYear(g: HitsterGame, id: string, year: number): void {
  const c = g.current;
  const redo = !!c && c.card.id === id && c.phase === 'revealed';
  if (redo) unapplyReveal(g, 'placed');
  for (const card of findCards(g, id)) card.year = year;
  for (const p of g.players) p.line.sort((a, b) => a.year - b.year);
  if (redo) applyReveal(g);
}

/** Korrigiert das Jahr einer Karte (z. B. wenn die Quelle falsch lag). Eine schon aufgelöste Karte wird neu bewertet. */
export function fixYear(g: HitsterGame, id: string, year: number): string | null {
  const y = Math.round(num(year));
  if (y < MIN_YEAR || y > maxYear()) return null;
  const card = findCards(g, id)[0];
  if (!card || card.year === y) return null;
  pushUndo(g.undo, { k: 'year', id, prev: card.year });
  setYear(g, id, y);
  return `${card.title}: ${y}`;
}

export function undo(g: HitsterGame): string | null {
  const u = g.undo.pop();
  if (!u) return null;
  const c = g.current;
  const p = active(g);
  switch (u.k) {
    case 'draw':
      if (c) g.deck.unshift(c.card);
      g.current = null;
      break;
    case 'place':
      if (c) {
        c.slot = u.prev;
        c.phase = u.prev === null ? 'listen' : 'placed';
      }
      break;
    case 'confirm':
      if (c) {
        if (c.phase === 'revealed') unapplyReveal(g, 'placed');
        c.phase = 'placed';
        delete c.vetoes;
        delete c.passed;
      }
      break;
    case 'end':
      // Die Karte steht schon im Zeitstrahl bzw. auf dem Ablagestapel, nur der Zug geht zurück.
      g.turn = u.turn;
      g.current = u.current;
      break;
    case 'skip':
      if (c && g.discard.length) {
        g.deck.unshift(c.card);
        g.current = { card: g.discard.pop()!, phase: 'listen', slot: null };
        p.tokens = Math.min(MAX_TOKENS, p.tokens + u.cost);
      }
      break;
    case 'guess':
      g.players[u.pi]!.tokens = Math.max(0, g.players[u.pi]!.tokens - u.delta);
      if (c) delete c.guessed;
      break;
    case 'veto': {
      const q = g.players[u.pi];
      if (c) {
        if (c.phase === 'revealed') unapplyReveal(g, 'veto');
        if (c.vetoes) {
          delete c.vetoes[u.pi];
          if (!Object.keys(c.vetoes).length) delete c.vetoes;
        }
      }
      if (q) q.tokens = Math.min(MAX_TOKENS, q.tokens + u.cost);
      break;
    }
    case 'pass':
    case 'close': {
      if (c) {
        if (c.phase === 'revealed') unapplyReveal(g, 'veto');
        for (const pi of u.k === 'pass' ? [u.pi] : u.pis) delete c.passed?.[pi];
        if (c.passed && !Object.keys(c.passed).length) delete c.passed;
      }
      break;
    }
    case 'buy': {
      const q = g.players[u.pi]!;
      const at = q.line.findIndex(x => x.id === u.id);
      if (at >= 0) g.deck.unshift(...q.line.splice(at, 1));
      q.tokens = Math.min(MAX_TOKENS, q.tokens + u.cost);
      break;
    }
    case 'year':
      setYear(g, u.id, u.prev);
      break;
  }
  return u.k;
}
