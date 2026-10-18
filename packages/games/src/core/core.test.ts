import { describe, expect, it } from 'vitest';
import { engineOf } from '../registry';
import { rank } from './rank';
import { computeRecords, computeStats, sortFinished } from './stats';
import { buildTrend, trendGroups } from './trend';
import * as K from '../kniffel/game';
import type { KniffelGame } from '../kniffel/game';

const duo = [
  { pid: 'a', name: 'Anna', color: 0 },
  { pid: 'b', name: 'Ben', color: 1 },
];

function finished(annaPoints: number, benPoints: number, at: number): KniffelGame {
  const g = K.create(duo, { variant: 'classic', extraKniffel: false, firstHand: false, input: 'dice' });
  g.players[0]!.scores['ch'] = annaPoints;
  g.players[1]!.scores['ch'] = benPoints;
  g.status = 'finished';
  g.finishedAt = at;
  g.u = at;
  return g;
}

describe('rank', () => {
  it('teilt Plätze bei Gleichstand', () => {
    const r = rank([
      { pid: null, name: 'a', color: 0, total: 5 },
      { pid: null, name: 'b', color: 1, total: 9 },
      { pid: null, name: 'c', color: 2, total: 5 },
    ]);
    expect(r.map(x => [x.name, x.place])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
  });

  it('kann aufsteigend ordnen', () => {
    expect(rank([{ pid: null, name: 'a', color: 0, total: 5 }, { pid: null, name: 'b', color: 1, total: 2 }], false)[0]!.name).toBe('b');
  });
});

describe('Statistik', () => {
  const games = [finished(30, 10, 1000), finished(5, 25, 2000), finished(40, 40, 3000)];

  it('zählt Spiele und Siege je Spieler', () => {
    const s = computeStats(games, engineOf);
    expect(s['a']).toMatchObject({ games: 3, wins: 2 }); // Gleichstand: beide Platz 1
    expect(s['b']).toMatchObject({ games: 3, wins: 2 });
    expect(s['a']!.keys['kniffel:classic']!.best).toBe(40);
  });

  it('ignoriert gelöschte und laufende Spiele', () => {
    const deleted = { ...finished(99, 1, 4000), del: true };
    const running = { ...finished(1, 1, 5000), status: 'active' as const };
    expect(computeStats([deleted, running], engineOf)['a']?.games ?? 0).toBe(0);
    expect(sortFinished([deleted, running, ...games], engineOf)).toHaveLength(3);
  });

  it('findet den Rekord je Spielart', () => {
    const r = computeRecords(games, engineOf);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ total: 40, label: 'Kniffel' });
  });

  it('baut das Diagramm aus mindestens zwei Partien', () => {
    expect(trendGroups([games[0]!], engineOf)).toHaveLength(0);
    const groups = trendGroups(games, engineOf);
    expect(groups).toHaveLength(1);
    const t = buildTrend(groups[0]!, engineOf);
    expect(t.series.map(s => s.name).sort()).toEqual(['Anna', 'Ben']);
    expect(t.series[0]!.pts.map(p => p[0])).toEqual([1, 2, 3]);
  });
});
