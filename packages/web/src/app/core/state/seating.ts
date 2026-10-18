import type { SeatedPlayer } from '@spieleblock/games';
import { PLAYER_COLORS, type PlayerRecord } from './models';

/** Macht aus Spielern der Liste die Sitzplätze eines Spiels. Doppelte Farben werden getauscht, damit alle unterscheidbar sind. */
export function seatPlayers(list: PlayerRecord[]): SeatedPlayer[] {
  const used = new Set<number>();
  return list.map(p => {
    let color = p.color % PLAYER_COLORS;
    if (used.has(color)) color = Array.from({ length: PLAYER_COLORS }, (_, i) => i).find(x => !used.has(x))!;
    used.add(color);
    return { pid: p.id, name: p.name, color };
  });
}
