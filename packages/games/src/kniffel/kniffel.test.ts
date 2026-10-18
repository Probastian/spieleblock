import { describe, expect, it } from 'vitest';
import { finishGame } from '../core/lifecycle';
import { sanitizeGame } from '../core/sanitize';
import { engineOf } from '../registry';
import { FIELDS_BY_ID, LOWER_FIELDS, possibleText, possibleValues, VARIANTS } from './fields';
import * as K from './game';
import { kniffelEngine } from './engine';

const players = [
  { pid: 'a', name: 'Anna', color: 0 },
  { pid: 'b', name: 'Ben', color: 1 },
];
const newGame = (variant: 'classic' | 'extreme' = 'classic', extra = false) =>
  K.create(players, { variant, extraKniffel: extra, firstHand: false, input: 'dice' });

describe('Kniffel: Felder', () => {
  it('zählt die Felder des klassischen Blocks', () => {
    expect(FIELDS_BY_ID['u3']!.calc([3, 3, 1, 3, 6])).toBe(9);
    expect(LOWER_FIELDS.fh.calc([3, 3, 3, 6, 6])).toBe(25);
    expect(LOWER_FIELDS.fh.calc([6, 6, 6, 6, 6])).toBe(0);
    expect(LOWER_FIELDS.ks.calc([1, 2, 3, 4, 6])).toBe(30);
    expect(LOWER_FIELDS.gs.calc([2, 3, 4, 5, 6])).toBe(40);
    expect(LOWER_FIELDS.kn.calc([4, 4, 4, 4, 4])).toBe(50);
    expect(LOWER_FIELDS.k3.calc([4, 4, 4, 2, 6])).toBe(20);
    expect(LOWER_FIELDS.k4.calc([4, 4, 4, 2, 6])).toBe(0);
  });

  it('zählt die Extreme-Felder', () => {
    expect(LOWER_FIELDS.zp.calc([2, 2, 5, 5, 6])).toBe(20);
    expect(LOWER_FIELDS.ge.calc([2, 4, 4, 6, 2])).toBe(28);
    expect(LOWER_FIELDS.tf.calc([1, 2, 2, 3, 4])).toBe(30);
    expect(LOWER_FIELDS.hs.calc([6, 6, 5, 5, 4])).toBe(26);
    expect(LOWER_FIELDS.hs.calc([1, 1, 1, 1, 1])).toBe(0);
  });

  it('leitet mögliche Werte aus allen Würfen ab', () => {
    expect(possibleValues(LOWER_FIELDS.fh)).toEqual([0, 25]);
    expect(possibleText(LOWER_FIELDS.fh)).toBe('25');
    expect(possibleValues(FIELDS_BY_ID['u2']!)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('hat 13 beziehungsweise 17 Felder', () => {
    expect(K.allFields(newGame('classic'))).toHaveLength(13);
    expect(K.allFields(newGame('extreme'))).toHaveLength(17);
  });
});

describe('Kniffel: Spielablauf', () => {
  it('trägt ein, wechselt den Zug und stellt per Rückgängig wieder her', () => {
    const g = newGame();
    g.dice = [6, 6, 6, 1, 2];
    g.rolls = 2;
    const out = K.commit(g, 0, 'u6', 18, { fromDice: true });
    expect(out.message).toBe('18 bei Sechser · Ben ist dran');
    expect(out.advancedTo).toBe(1);
    expect(g.turn).toBe(1);
    expect(g.dice).toEqual([0, 0, 0, 0, 0]);

    const undone = K.undo(g);
    expect(undone).toEqual({ fieldId: 'u6', player: 0 });
    expect(g.players[0]!.scores['u6']).toBeUndefined();
    expect(g.turn).toBe(0);
    expect(g.dice).toEqual([6, 6, 6, 1, 2]);
    expect(g.rolls).toBe(2);
  });

  it('rechnet Bonus und Gesamtsumme', () => {
    const g = newGame();
    const p = g.players[0]!;
    Object.assign(p.scores, { u1: 3, u2: 6, u3: 9, u4: 12, u5: 15, u6: 18, kn: 50 });
    expect(K.totals(g, p)).toMatchObject({ up: 63, bon: 35, low: 50, total: 148 });
  });

  it('zählt Extra-Kniffel nur bei belegtem Kniffel-Feld', () => {
    const g = newGame('classic', true);
    g.players[0]!.scores['kn'] = 50;
    g.dice = [5, 5, 5, 5, 5];
    const out = K.commit(g, 0, 'u5', 25, { fromDice: true });
    expect(out.message).toContain('Extra-Kniffel +50');
    expect(K.totals(g, g.players[0]!).kb).toBe(50);
    K.undo(g);
    expect(g.players[0]!.extra).toBe(0);
  });

  it('gibt in Extreme immer 100 Extrapunkte', () => {
    expect(K.extraValue(newGame('extreme'))).toBe(100);
    expect(K.extraValue(newGame('classic', false))).toBe(0);
  });

  it('wertet das Spiel aus, wenn alle Felder voll sind', () => {
    const g = newGame();
    for (const f of K.allFields(g)) for (const p of g.players) p.scores[f.id] = 0;
    delete g.players[1]!.scores['ch'];
    expect(K.commit(g, 1, 'ch', 0, { fromDice: false }).allFilled).toBe(true);
  });

  it('würfelt nur leere Plätze und höchstens dreimal', () => {
    const g = newGame();
    const rolled = K.roll(g, () => 4);
    expect(rolled).toEqual([0, 1, 2, 3, 4]);
    expect(g.first).toBe(true);
    g.dice[0] = 0;
    expect(K.roll(g, () => 2)).toEqual([0]);
    expect(g.first).toBe(false);
    g.dice[1] = 0;
    expect(K.roll(g, () => 1)).toEqual([1]);
    g.dice[2] = 0;
    expect(K.roll(g, () => 1)).toEqual([]);
    expect(g.rolls).toBe(3);
  });

  it('merkt sich die erste Hand (Hausregel)', () => {
    const g = K.create(players, { variant: 'classic', extraKniffel: false, firstHand: true, input: 'dice' });
    const out = K.commit(g, 0, 'ch', 20, { fromDice: true, firstHand: true });
    expect(out.message).toContain('+5 erste Hand');
    expect(K.totals(g, g.players[0]!).hand).toBe(5);
  });

  it('wählt das beste Feld und fällt auf Chance zurück', () => {
    const g = newGame();
    g.dice = [3, 3, 3, 6, 6];
    expect(K.bestField(g, g.players[0]!)).toBe('fh');
    g.players[0]!.scores['fh'] = 25;
    g.players[0]!.scores['k3'] = 21;
    g.dice = [1, 2, 4, 4, 6];
    expect(K.bestField(g, g.players[0]!)).toBe('u4');
  });
});

describe('Kniffel: Engine', () => {
  it('rangiert und formuliert die Aufschlüsselung', () => {
    const g = newGame();
    g.players[1]!.scores['kn'] = 50;
    const r = kniffelEngine.result(g);
    expect(r[0]).toMatchObject({ name: 'Ben', total: 50, place: 1 });
    expect(r[1]).toMatchObject({ name: 'Anna', total: 0, place: 2 });
    expect(r[0]!.sub).toBe('Oben 0 · Bonus 0 · Unten 50');
  });

  it('erkennt einen neuen Rekord', () => {
    const old = newGame();
    old.players[0]!.scores['kn'] = 50;
    old.status = 'finished';
    const g = newGame();
    g.players[0]!.scores['kn'] = 50;
    g.players[0]!.scores['ch'] = 20;
    finishGame(g, [old], engineOf);
    expect(g.status).toBe('finished');
    expect(g.record).toEqual({ best: 70, prev: 50 });
  });

  it('bereinigt fremde Dokumente', () => {
    const g = newGame();
    g.players[0]!.scores['kn'] = 50;
    const dirty = { ...JSON.parse(JSON.stringify(g)), variant: 'bogus', dice: [9, 9], players: [{ ...g.players[0], scores: { kn: 50, evil: 5 } }] };
    const clean = sanitizeGame(dirty, engineOf) as K.KniffelGame;
    expect(clean.variant).toBe('classic');
    expect(clean.dice).toEqual([0, 0, 0, 0, 0]);
    expect(clean.players[0]!.scores).toEqual({ kn: 50 });
    expect(sanitizeGame({ id: 'x y', type: 'kniffel', players: [] }, engineOf)).toBeNull();
    expect(sanitizeGame({ id: 'x', type: 'doom', players: [{}] }, engineOf)).toBeNull();
  });

  it('kennt beide Varianten', () => {
    expect(Object.keys(VARIANTS)).toEqual(['classic', 'extreme']);
  });
});
