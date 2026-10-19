import type { hilo } from '@spieleblock/games';

/** Eine Kategorie mit ihren Einträgen, wie sie in `hilo-data.json` steht (erzeugt von scripts/hilo-data.mjs). */
export interface HiloDataCategory {
  id: string;
  name: string;
  metric: string;
  unit: string;
  items: { n: string; v: number; c?: string }[];
}

let cache: Promise<HiloDataCategory[]> | null = null;

/** Lädt die Zahlen erst bei Bedarf (rund 55 kB). */
export function loadHiloData(): Promise<HiloDataCategory[]> {
  cache ??= import('./hilo-data.json').then(m => ((m as { default?: { categories: HiloDataCategory[] } }).default ?? (m as unknown as { categories: HiloDataCategory[] })).categories);
  return cache;
}

export const itemsOf = (c: HiloDataCategory): hilo.HiloItem[] => c.items.map(i => ({ name: i.n, value: i.v, ...(i.c ? { note: i.c } : {}) }));

export const categoryOf = (c: HiloDataCategory): hilo.HiloCategory => ({ id: c.id, name: c.name, metric: c.metric, unit: c.unit });

/** Zahl für die Anzeige: Tausendertrenner, Nachkommastellen nur bei kleinen Werten. */
export function formatValue(v: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: Math.abs(v) < 100 ? 1 : 0 }).format(v);
}
