import { pushUndo, rollDie } from '../core/util';
import type { BaseGame, SeatedPlayer } from '../core/types';
import { isKniffel, sumOf } from './dice';
import { FIELDS_BY_ID, extraKniffelValue, fieldsOf, VARIANTS, type FieldDef, type VariantDef, type VariantKey } from './fields';

export interface KniffelPlayer extends SeatedPlayer {
  scores: Record<string, number>;
  /** Anzahl Extra-Kniffel. */
  extra: number;
  /** Anzahl Felder, die in der ersten Hand gefüllt wurden (Hausregel). */
  fh: number;
  /** Nur bei übernommenen Altspielen. */
  total?: number;
}

export type KniffelInput = 'dice' | 'number';

export type KniffelUndo =
  | { kind?: undefined; pi: number; fid: string; prev?: number; extraAdded: boolean; handAdded: boolean; turn: number; view: number; dice: number[]; rolls: number }
  | { kind: 'xk'; pi: number; prevExtra: number; turn: number; view: number }
  | { kind: 'fh'; pi: number; prevFh: number; turn: number; view: number };

export interface KniffelGame extends BaseGame<KniffelPlayer> {
  type: 'kniffel';
  variant: VariantKey;
  /** Hausregel „Extra-Kniffel +50“ (nur klassisch). */
  extra: boolean;
  /** Hausregel „Erste Hand +5“. */
  firstRule: boolean;
  /** Der aktuelle Wurf stammt aus dem ersten Wurf. */
  first: boolean;
  input: KniffelInput;
  dice: number[];
  rolls: number;
  undo: KniffelUndo[];
}

export interface KniffelOptions {
  variant: VariantKey;
  extraKniffel: boolean;
  firstHand: boolean;
  input: KniffelInput;
}

export interface Totals {
  up: number;
  bon: number;
  low: number;
  kb: number;
  hand: number;
  total: number;
}

export const variantOf = (g: KniffelGame): VariantDef => VARIANTS[g.variant];
export const extraValue = (g: KniffelGame): number => extraKniffelValue(g.variant, g.extra);
export const allFields = (g: KniffelGame): FieldDef[] => fieldsOf(variantOf(g));

export function totals(g: KniffelGame, p: KniffelPlayer): Totals {
  const v = variantOf(g);
  const up = v.upper.reduce((a, f) => a + (p.scores[f.id] || 0), 0);
  const bon = v.bonus.reduce((a, b) => a + (up >= b.at ? b.pts : 0), 0);
  const low = v.lower.reduce((a, f) => a + (p.scores[f.id] || 0), 0);
  const kb = (p.extra || 0) * extraValue(g);
  const hand = (g.firstRule ? p.fh || 0 : 0) * 5;
  return { up, bon, low, kb, hand, total: up + bon + low + kb + hand };
}

export const openFields = (g: KniffelGame, p: KniffelPlayer): FieldDef[] => allFields(g).filter(f => p.scores[f.id] === undefined);
export const filledCount = (g: KniffelGame, p: KniffelPlayer): number => allFields(g).length - openFields(g, p).length;

/** Aktuelle Runde: so weit ist der Langsamste, plus eins. */
export function currentRound(g: KniffelGame): number {
  const n = allFields(g).length;
  return Math.min(n, Math.min(...g.players.map(p => filledCount(g, p))) + 1);
}

export const isDiceFull = (g: KniffelGame): boolean => g.dice.every(Boolean);

/** Welches freie Feld bringt mit dem aktuellen Wurf am meisten? (Chance nur als Notnagel.) */
export function bestField(g: KniffelGame, p: KniffelPlayer): string | null {
  let best: string | null = null;
  let bestValue = 0;
  for (const f of allFields(g)) {
    if (p.scores[f.id] !== undefined || f.id === 'ch') continue;
    const x = f.calc(g.dice);
    if (x > bestValue) {
      bestValue = x;
      best = f.id;
    }
  }
  if (!best && p.scores['ch'] === undefined) best = 'ch';
  return best;
}

export function create(players: SeatedPlayer[], o: KniffelOptions): KniffelGame {
  const now = Date.now();
  return {
    id: 'g' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'kniffel',
    variant: o.variant,
    extra: !!o.extraKniffel,
    firstRule: !!o.firstHand,
    first: false,
    input: o.input,
    players: players.map(p => ({ pid: p.pid, name: p.name, color: p.color, scores: {}, extra: 0, fh: 0 })),
    turn: 0,
    view: 0,
    dice: [0, 0, 0, 0, 0],
    rolls: 0,
    undo: [],
    status: 'active',
    created: now,
    u: now,
  };
}

export function nextTurn(g: KniffelGame, from: number): number {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (from + k) % n;
    if (openFields(g, g.players[j]!).length) return j;
  }
  return from;
}

export interface CommitOutcome {
  message: string;
  /** Alle Felder aller Spieler sind voll: das Spiel kann ausgewertet werden. */
  allFilled: boolean;
  /** Der Zug ging an einen anderen Spieler. */
  advancedTo: number | null;
}

