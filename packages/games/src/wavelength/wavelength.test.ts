import { describe, expect, it } from 'vitest';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import { wavelengthEngine } from './engine';
import * as V from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ pid: null, name: 'S' + i, color: i }));
const fixed = (target: number) => () => (target - 8) / 85 + 0.001;

function started(n = 4, rules: Partial<V.WavelengthRules> = {}, target = 50) {
  const g = V.create(seats(n), rules);
  expect(V.startRound(g, fixed(target))).toBeNull();
  return g;
}

describe('Wavelength', () => {
  it('Punkte nach Abstand', () => {
    expect(V.pointsFor(50, 50)).toBe(4);
    expect(V.pointsFor(45, 50)).toBe(4);
    expect(V.pointsFor(56, 50)).toBe(3);
    expect(V.pointsFor(61, 50)).toBe(3);
    expect(V.pointsFor(68, 50)).toBe(2);
    expect(V.pointsFor(69, 50)).toBe(0);
    expect(V.pointsFor(0, 100)).toBe(0);
  });

  it('startet mit Hinweisgeber und Ziel im erlaubten Bereich', () => {
    const g = started();
    const c = g.current!;
    expect(c.phase).toBe('clue');
    expect(c.target).toBeGreaterThanOrEqual(8);
    expect(c.target).toBeLessThanOrEqual(92);
    expect(c.giver).toBe(0);
    expect(V.giveClue(g, ' sehr heiß ')).toBeNull();
    expect(c.clue).toBe('sehr heiß');
    expect(c.phase).toBe('guess');
  });

  it('Einzelwertung: alle festgemacht deckt auf, Geber bekommt den Durchschnitt', () => {
    const g = started(4, {}, 50);
    V.giveClue(g, 'x');
    V.setGuess(g, 1, 50);
    V.setGuess(g, 2, 60);
    V.setGuess(g, 3, 5);
    expect(V.setGuess(g, 0, 40)).toMatch(/Ungültig/);
    V.lock(g, 1);
    V.lock(g, 2);
    expect(g.current!.phase).toBe('guess');
    V.lock(g, 3);
    expect(g.current!.phase).toBe('reveal');
    expect(g.current!.gain).toEqual([3, 4, 3, 0]);
    expect(g.players.map(p => p.points)).toEqual([3, 4, 3, 0]);
  });

  it('festgemachte Regler lassen sich nicht mehr bewegen, entsperren geht', () => {
    const g = started(3, {}, 50);
    V.giveClue(g);
    V.setGuess(g, 1, 20);
    V.lock(g, 1);
    V.setGuess(g, 1, 90);
    expect(g.current!.guesses[1]).toBe(20);
    V.unlock(g, 1);
    V.setGuess(g, 1, 90);
    expect(g.current!.guesses[1]).toBe(90);
  });

  it('Teammodus: ein Regler, alle bekommen dieselben Punkte', () => {
    const g = started(3, { team: true }, 40);
    V.giveClue(g);
    V.setGuess(g, null, 42);
    V.lock(g, null);
    expect(g.current!.phase).toBe('reveal');
    expect(g.players.map(p => p.points)).toEqual([4, 4, 4]);
  });

  it('ohne Regler gibt es nichts, Aufdecken ohne Warten geht', () => {
    const g = started(3, {}, 50);
    V.giveClue(g);
    V.setGuess(g, 1, 50);
    V.reveal(g);
    expect(g.current!.gain).toEqual([2, 4, 0]);
  });

  it('der nächste gibt den Hinweis; feste Durchgänge enden', () => {
    const g = started(3, { laps: 1 });
    for (let r = 0; r < 3; r++) {
      expect(g.current!.giver).toBe(r);
      V.giveClue(g);
      V.reveal(g);
      if (r < 2) expect(V.startRound(g)).toBeNull();
    }
    expect(V.allPlayed(g)).toBe(true);
    expect(V.startRound(g)).toMatch(/gespielt/);
  });

  it('wiederholt keine Paare innerhalb eines Spiels', () => {
    const g = V.create(seats(3), { laps: 0 });
    const seen = new Set<string>();
    for (let r = 0; r < 20; r++) {
      V.startRound(g);
      seen.add(g.current!.left + g.current!.right);
      V.giveClue(g);
      V.reveal(g);
    }
    expect(seen.size).toBe(20);
  });

  it('Rückgängig, Rangliste und Revanche', () => {
    const g = started(3, {}, 50);
    V.giveClue(g);
    V.reveal(g);
    expect(wavelengthEngine.undo(g)).not.toBeNull();
    expect(g.current!.phase).toBe('guess');
    expect(g.history).toHaveLength(0);
    expect(g.players.every(p => p.points === 0)).toBe(true);
    V.reveal(g);
    const rows = wavelengthEngine.result(g);
    expect(rows).toHaveLength(3);
    expect(wavelengthEngine.rematch(g, p => p.name).players[0]!.name).toBe('S1');
  });

  it('bereinigt fremde Dokumente', () => {
    const g = started(3);
    V.giveClue(g);
    const raw = JSON.parse(JSON.stringify(g));
    raw.current.target = 999;
    raw.current.guesses = { '0': 10, '1': 150, '9': 3 };
    raw.current.locked = [0, 1, 1, 7];
    raw.rules.laps = 9;
    const clean = sanitizeGame(raw, engineOf) as V.WavelengthGame;
    expect(clean.current!.target).toBe(100);
    expect(clean.current!.guesses).toEqual({ '1': 100 });
    expect(clean.current!.locked).toEqual([1]);
    expect(clean.rules.laps).toBe(3);
  });
});
