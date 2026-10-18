import type { EngineLookup } from './engine';
import type { BaseGame } from './types';
import { num } from './util';

export interface PlayerKeyStats {
  label: string;
  games: number;
  wins: number;
  best: number | null;
  higherIsBetter: boolean;
}

export interface PlayerStats {
  games: number;
  wins: number;
  last: number;
  keys: Record<string, PlayerKeyStats>;
}

export interface RecordEntry {
  key: string;
  label: string;
  total: number;
  name: string;
  date: number;
}

const playable = (games: BaseGame[], engineOf: EngineLookup) => games.filter(g => g && !g.del && engineOf(g.type));
const finishedTime = (g: BaseGame) => num(g.finishedAt || g.u);

export function sortFinished(games: BaseGame[], engineOf: EngineLookup): BaseGame[] {
  return playable(games, engineOf)
    .filter(g => g.status === 'finished')
    .sort((a, b) => finishedTime(b) - finishedTime(a));
}

export function sortActive(games: BaseGame[], engineOf: EngineLookup): BaseGame[] {
  return playable(games, engineOf)
    .filter(g => g.status !== 'finished')
    .sort((a, b) => num(b.u) - num(a.u));
}

/** Bilanz je Spieler (über die Spieler-ID), aufgeschlüsselt nach Spielart. */
export function computeStats(games: BaseGame[], engineOf: EngineLookup): Record<string, PlayerStats> {
  const out: Record<string, PlayerStats> = {};
  for (const g of playable(games, engineOf)) {
    const engine = engineOf(g.type)!;
    const finished = g.status === 'finished';
    const rows = engine.result(g);
    const key = engine.statsKey(g);
    const solo = rows.length < 2;
    const time = finishedTime(g);
    for (const r of rows) {
      if (!r.pid) continue;
      const s = (out[r.pid] ??= { games: 0, wins: 0, keys: {}, last: 0 });
      if (time > s.last) s.last = time;
      if (!finished) continue;
      s.games++;
      const win = !solo && r.place === 1;
      if (win) s.wins++;
      const k = (s.keys[key] ??= { label: engine.label(g), games: 0, wins: 0, best: null, higherIsBetter: engine.higherIsBetter });
      k.games++;
      if (win) k.wins++;
      if (engine.higherIsBetter && (k.best === null || r.total > k.best)) k.best = r.total;
    }
  }
  return out;
}

/** Höchste je erzielte Punktzahl je Spielart (nur Spiele, bei denen viel gut ist). */
export function computeRecords(games: BaseGame[], engineOf: EngineLookup): RecordEntry[] {
  const out: Record<string, RecordEntry> = {};
  for (const g of sortFinished(games, engineOf)) {
    const engine = engineOf(g.type)!;
    if (!engine.higherIsBetter) continue;
    const key = engine.statsKey(g);
    for (const r of engine.result(g)) {
      if (!out[key] || r.total > out[key]!.total) out[key] = { key, label: engine.label(g), total: r.total, name: r.name, date: finishedTime(g) };
    }
  }
  return Object.values(out);
}
