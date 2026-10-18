import { describe, expect, it } from 'vitest';
import { wizardEngine } from './engine';
import * as W from './game';

const three = [
  { pid: 'a', name: 'Anna', color: 0 },
  { pid: 'b', name: 'Ben', color: 1 },
  { pid: 'c', name: 'Cem', color: 2 },
];

describe('Wizard', () => {
  it('zählt Punkte', () => {
    expect(W.score(2, 2)).toBe(40);
    expect(W.score(0, 0)).toBe(20);
    expect(W.score(3, 1)).toBe(-20);
  });

  it('teilt 60 durch die Spielerzahl', () => {
    expect(W.totalRounds({ players: three, len: 'full' })).toBe(20);
    expect(W.totalRounds({ players: three, len: 'short' })).toBe(10);
    expect(W.totalRounds({ players: Array(4).fill(0), len: 'full' })).toBe(15);
  });

  it('führt durch Ansagen und Stiche', () => {
    const g = W.create(three, { len: 'full' });
    expect(W.state(g)).toEqual({ k: 1, phase: 'bid' });

    const bid = W.openDraft(g, 'bid')!;
    bid.b = [1, 0, 0];
    expect(W.validateDraft(bid)).toBe('Die Ansagen dürfen nicht aufgehen');
    bid.b = [1, 1, 0];
    expect(W.saveDraft(g, bid)!.message).toBe('Ansagen für Runde 1 gespeichert');
    expect(W.state(g)).toEqual({ k: 1, phase: 'trick' });

    const trick = W.openDraft(g, 'trick', 0)!;
    expect(trick.t).toEqual([1, 1, 0]);
    trick.t = [1, 0, 0];
    expect(W.saveDraft(g, trick)!.completed).toBe(true);
    expect(W.state(g)).toEqual({ k: 2, phase: 'bid' });
  });

  it('hält Stiche und Kartenzahl zusammen', () => {
    const g = W.create(three, { len: 'full' });
    const bid = W.openDraft(g, 'bid')!;
    bid.b = [1, 1, 0];
    W.saveDraft(g, bid);
    const trick = W.openDraft(g, 'trick', 0)!;
    trick.t = [1, 1, 1];
    expect(W.validateDraft(trick)).toBe('Es müssen genau 1 Stiche sein');
    trick.t = [1, 0, 0];
    expect(W.saveDraft(g, trick)!.completed).toBe(true);
    expect(W.cumulative(g)).toEqual([[0, 30], [0, -10], [0, 20]]);
  });

  it('macht Schritte rückgängig', () => {
    const g = W.create(three, { len: 'full' });
    const bid = W.openDraft(g, 'bid')!;
    bid.b = [1, 1, 0];
    W.saveDraft(g, bid);
    expect(wizardEngine.describeUndo(g)).toBe('Letzte Ansagen entfernen');
    wizardEngine.undo(g);
    expect(g.rounds).toHaveLength(0);
    expect(wizardEngine.describeUndo(g)).toBeNull();
  });

  it('begrenzt die Schritte auf die Kartenzahl', () => {
    const g = W.create(three, { len: 'full' });
    const w = W.openDraft(g, 'bid')!;
    W.stepDraft(w, 'b', 0, 5);
    expect(w.b[0]).toBe(1);
    W.stepDraft(w, 'b', 0, -5);
    expect(w.b[0]).toBe(0);
  });

  it('rangiert nach Punkten', () => {
    const g = W.create(three, { len: 'full' });
    g.rounds.push({ b: [1, 1, 0], t: [1, 0, 0] });
    const r = wizardEngine.result(g);
    expect(r.map(x => x.name)).toEqual(['Anna', 'Cem', 'Ben']);
    expect(r[0]!.sub).toBe('1 von 1 Ansagen richtig');
  });
});
