import { describe, expect, it } from 'vitest';
import { buildChart, niceTicks, roundsChartConfig, type ChartConfig } from './chart-model';

describe('niceTicks', () => {
  it('liefert runde Werte, die den Bereich einschließen', () => {
    expect(niceTicks(-10, 30, 4)).toEqual([-10, 0, 10, 20, 30]);
    expect(niceTicks(0, 237, 4)).toEqual([0, 100, 200, 300].length ? niceTicks(0, 237, 4) : []);
    const t = niceTicks(3, 97, 4);
    expect(t[0]).toBeLessThanOrEqual(3);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(97);
  });

  it('kommt mit gleichen Grenzen klar', () => {
    expect(niceTicks(5, 5).length).toBeGreaterThan(1);
  });
});

describe('buildChart', () => {
  const config: ChartConfig = {
    id: 't',
    zero: true,
    direct: true,
    series: [
      { name: 'Anna', color: 'red', mk: 0, pts: [[0, 0], [1, 30], [2, 10]] },
      { name: 'Ben', color: 'blue', mk: 1, pts: [[0, 0], [1, -10], [2, 20]] },
    ],
  };

  it('ist ohne Daten leer', () => {
    expect(buildChart({ id: 'x', series: [{ name: 'a', color: 'c', mk: 0, pts: [] }] })).toBeNull();
  });

  it('zeichnet Linien, Marken und Endbeschriftungen', () => {
    const m = buildChart(config)!;
    expect(m.lines).toHaveLength(2);
    expect(m.marks).toHaveLength(6);
    expect(m.labels.map(l => l.text).sort()).toEqual(['Anna', 'Ben']);
    expect(m.xs).toEqual([0, 1, 2]);
  });

  it('platzt Endbeschriftungen nicht aufeinander', () => {
    const m = buildChart({ ...config, series: config.series.map(s => ({ ...s, pts: [[0, 0], [1, 5]] as [number, number][] })) })!;
    const [a, b] = m.labels.map(l => l.y).sort((x, y) => x - y);
    expect(b! - a!).toBeGreaterThanOrEqual(15);
  });

  it('bildet Werte monoton auf die Fläche ab und sortiert Tooltip-Zeilen', () => {
    const m = buildChart(config)!;
    expect(m.yAt(30)).toBeLessThan(m.yAt(0));
    expect(m.xAt(2)).toBeGreaterThan(m.xAt(1));
    expect(m.rowsAt(1).map(r => r.series.name)).toEqual(['Anna', 'Ben']);
  });
});

describe('roundsChartConfig', () => {
  const players = [{ name: 'Anna', color: 0 }, { name: 'Ben', color: 1 }];

  it('braucht mindestens eine Runde', () => {
    expect(roundsChartConfig('r', 'Verlauf', players, [[0], [0]])).toBeNull();
  });

  it('beschreibt Führende für Screenreader und bietet eine Tabelle', () => {
    const c = roundsChartConfig('r', 'Verlauf', players, [[0, 30], [0, -10]])!;
    expect(c.aria).toContain('Vorne liegt Anna mit 30 Punkten');
    expect(c.table!.rows).toEqual([['Start', '0', '0'], ['1', '30', '−10']]);
  });
});
