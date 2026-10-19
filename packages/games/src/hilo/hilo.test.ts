import { describe, expect, it } from 'vitest';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import { hiloEngine } from './engine';
import * as Hi from './game';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ pid: null, name: 'S' + i, color: i }));
const cat: Hi.HiloCategory = { id: 'berge', name: 'Berge', metric: 'Höhe', unit: 'm' };
const items = (n = 20): Hi.HiloItem[] => Array.from({ length: n }, (_, i) => ({ name: 'Berg ' + i, value: (i + 1) * 100 }));
const noShuffle = () => 0.999999; // Fisher-Yates mit festem Wert ergibt die ursprüngliche Reihenfolge

function game(n = 2, rules: Partial<Hi.HiloRules> = {}) {
  const g = Hi.create(seats(n), rules);
  expect(Hi.start(g, cat, items(), noShuffle)).toBeNull();
  return g;
}

describe('Mehr oder weniger', () => {
  it('braucht genug Einträge und mischt ohne Doppelte', () => {
    const g = Hi.create(seats(2));
    expect(Hi.start(g, cat, items(5))).toMatch(/Zu wenige/);
    const dup = [...items(14), ...items(14)];
    expect(Hi.start(g, cat, dup)).toBeNull();
    expect(g.items).toHaveLength(14);
    expect(Hi.start(g, cat, items())).toMatch(/läuft schon/);
  });

  it('vergleicht das gesuchte mit dem bekannten Objekt', () => {
    const g = game();
    const ref = Hi.reference(g)!;
    const next = Hi.challenger(g)!;
    expect(ref.name).toBe('Berg 0');
    expect(next.name).toBe('Berg 1');
    expect(Hi.isRight(ref, next, 'more')).toBe(true);
    expect(Hi.isRight(ref, next, 'less')).toBe(false);
    expect(Hi.isRight(ref, { name: 'x', value: ref.value }, 'less')).toBe(true);
  });

  it('alle tippen: richtig zählt, falsch kostet ein Leben, aufgelöst wenn alle da sind', () => {
    const g = game(2);
    expect(Hi.answer(g, 0, 'more')).toBeNull();
    expect(g.phase).toBe('guess');
    expect(Hi.waitingFor(g)).toEqual([1]);
    Hi.answer(g, 1, 'less');
    expect(g.phase).toBe('reveal');
    expect(g.verdict).toEqual({ 0: true, 1: false });
    expect(g.players[0]).toMatchObject({ score: 1, streak: 1, best: 1, lives: 3 });
    expect(g.players[1]).toMatchObject({ score: 0, streak: 0, lives: 2 });
    expect(Hi.answer(g, 0, 'more')).toMatch(/nicht getippt/);
  });

  it('nächste Frage: das aufgedeckte Objekt wird Vergleich', () => {
    const g = game(2);
    Hi.answer(g, 0, 'more');
    Hi.answer(g, 1, 'more');
    expect(Hi.next(g)).toBeNull();
    expect(Hi.reference(g)!.name).toBe('Berg 1');
    expect(Hi.challenger(g)!.name).toBe('Berg 2');
    expect(g.answers).toEqual({});
    expect(Hi.next(g)).toMatch(/Erst auflösen/);
  });

  it('reihum: nur der Spieler am Zug tippt, der Nächste mit Leben ist dran', () => {
    const g = game(3, { mode: 'turns', lives: 1 });
    expect(Hi.answer(g, 1, 'more')).toMatch(/nicht dran/);
    Hi.answer(g, 0, 'less'); // falsch: ausgeschieden
    expect(g.players[0]!.lives).toBe(0);
    Hi.next(g);
    expect(g.turn).toBe(1);
    Hi.answer(g, 1, 'more');
    Hi.next(g);
    expect(g.turn).toBe(2);
    Hi.answer(g, 2, 'more');
    Hi.next(g);
    expect(g.turn).toBe(1); // 0 ist raus
  });

  it('Spielende: nur noch einer übrig, oder alle Einträge durch', () => {
    const g = game(2, { lives: 1 });
    Hi.answer(g, 0, 'more');
    Hi.answer(g, 1, 'less');
    expect(Hi.isOver(g)).toBe(true);
    expect(Hi.next(g)).toMatch(/vorbei/);

    const solo = game(1, { lives: 5 });
    let rounds = 0;
    while (!Hi.isOver(solo)) {
      Hi.answer(solo, 0, 'more');
      if (!Hi.isOver(solo)) Hi.next(solo);
      rounds++;
    }
    expect(rounds).toBe(19);
    expect(solo.players[0]!.score).toBe(19);
  });

  it('allein: das Spiel endet erst ohne Leben', () => {
    const g = game(1, { lives: 1 });
    Hi.answer(g, 0, 'less');
    expect(Hi.isOver(g)).toBe(true);
    expect(hiloEngine.result(g)[0]!.total).toBe(0);
  });

  it('ohne Warten auflösen: wer nicht tippt, verliert ein Leben', () => {
    const g = game(3);
    expect(Hi.closeGuessing(g)).toMatch(/niemand/);
    Hi.answer(g, 0, 'more');
    Hi.closeGuessing(g);
    expect(g.phase).toBe('reveal');
    expect(g.players.map(p => p.lives)).toEqual([3, 2, 2]);
  });

  it('Rückgängig und Revanche', () => {
    const g = game(2);
    Hi.answer(g, 0, 'more');
    Hi.answer(g, 1, 'more');
    expect(hiloEngine.undo(g)).not.toBeNull();
    expect(g.phase).toBe('guess');
    expect(g.players.every(p => p.score === 0 && p.lives === 3)).toBe(true);
    const again = hiloEngine.rematch(g, p => p.name);
    expect(again.started).toBe(false);
    expect(again.players[0]!.name).toBe('S1');
  });

  it('bereinigt fremde Dokumente', () => {
    const g = game(2);
    const raw = JSON.parse(JSON.stringify(g));
    raw.pos = 999;
    raw.players[0].lives = 99;
    raw.answers = { '0': 'more', '1': 'sideways', '7': 'less' };
    raw.items.push({ name: '', value: 1 }, { name: 'x', value: 'NaN' });
    const clean = sanitizeGame(raw, engineOf) as Hi.HiloGame;
    expect(clean.items).toHaveLength(20);
    expect(clean.pos).toBe(19);
    expect(clean.players[0]!.lives).toBe(9);
    expect(clean.answers).toEqual({ 0: 'more' });
  });
});