export interface CommitOptions {
  /** Der Wert stammt aus den Würfeln der Ablage (löst Extra-Kniffel aus). */
  fromDice: boolean;
  /** Die Punkte stammen aus dem ersten Wurf (Hausregel). */
  firstHand?: boolean;
}

/**
 * Trägt einen Wert ein (`null` leert das Feld). Rückgängig-Eintrag, Extra-Kniffel, Erste Hand,
 * Zugwechsel und Ablage zurücksetzen werden hier erledigt.
 */
export function commit(g: KniffelGame, pi: number, fid: string, val: number | null, opts: CommitOptions): CommitOutcome {
  const p = g.players[pi]!;
  const f = FIELDS_BY_ID[fid]!;
  const prev = p.scores[fid];
  const wasEmpty = prev === undefined;
  const kb = extraValue(g);

  let extraAdded = false;
  if (opts.fromDice && kb && isKniffel(g.dice) && p.scores['kn'] === 50 && fid !== 'kn') {
    p.extra = (p.extra || 0) + 1;
    extraAdded = true;
  }
  let handAdded = false;
  if (opts.firstHand && g.firstRule && wasEmpty && (val ?? 0) > 0) {
    p.fh = (p.fh || 0) + 1;
    handAdded = true;
  }

  pushUndo(g.undo, { pi, fid, prev, extraAdded, handAdded, turn: g.turn, view: g.view, dice: g.dice.slice(), rolls: g.rolls });
  if (val === null) delete p.scores[fid];
  else p.scores[fid] = val;
  if (wasEmpty && val !== null) {
    g.dice = [0, 0, 0, 0, 0];
    g.rolls = 0;
    g.first = false;
  }

  let message = val === null ? `${f.name} geleert` : val === 0 ? `${f.name} gestrichen` : `${val} bei ${f.name}`;
  if (extraAdded) message += ` · Extra-Kniffel +${kb}`;
  if (handAdded) message += ' · +5 erste Hand';

  const finished = g.status === 'finished';
  if (!finished && g.players.every(pl => openFields(g, pl).length === 0)) return { message, allFilled: true, advancedTo: null };

  let advancedTo: number | null = null;
  if (wasEmpty && val !== null && pi === g.turn && !finished) {
    const nt = nextTurn(g, pi);
    g.turn = nt;
    if (nt !== pi) {
      advancedTo = nt;
      message += ` · ${g.players[nt]!.name} ist dran`;
    }
  }
  return { message, allFilled: false, advancedTo };
}

/** Würfelt alle leeren Plätze. Gibt die Plätze zurück, die neu gewürfelt wurden. */
export function roll(g: KniffelGame, dieRoll: () => number = rollDie): number[] {
  if (g.rolls >= 3) return [];
  const fresh = g.rolls === 0 && g.dice.every(x => !x);
  const rolled: number[] = [];
  g.dice = g.dice.map((x, i) => {
    if (x) return x;
    rolled.push(i);
    return dieRoll();
  });
  if (!rolled.length) return [];
  g.rolls++;
  if (g.rolls > 1) g.first = false;
  else if (fresh) g.first = true;
  return rolled;
}

/** Legt die Augenzahl auf den ersten freien Platz. */
export function setDie(g: KniffelGame, face: number): void {
  const k = g.dice.indexOf(0);
  if (k >= 0) g.dice[k] = face;
}

export function removeDie(g: KniffelGame, index: number): void {
  g.dice[index] = 0;
}

export function clearDice(g: KniffelGame): void {
  g.dice = [0, 0, 0, 0, 0];
  g.rolls = 0;
  g.first = false;
}

/** Zähler für Extra-Kniffel (`kind: 'xk'`) und erste Hand (`kind: 'fh'`) ändern. Gibt den neuen Wert zurück oder `null`, wenn nichts passiert. */
export function stepCounter(g: KniffelGame, pi: number, kind: 'xk' | 'fh', delta: number): number | null {
  const p = g.players[pi]!;
  const current = (kind === 'xk' ? p.extra : p.fh) || 0;
  const next = Math.max(0, current + delta);
  if (next === current) return null;
  pushUndo(g.undo, kind === 'xk' ? { kind, pi, prevExtra: current, turn: g.turn, view: g.view } : { kind, pi, prevFh: current, turn: g.turn, view: g.view });
  if (kind === 'xk') p.extra = next;
  else p.fh = next;
  return next;
}

export function undo(g: KniffelGame): { fieldId?: string; player: number } | null {
  const u = g.undo.pop();
  if (!u) return null;
  const p = g.players[u.pi]!;
  if (u.kind === 'xk') p.extra = u.prevExtra;
  else if (u.kind === 'fh') p.fh = u.prevFh;
  else {
    if (u.prev === undefined) delete p.scores[u.fid];
    else p.scores[u.fid] = u.prev;
    if (u.extraAdded) p.extra--;
    if (u.handAdded) p.fh = Math.max(0, (p.fh || 0) - 1);
    g.dice = u.dice;
    g.rolls = u.rolls;
  }
  g.first = false;
  g.turn = u.turn;
  g.view = u.pi;
  return { fieldId: u.kind ? undefined : u.fid, player: u.pi };
}

export const diceSum = (g: KniffelGame): number => sumOf(g.dice.filter(Boolean));
