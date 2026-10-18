import type { BaseGame, SeatedPlayer } from './types';
import { clampInt, clone, num, pushUndo } from './util';

/** Spieler eines Runden-Spiels mit Punktestand (Imposter, Wer bin ich, Wavelength …). */
export interface PartyPlayer extends SeatedPlayer {
  points: number;
}

export const MAX_POINTS = 9999;

export const partyPlayers = (players: SeatedPlayer[]): PartyPlayer[] => players.map(p => ({ pid: p.pid, name: p.name, color: p.color, points: 0 }));

/** Für die Revanche: gleiche Runde, der Nächste beginnt. */
export const rotatePlayers = (players: SeatedPlayer[]): SeatedPlayer[] => [...players.slice(1), players[0]!].map(p => ({ pid: p.pid, name: p.name, color: p.color }));

/** Punkte der Spieler aus einem fremden Dokument übernehmen. */
export function sanitizePoints(out: BaseGame<PartyPlayer>, raw: Record<string, any>): void {
  const players: unknown[] = Array.isArray(raw['players']) ? raw['players'] : [];
  out.players.forEach((p, i) => {
    p.points = clampInt((players[i] as Record<string, unknown> | undefined)?.['points'], -MAX_POINTS, MAX_POINTS);
  });
}

/** Ganze Zahl aus beliebiger Eingabe, auf [min, max] begrenzt, `fallback` bei fehlendem Wert. */
export const intOr = (value: unknown, fallback: number, min: number, max: number): number => (value === undefined || value === null ? fallback : clampInt(value, min, max));

/** Liste gültiger, eindeutiger Spielerindizes (0 bis n-1). */
export function cleanIndexes(raw: unknown, n: number): number[] {
  const out: number[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const i = Math.round(num(v, -1));
    if (i >= 0 && i < n && !out.includes(i)) out.push(i);
  }
  return out;
}

/** Zuordnung Spielerindex → Spielerindex (z. B. Stimmen), nur gültige Einträge. */
export function cleanIndexMap(raw: unknown, n: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const from = Math.round(num(k, -1));
      const to = Math.round(num(v, -1));
      if (from >= 0 && from < n && to >= 0 && to < n) out[from] = to;
    }
  }
  return out;
}

export const cleanText = (value: unknown, max: number, fallback = ''): string => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);

/**
 * Rückgängig für Runden-Spiele: Vor einem Schritt wird der Zustand der genannten Felder abgelegt, `undo` stellt ihn wieder her.
 * Nur Schritte, die das ganze Spiel voranbringen, werden so abgelegt – Eingaben einzelner Spieler am Live-Tisch nicht.
 */
export interface Snap {
  label: string;
  state: Record<string, unknown>;
}

export function pushSnap(g: BaseGame, keys: readonly string[], label: string): void {
  const state: Record<string, unknown> = {};
  for (const k of keys) state[k] = clone((g as unknown as Record<string, unknown>)[k] ?? null);
  pushUndo(g.undo as Snap[], { label, state });
}

/** Nimmt den letzten Schritt zurück. `false`, wenn nichts zurückzunehmen ist. */
export function popSnap(g: BaseGame): boolean {
  const snap = (g.undo as Snap[]).pop();
  if (!snap) return false;
  Object.assign(g, clone(snap.state));
  return true;
}

export const snapLabel = (g: BaseGame): string | null => (g.undo as Snap[])[g.undo.length - 1]?.label ?? null;
