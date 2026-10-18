import type { BaseGame, SeatedPlayer } from '../core/types';
import { newId, num, pushUndo } from '../core/util';

export type TafelMode = 'high' | 'low';

/** Eine Runde ist die Punkteliste aller Spieler, in Spielerreihenfolge. */
export type TafelRound = number[];

export type TafelUndo = { k: 'add' } | { k: 'edit'; idx: number; prev: TafelRound } | { k: 'del'; idx: number; prev: TafelRound };

export interface TafelGame extends BaseGame {
  type: 'tafel';
  mode: TafelMode;
  /** Zielpunktzahl, 0 = keine. */
  target: number;
  rounds: TafelRound[];
  undo: TafelUndo[];
}

export interface TafelOptions {
  mode: TafelMode;
  target: number;
}

export const MAX_ROUNDS = 500;

export function create(players: SeatedPlayer[], o: TafelOptions): TafelGame {
  const now = Date.now();
  return {
    id: 'g' + newId(),
    type: 'tafel',
    mode: o.mode === 'low' ? 'low' : 'high',
    target: Math.max(0, num(o.target) | 0),
    players: players.map(p => ({ pid: p.pid, name: p.name, color: p.color })),
    rounds: [],
    undo: [],
    view: 0,
    turn: 0,
    status: 'active',
    created: now,
    u: now,
  };
}

export const totals = (g: TafelGame): number[] => g.players.map((_, i) => g.rounds.reduce((a, r) => a + (+r[i]! || 0), 0));

/** Laufende Summe je Spieler: `[0, nach Runde 1, …]`. */
export const cumulative = (g: TafelGame): number[][] =>
  g.players.map((_, i) => {
    let sum = 0;
    return [0, ...g.rounds.map(r => (sum += +r[i]! || 0))];
  });

/** Wer hat die Zielpunktzahl erreicht? `null`, wenn niemand (oder kein Ziel gesetzt ist). */
export function reached(g: TafelGame): string[] | null {
  if (!g.target || !g.rounds.length) return null;
  const t = totals(g);
  const names = g.players.filter((_, i) => t[i]! >= g.target).map(p => p.name);
  return names.length ? names : null;
}

export function addRound(g: TafelGame, values: number[]): string {
  g.rounds.push(values);
  pushUndo(g.undo, { k: 'add' });
  return `Runde ${g.rounds.length} gespeichert`;
}

export function editRound(g: TafelGame, idx: number, values: number[]): string {
  pushUndo(g.undo, { k: 'edit', idx, prev: g.rounds[idx]!.slice() });
  g.rounds[idx] = values;
  return `Runde ${idx + 1} geändert`;
}

export function deleteRound(g: TafelGame, idx: number): string | null {
  const r = g.rounds[idx];
  if (!r) return null;
  pushUndo(g.undo, { k: 'del', idx, prev: r.slice() });
  g.rounds.splice(idx, 1);
  return `Runde ${idx + 1} gelöscht`;
}
