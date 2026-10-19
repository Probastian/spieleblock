import { describe, expect, it } from 'vitest';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import { whoamiEngine } from './engine';
import * as W from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ pid: null, name: 'S' + i, color: i }));

describe('Wer bin ich (Tisch)', () => {
  it('verteilt verschiedene Figuren', () => {
    const g = W.create(seats(4), { mode: 'table', rounds: 2 });
    expect(W.startRound(g)).toBeNull();
    expect(new Set(g.figure!.figures).size).toBe(4);
    expect(W.startRound(g)).toMatch(/läuft noch/);
  });

  it('wertet nach Reihenfolge: Erster n Punkte, der Letzte nichts', () => {
    const g = W.create(seats(4), { mode: 'table', rounds: 2 });
    W.startRound(g);
    W.solve(g, 2);
    W.solve(g, 0);
    expect(g.figure!.over).toBe(false);
    W.solve(g, 3);
    expect(g.figure!.over).toBe(true);
    expect(g.players.map(p => p.points)).toEqual([3, 0, 4, 2]);
    expect(g.history).toHaveLength(1);
  });

  it('Doppeltes Antippen zählt einmal, Zurücknehmen geht', () => {
    const g = W.create(seats(3), { mode: 'table', rounds: 0 });
    W.startRound(g);
    W.solve(g, 1);
    W.solve(g, 1);
    expect(g.figure!.solved).toEqual([1]);
    W.unsolve(g, 1);
    expect(g.figure!.solved).toEqual([]);
  });

  it('Runde vorzeitig beenden vergibt nur an die Fertigen', () => {
    const g = W.create(seats(4), { mode: 'table', rounds: 0 });
    W.startRound(g);
    W.solve(g, 1);
    W.endRound(g);
    expect(g.players.map(p => p.points)).toEqual([0, 4, 0, 0]);
    expect(W.startRound(g)).toBeNull();
    expect(g.figure!.n).toBe(2);
  });

  it('feste Rundenzahl', () => {
    const g = W.create(seats(3), { mode: 'table', rounds: 1 });
    W.startRound(g);
    W.endRound(g);
    expect(W.allPlayed(g)).toBe(true);
    expect(W.startRound(g)).toMatch(/gespielt/);
  });

  it('Rückgängig', () => {
    const g = W.create(seats(3), { mode: 'table', rounds: 0 });
    W.startRound(g);
    W.solve(g, 0);
    W.endRound(g);
    W.startRound(g);
    expect(whoamiEngine.undo(g)).not.toBeNull();
    expect(g.figure!.over).toBe(true);
    expect(g.history).toHaveLength(1);
  });
});

describe('Stirnraten', () => {
  const T0 = 1_000_000;
  const game = () => W.create(seats(3), { mode: 'forehead', rounds: 1, seconds: 30 });

  it('Zug läuft: richtig und übersprungen, Zeit zählt', () => {
    const g = game();
    expect(W.startTurn(g, T0)).toBeNull();
    expect(g.hu!.endsAt).toBe(T0 + 30_000);
    const first = g.hu!.words[0]!;
    expect(W.mark(g, true, T0 + 1000)).toBeNull();
    W.mark(g, false, T0 + 2000);
    W.mark(g, true, T0 + 3000);
    expect(g.hu!.done[0]).toEqual({ w: first, ok: true });
    expect(W.turnScore(g.hu)).toBe(2);
    expect(W.tick(g, T0 + 29_999)).toBe(false);
    expect(W.tick(g, T0 + 30_000)).toBe(true);
    expect(g.hu!.phase).toBe('over');
    expect(g.players[0]!.points).toBe(2);
  });

  it('nach Ablauf keine Wertung mehr; letzte Wertung lässt sich zurücknehmen', () => {
    const g = game();
    W.startTurn(g, T0);
    W.mark(g, true, T0 + 1000);
    expect(W.unmark(g)).toBe(true);
    expect(g.hu!.done).toHaveLength(0);
    expect(W.mark(g, true, T0 + 40_000)).toMatch(/Zeit/);
    expect(g.hu!.phase).toBe('over');
    expect(g.players[0]!.points).toBe(0);
  });

  it('jeder Spieler kommt einmal dran, dann ist Schluss', () => {
    const g = game();
    for (let i = 0; i < 3; i++) {
      expect(g.turn).toBe(i);
      W.startTurn(g, T0);
      W.mark(g, true, T0 + 100);
      W.stopTurn(g);
      expect(W.nextTurn(g)).toBeNull();
    }
    expect(W.allPlayed(g)).toBe(true);
    expect(W.startTurn(g, T0)).toMatch(/gespielt/);
    expect(g.players.map(p => p.points)).toEqual([1, 1, 1]);
    expect(g.turn).toBe(0);
  });

  it('bereinigt fremde Dokumente', () => {
    const g = game();
    W.startTurn(g, T0);
    const raw = JSON.parse(JSON.stringify(g));
    raw.hu.endsAt = 'x';
    raw.hu.done = [{ w: 'a', ok: 1 }, { w: '', ok: 1 }];
    raw.rules.seconds = 7;
    raw.figure = { figures: ['a'], solved: [5, 1, 1], over: false };
    const clean = sanitizeGame(raw, engineOf) as W.WhoamiGame;
    expect(clean.rules.seconds).toBe(60);
    expect(clean.hu!.endsAt).toBe(0);
    expect(clean.hu!.done).toEqual([{ w: 'a', ok: true }]);
    expect(clean.figure!.figures).toEqual(['a', '?', '?']);
    expect(clean.figure!.solved).toEqual([1]);
  });

  it('Rangliste', () => {
    const g = game();
    W.startTurn(g, T0);
    W.mark(g, true, T0 + 10);
    W.stopTurn(g);
    const rows = whoamiEngine.result(g);
    expect(rows[0]!.total).toBe(1);
    expect(whoamiEngine.label(g)).toBe('Stirnraten');
  });
});
