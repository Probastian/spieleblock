import type { BaseGame } from '@spieleblock/games';

/** Der Spieler (Index in `players`), dem dieses Gerät am Live-Tisch gehört – sonst `null` (lokales Spiel oder Tisch ohne Platz). */
export function mineIndex(g: BaseGame): number | null {
  if (!g.tbl || g.tblSeat == null) return null;
  const i = g.players.findIndex(p => p.color === g.tblSeat);
  return i >= 0 ? i : null;
}

/** Darf dieses Gerät für Spieler `pi` handeln? Lokal und ohne Platz: ja, für alle. */
export function canActAs(g: BaseGame, pi: number): boolean {
  const mine = mineIndex(g);
  return mine === null || mine === pi;
}

/** Spielt dieses Gerät als einzelner Spieler an einem Live-Tisch? Dann sehen andere Geräte geheime Infos nicht. */
export const isSeated = (g: BaseGame): boolean => mineIndex(g) !== null;

/** Ordnet Leben/Punkte/Anzeigen: zuerst der eigene Spieler, dann die anderen in Reihenfolge. */
export function orderFor(g: BaseGame): number[] {
  const all = g.players.map((_, i) => i);
  const m = mineIndex(g);
  return m === null ? all : [m, ...all.filter(i => i !== m)];
}
