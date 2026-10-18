import type { ResultRow, UnrankedRow } from './types';

/** Sortiert und vergibt Plätze; gleiche Summen teilen sich den Platz. */
export function rank(rows: UnrankedRow[], higherIsBetter = true): ResultRow[] {
  const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.total - a.total : a.total - b.total));
  const out: ResultRow[] = [];
  sorted.forEach((row, k) => {
    const prev = out[k - 1];
    out.push({ ...row, place: prev && row.total === prev.total ? prev.place : k + 1 });
  });
  return out;
}
