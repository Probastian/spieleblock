import { describe, expect, it } from 'vitest';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import * as I from './game';
import { imposterEngine } from './engine';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ pid: null, name: 'S' + i, color: i }));
const seq = (...values: number[]) => {
  let k = 0;
  return () => values[k++ % values.length]!;
};

function started(n = 4, rules: Partial<I.ImposterRules> = {}) {
  const g = I.create(seats(n), { rounds: 2, ...rules });
  expect(I.startRound(g, seq(0.1, 0.3, 0.5, 0.7))).toBeNull();
  return g;
}

describe('Imposter', () => {
  it('verteilt Wort und Imposter und wartet auf alle Rollen', () => {
    const g = started(4);
    const c = g.current!;
    expect(c.phase).toBe('reveal');
    expect(c.word.length).toBeGreaterThan(1);
    expect(c.imposters).toHaveLength(1);
    expect(g.used).toContain(c.word);
    [0, 1, 2].forEach(i => I.see(g, i));
    expect(c.phase).toBe('reveal');
    I.see(g, 3);
    expect(c.phase).toBe('talk');
  });

  it('begrenzt die Zahl der Imposter nach der Spielerzahl', () => {
    expect(I.imposterCount(I.create(seats(3), { imposters: 2 }))).toBe(1);
    expect(I.imposterCount(I.create(seats(5), { imposters: 2 }))).toBe(2);
    expect(I.imposterCount(I.create(seats(4), { imposters: 2 }))).toBe(1);
  });

  it('verlangt mindestens drei Spieler und keine laufende Runde', () => {
    expect(I.startRound(I.create(seats(2)))).toMatch(/3 Spieler/);
    const g = started();
    expect(I.startRound(g)).toMatch(/läuft noch/);
  });

  function toVote(g: I.ImposterGame) {
    g.players.forEach((_, i) => I.see(g, i));
    expect(I.startVote(g)).toBeNull();
  }

  it('Imposter fliegt auf und rät falsch: Mannschaft punktet', () => {
    const g = started(4);
    toVote(g);
    const imp = g.current!.imposters[0]!;
    const others = g.players.map((_, i) => i).filter(i => i !== imp);
    // alle Anderen stimmen für den Imposter, er selbst für jemand anderen
    for (const v of others) expect(I.vote(g, v, imp)).toBeNull();
    expect(g.current!.phase).toBe('vote');
    I.vote(g, imp, others[0]!);
    expect(g.current!.accused).toBe(imp);
    expect(g.current!.phase).toBe('guess');
    I.judgeGuess(g, false);
    expect(g.current!.phase).toBe('result');
    expect(g.current!.gain![imp]).toBe(0);
    for (const o of others) expect(g.players[o]!.points).toBe(1);
    expect(g.history).toHaveLength(1);
    expect(g.history[0]!.caught).toBe(true);
  });

  it('Imposter errät das Wort: bekommt einen Punkt', () => {
    const g = started(4);
    toVote(g);
    const imp = g.current!.imposters[0]!;
    I.accuse(g, imp);
    I.judgeGuess(g, true);
    expect(g.players[imp]!.points).toBe(1);
    // gemeinsame Entscheidung: alle Anderen punkten
    g.players.forEach((p, i) => i !== imp && expect(p.points).toBe(1));
  });

  it('Falscher Verdacht: Imposter kommt mit zwei Punkten davon', () => {
    const g = started(4);
    toVote(g);
    const imp = g.current!.imposters[0]!;
    const innocent = g.players.findIndex((_, i) => i !== imp);
    I.accuse(g, innocent);
    expect(g.current!.phase).toBe('result');
    expect(g.players[imp]!.points).toBe(2);
    expect(g.history[0]!.caught).toBe(false);
  });

  it('Stimmengleichstand verdächtigt niemanden', () => {
    const g = started(4);
    toVote(g);
    const imp = g.current!.imposters[0]!;
    // zwei Stimmen für den Imposter, zwei für einen Unschuldigen
    const other = g.players.map((_, i) => i).filter(i => i !== imp);
    I.vote(g, other[0]!, imp);
    I.vote(g, other[1]!, imp);
    I.vote(g, other[2]!, other[0]!);
    I.vote(g, imp, other[0]!);
    // imp: 2 Stimmen, other[0]: 2 Stimmen
    expect(g.current!.accused).toBeNull();
    expect(g.current!.phase).toBe('result');
    expect(g.players[imp]!.points).toBe(2);
    // Wer einen Imposter gewählt hat, bekommt trotzdem einen Punkt
    expect(g.players[other[0]!]!.points).toBe(1);
    expect(g.players[other[2]!]!.points).toBe(0);
  });

  it('Abstimmung ohne Warten schließen', () => {
    const g = started(4);
    toVote(g);
    expect(I.closeVote(g)).toMatch(/niemand/);
    const imp = g.current!.imposters[0]!;
    const other = g.players.map((_, i) => i).filter(i => i !== imp);
    I.vote(g, other[0]!, imp);
    expect(I.closeVote(g)).toBeNull();
    expect(g.current!.accused).toBe(imp);
  });

  it('niemand stimmt für sich selbst', () => {
    const g = started(4);
    toVote(g);
    expect(I.vote(g, 1, 1)).toMatch(/selbst/);
  });

  it('spielt feste Runden, wiederholt keine Wörter und beendet', () => {
    const g = started(4, { rounds: 2 });
    const words = [g.current!.word];
    for (let r = 0; r < 2; r++) {
      g.players.forEach((_, i) => I.see(g, i));
      I.startVote(g);
      I.accuse(g, 0);
      if (g.current!.phase === 'guess') I.judgeGuess(g, false);
      if (r === 0) {
        expect(I.allPlayed(g)).toBe(false);
        expect(I.startRound(g)).toBeNull();
        words.push(g.current!.word);
      }
    }
    expect(new Set(words).size).toBe(2);
    expect(I.allPlayed(g)).toBe(true);
    expect(I.startRound(g)).toMatch(/gespielt/);
  });

  it('Rückgängig stellt Runde und Punkte wieder her', () => {
    const g = started(4);
    toVote(g);
    I.accuse(g, 0);
    if (g.current!.phase === 'guess') I.judgeGuess(g, true);
    expect(g.history).toHaveLength(1);
    // zurück zur Abstimmung (Schritt vor dem Ergebnis)
    expect(imposterEngine.undo(g)).not.toBeNull();
    expect(g.current!.phase).toBe('talk');
    expect(g.history).toHaveLength(0);
    expect(g.players.every(p => p.points === 0)).toBe(true);
  });

  it('Rangliste und Revanche', () => {
    const g = started(4);
    toVote(g);
    I.accuse(g, 0);
    if (g.current!.phase === 'guess') I.judgeGuess(g, false);
    const rows = imposterEngine.result(g);
    expect(rows).toHaveLength(4);
    expect(rows[0]!.total).toBeGreaterThanOrEqual(rows[3]!.total);
    const next = imposterEngine.rematch(g, p => p.name);
    expect(next.players[0]!.name).toBe('S1');
    expect(next.players.every(p => p.points === 0)).toBe(true);
    expect(next.current).toBeNull();
  });

  it('bereinigt fremde Dokumente', () => {
    const g = started(4);
    const raw = JSON.parse(JSON.stringify(g));
    raw.current.imposters = [9, 1, 1, -3];
    raw.current.votes = { '0': 0, '1': 7, '2': 3 };
    raw.current.word = '  ';
    raw.rules.rounds = 999;
    const clean = sanitizeGame(raw, engineOf) as I.ImposterGame;
    expect(clean.current).toBeNull();
    expect(clean.rules.rounds).toBe(20);

    const raw2 = JSON.parse(JSON.stringify(g));
    raw2.current.imposters = [9, 1, 1, -3];
    raw2.current.votes = { '0': 0, '1': 7, '2': 3 };
    raw2.players[0].points = 1e9;
    const ok = sanitizeGame(raw2, engineOf) as I.ImposterGame;
    expect(ok.current!.imposters).toEqual([1]);
    expect(ok.current!.votes).toEqual({ '2': 3 });
    expect(ok.players[0]!.points).toBe(9999);
  });
});
