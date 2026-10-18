import type { BaseGame, SeatedPlayer } from '../core/types';
import { newId, pushUndo } from '../core/util';

export type WizardLength = 'full' | 'short';

export interface WizardRound {
  /** Ansagen je Spieler. */
  b: number[];
  /** Tatsächliche Stiche je Spieler; `null`, solange die Runde läuft. */
  t: number[] | null;
}

export type WizardUndo = { k: 'add' } | { k: 'edit'; idx: number; prev: WizardRound } | { k: 'del'; idx: number; prev: WizardRound };

export interface WizardGame extends BaseGame {
  type: 'wizard';
  len: WizardLength;
  rounds: WizardRound[];
  undo: WizardUndo[];
}

export interface WizardOptions {
  len: WizardLength;
}

export type WizardPhase = 'bid' | 'trick' | 'done';

/** Anzahl Runden: 60 geteilt durch die Spielerzahl, im Kurzspiel die Hälfte. */
export function totalRounds(g: { players: unknown[]; len: WizardLength }): number {
  const full = Math.max(1, Math.floor(60 / Math.max(1, g.players.length)));
  return g.len === 'short' ? Math.ceil(full / 2) : full;
}

/** 20 + 10 je Stich bei einer Punktlandung, sonst −10 je Stich Abweichung. */
export const score = (bid: number, tricks: number): number => (bid === tricks ? 20 + 10 * tricks : -10 * Math.abs(bid - tricks));

export const roundsDone = (g: WizardGame): number => g.rounds.filter(r => r.t).length;

/** Wo steht das Spiel: Ansagen für Runde `k`, Stiche für Runde `k` oder alles gespielt? */
export function state(g: WizardGame): { k: number; phase: WizardPhase } {
  const total = totalRounds(g);
  const n = g.rounds.length;
  const last = g.rounds[n - 1];
  if (last && !last.t) return { k: n, phase: 'trick' };
  if (n >= total) return { k: total, phase: 'done' };
  return { k: n + 1, phase: 'bid' };
}

/** Punktestand nach jeder abgeschlossenen Runde je Spieler: `[0, nach Runde 1, …]`. */
export function cumulative(g: WizardGame): number[][] {
  return g.players.map((_, i) => {
    let sum = 0;
    const series = [0];
    for (const r of g.rounds) {
      if (r.t) {
        sum += score(r.b[i]!, r.t[i]!);
        series.push(sum);
      }
    }
    return series;
  });
}

export function create(players: SeatedPlayer[], o: WizardOptions): WizardGame {
  const now = Date.now();
  return {
    id: 'g' + newId(),
    type: 'wizard',
    len: o.len === 'short' ? 'short' : 'full',
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

/** Arbeitskopie einer Runde im Eingabeblatt. */
export interface RoundDraft {
  isNew: boolean;
  idx: number;
  /** Rundennummer = Kartenzahl pro Spieler. */
  k: number;
  b: number[];
  t: number[] | null;
  showB: boolean;
  showT: boolean;
}

export type DraftMode = 'bid' | 'trick' | 'edit';

export function openDraft(g: WizardGame, mode: DraftMode, idx = 0): RoundDraft | null {
  const n = g.players.length;
  if (mode === 'bid') return { isNew: true, idx: g.rounds.length, k: g.rounds.length + 1, b: Array(n).fill(0), t: null, showB: true, showT: false };
  const r = g.rounds[idx];
  if (!r) return null;
  if (mode === 'trick') return { isNew: false, idx, k: idx + 1, b: r.b.slice(), t: r.b.slice(), showB: false, showT: true };
  if (r.t) return { isNew: false, idx, k: idx + 1, b: r.b.slice(), t: r.t.slice(), showB: true, showT: true };
  return { isNew: false, idx, k: idx + 1, b: r.b.slice(), t: null, showB: true, showT: false };
}

const total = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Fehlertext, falls der Entwurf nicht gespeichert werden darf. */
export function validateDraft(w: RoundDraft): string | null {
  if (w.showB && total(w.b) === w.k) return 'Die Ansagen dürfen nicht aufgehen';
  if (w.showT && total(w.t ?? []) !== w.k) return `Es müssen genau ${w.k} Stiche sein`;
  return null;
}

export function stepDraft(w: RoundDraft, field: 'b' | 't', index: number, delta: number): void {
  const arr = field === 'b' ? w.b : w.t;
  if (!arr) return;
  arr[index] = Math.max(0, Math.min(w.k, arr[index]! + delta));
}

export interface SaveOutcome {
  message: string;
  phase: WizardPhase;
  /** Die Runde wurde gerade abgeschlossen. */
  completed: boolean;
}

export function saveDraft(g: WizardGame, w: RoundDraft): SaveOutcome | null {
  if (validateDraft(w)) return null;
  let message: string;
  let completed = false;
  if (w.isNew) {
    g.rounds.push({ b: w.b.slice(), t: null });
    pushUndo(g.undo, { k: 'add' });
    message = `Ansagen für Runde ${w.k} gespeichert`;
  } else {
    const r = g.rounds[w.idx];
    if (!r) return null;
    pushUndo(g.undo, { k: 'edit', idx: w.idx, prev: { b: r.b.slice(), t: r.t ? r.t.slice() : null } });
    const had = !!r.t;
    if (w.showB) r.b = w.b.slice();
    if (w.showT && w.t) r.t = w.t.slice();
    completed = w.showT && !had;
    message = completed ? `Runde ${w.k} abgeschlossen` : `Runde ${w.k} geändert`;
  }
  return { message, phase: state(g).phase, completed };
}

export function deleteRound(g: WizardGame, idx: number): boolean {
  const r = g.rounds[idx];
  if (!r) return false;
  pushUndo(g.undo, { k: 'del', idx, prev: { b: r.b.slice(), t: r.t ? r.t.slice() : null } });
  g.rounds.splice(idx, 1);
  return true;
}
