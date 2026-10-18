import { describe, expect, it } from 'vitest';
import { merge3 } from './merge';

describe('merge3', () => {
  it('übernimmt Änderungen beider Seiten an verschiedenen Feldern', () => {
    const base = { a: 1, b: 1 };
    expect(merge3(base, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({ a: 2, b: 3 });
  });

  it('nimmt bei Konflikt den lokalen Wert', () => {
    expect(merge3({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
  });

  it('übernimmt Löschungen, die nur eine Seite vorgenommen hat', () => {
    const base = { a: 1, b: 2 };
    expect(merge3(base, { a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1 });
    expect(merge3(base, { a: 1, b: 2 }, { b: 2 })).toEqual({ b: 2 });
  });

  it('führt Arrays elementweise zusammen und behält das längere Ende', () => {
    expect(merge3([1, 2], [1, 2, 3], [1, 5])).toEqual([1, 5, 3]);
  });
});
