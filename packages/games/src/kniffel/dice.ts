/** Würfel-Hilfen: ein Wurf ist eine Liste von Augenzahlen (1 bis 6). */
export const counts = (dice: number[]): number[] => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]!++;
  return c;
};
export const sumOf = (dice: number[]): number => dice.reduce((a, b) => a + b, 0);
export const maxSame = (dice: number[]): number => Math.max(...counts(dice));

/** Gibt es `len` Augenzahlen in Folge? */
export function hasRun(dice: number[], len: number): boolean {
  const seen = new Set(dice);
  for (let start = 1; start + len - 1 <= 6; start++) {
    let ok = true;
    for (let k = start; k < start + len; k++) if (!seen.has(k)) ok = false;
    if (ok) return true;
  }
  return false;
}

export function isFullHouse(dice: number[]): boolean {
  const c = counts(dice).filter(Boolean).sort((a, b) => a - b);
  return c.length === 2 && c[0] === 2 && c[1] === 3;
}

export const pairCount = (dice: number[]): number => counts(dice).filter(x => x >= 2).length;
export const isKniffel = (dice: number[]): boolean => dice.length === 5 && dice.every(x => x && x === dice[0]);

/** Alle 252 unterscheidbaren Würfe mit fünf Würfeln. */
export const ALL_ROLLS: number[][] = (() => {
  const rolls: number[][] = [];
  for (let a = 1; a <= 6; a++)
    for (let b = a; b <= 6; b++)
      for (let c = b; c <= 6; c++)
        for (let d = c; d <= 6; d++) for (let e = d; e <= 6; e++) rolls.push([a, b, c, d, e]);
  return rolls;
})();
