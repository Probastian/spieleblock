import type { EngineLookup } from './engine';
import type { BaseGame } from './types';
import { num } from './util';

export interface TrendGroup {
  key: string;
  label: string;
  /** Älteste zuerst. */
  games: BaseGame[];
}

export interface TrendSeries {
  name: string;
  color: number;
  /** Anzahl Partien dieses Spielers. */
  n: number;
  /** [Partie-Nummer, Punkte] */
  pts: [number, number][];
}

export interface Trend {
  series: TrendSeries[];
  /** Nummer der ersten gezeigten Partie minus eins. */
  offset: number;
  shown: BaseGame[];
}

const MAX_GAMES = 24;
const MAX_SERIES = 8;

/** Gruppiert beendete Spiele nach Spielart. Gezeigt werden nur Gruppen mit mindestens zwei Partien. */
export function trendGroups(finishedOldestFirst: BaseGame[], engineOf: EngineLookup): TrendGroup[] {
  const groups = new Map<string, TrendGroup>();
  for (const g of finishedOldestFirst) {
    const engine = engineOf(g.type);
    if (!engine?.includeInTrend) continue;
    const key = engine.statsKey(g);
    const group = groups.get(key) ?? { key, label: engine.trendLabel(g), games: [] };
    group.games.push(g);
    groups.set(key, group);
  }
  return [...groups.values()].filter(x => x.games.length >= 2).sort((a, b) => b.games.length - a.games.length);
}

export function buildTrend(group: TrendGroup, engineOf: EngineLookup): Trend {
  const offset = Math.max(0, group.games.length - MAX_GAMES);
  const shown = group.games.slice(offset);
  const by = new Map<string, TrendSeries>();
  shown.forEach((g, i) => {
    for (const r of engineOf(g.type)!.result(g)) {
      if (!r.pid) continue;
      const s = by.get(r.pid) ?? { name: r.name, color: r.color, n: 0, pts: [] };
      s.name = r.name;
      s.color = r.color;
      s.n++;
      s.pts.push([offset + i + 1, r.total]);
      by.set(r.pid, s);
    }
  });
  const series = [...by.values()].sort((a, b) => b.n - a.n).slice(0, MAX_SERIES);
  return { series, offset, shown };
}

export const gameTime = (g: BaseGame): number => num(g.finishedAt || g.u);
