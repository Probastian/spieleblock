import { describe, expect, it } from 'vitest';
import { mergeMeta, normalizeMeta } from './models';

describe('normalizeMeta', () => {
  it('liest die Einstellungen der alten Fassung (direkt unter settings.<spiel>)', () => {
    const m = normalizeMeta({
      players: [{ id: 'p1', name: 'Anna Maria Müller-Lüdenscheidt', color: 9, at: 1, u: 2 }, { id: 'bad id', name: 'x' }],
      settings: { kniffel: { variant: 'extreme', input: 'number' }, tafel: { mode: 'low', target: 100 }, wake: true, last: { kniffel: ['p1'] } },
      u: 5,
    });
    expect(m.players).toHaveLength(1);
    expect(m.players[0]).toMatchObject({ name: 'Anna Maria Mülle', color: 1 });
    expect(m.settings.games['kniffel']).toMatchObject({ variant: 'extreme', input: 'number', extraKniffel: false });
    expect(m.settings.games['tafel']).toEqual({ mode: 'low', target: 100 });
    expect(m.settings.games['wizard']).toEqual({ len: 'full' });
    expect(m.settings.last['kniffel']).toEqual(['p1']);
    expect(m.settings.wake).toBe(true);
  });

  it('füllt leere Dokumente mit Standardwerten', () => {
    const m = normalizeMeta(null);
    expect(m.players).toEqual([]);
    expect(Object.keys(m.settings.games).sort()).toEqual(['film', 'hilo', 'hitster', 'imposter', 'kniffel', 'tafel', 'wavelength', 'whoami', 'wizard']);
  });
});

describe('mergeMeta', () => {
  const player = (id: string, name: string, u: number) => ({ id, name, color: 0, at: 0, u, arch: false });

  it('nimmt je Spieler die neuere Fassung und behält alle', () => {
    const a = normalizeMeta({ players: [player('p1', 'Alt', 1), player('p2', 'Nur lokal', 1)], u: 1 });
    const b = normalizeMeta({ players: [player('p1', 'Neu', 5), player('p3', 'Nur Server', 1)], u: 5 });
    const merged = mergeMeta(a, b);
    expect(merged.players.map(p => p.name)).toEqual(['Neu', 'Nur lokal', 'Nur Server']);
    expect(merged.u).toBe(5);
  });
});
