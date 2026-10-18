import { describe, expect, it } from 'vitest';
import { tafelEngine } from './engine';
import * as T from './game';

const duo = [
  { pid: 'a', name: 'Anna', color: 0 },
  { pid: 'b', name: 'Ben', color: 1 },
];

describe('Punktetafel', () => {
  it('summiert Runden und kennt Minuspunkte', () => {
    const g = T.create(duo, { mode: 'high', target: 0 });
    T.addRound(g, [10, -5]);
    T.addRound(g, [3, 8]);
    expect(T.totals(g)).toEqual([13, 3]);
    expect(T.cumulative(g)).toEqual([[0, 10, 13], [0, -5, 3]]);
  });

  it('wertet im Modus „niedrigste gewinnt“ umgekehrt', () => {
    const g = T.create(duo, { mode: 'low', target: 0 });
    T.addRound(g, [10, 2]);
    expect(tafelEngine.result(g).map(r => r.name)).toEqual(['Ben', 'Anna']);
  });

  it('meldet das erreichte Ziel', () => {
    const g = T.create(duo, { mode: 'high', target: 50 });
    expect(T.reached(g)).toBeNull();
    T.addRound(g, [60, 10]);
    expect(T.reached(g)).toEqual(['Anna']);
  });

  it('ändert, löscht und macht rückgängig', () => {
    const g = T.create(duo, { mode: 'high', target: 0 });
    T.addRound(g, [1, 2]);
    T.addRound(g, [3, 4]);
    expect(T.editRound(g, 0, [9, 9])).toBe('Runde 1 geändert');
    expect(T.deleteRound(g, 1)).toBe('Runde 2 gelöscht');
    expect(g.rounds).toEqual([[9, 9]]);
    tafelEngine.undo(g); // Löschung
    tafelEngine.undo(g); // Änderung
    expect(g.rounds).toEqual([[1, 2], [3, 4]]);
  });

  it('kann nicht ohne Runde ausgewertet werden', () => {
    const g = T.create(duo, { mode: 'high', target: 0 });
    expect(tafelEngine.cannotFinish(g)).toBe('Trag zuerst eine Runde ein');
    T.addRound(g, [1, 1]);
    expect(tafelEngine.cannotFinish(g)).toBeNull();
  });
});
