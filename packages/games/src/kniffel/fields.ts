import { counts, hasRun, isFullHouse, isKniffel, maxSame, pairCount, sumOf, ALL_ROLLS } from './dice';

export type VariantKey = 'classic' | 'extreme';

export interface FieldDef {
  id: string;
  name: string;
  /** Kurzregel unter dem Namen für Screenreader und Menüs. */
  short: string;
  rule: string;
  /** Beispielwurf, der die Regel zeigt. */
  ex: number[];
  calc(dice: number[]): number;
  isNew?: boolean;
  upper?: boolean;
  face?: number;
}

export interface BonusDef {
  at: number;
  pts: number;
  label: string;
  tiny?: string;
}

export interface VariantDef {
  key: VariantKey;
  name: string;
  tag: string;
  upper: FieldDef[];
  lower: FieldDef[];
  bonus: BonusDef[];
}

const FACE_NAMES = ['', 'Einser', 'Zweier', 'Dreier', 'Vierer', 'Fünfer', 'Sechser'];
const UPPER_EXAMPLES: Record<number, number[]> = { 1: [1, 1, 1, 4, 6], 2: [2, 2, 5, 2, 3], 3: [3, 6, 3, 3, 1], 4: [4, 4, 1, 4, 2], 5: [5, 2, 5, 6, 5], 6: [6, 6, 6, 6, 1] };

export const UPPER_FIELDS: FieldDef[] = [1, 2, 3, 4, 5, 6].map(face => ({
  id: 'u' + face,
  face,
  upper: true,
  name: FACE_NAMES[face]!,
  short: `Nur ${face}er zählen · Soll ${3 * face}`,
  rule: `Gezählt wird nur die Augensumme aller Würfel mit der ${face}. Drei Stück (${3 * face} Punkte) sind das Soll: Schaffst du das bei jeder Zahl, reicht es genau für den Bonus.`,
  ex: UPPER_EXAMPLES[face]!,
  calc: d => counts(d)[face]! * face,
}));

export const LOWER_FIELDS = {
  zp: { id: 'zp', name: 'Zwei Paare', isNew: true, short: '2 Paare · Summe aller', rule: 'Zwei verschiedene Paare, zum Beispiel 2-2 und 5-5. Ein Full House zählt auch, vier gleiche Würfel dagegen nicht. Punkte: Summe aller fünf Würfel.', ex: [2, 2, 5, 5, 6], calc: d => (pairCount(d) >= 2 ? sumOf(d) : 0) },
  k3: { id: 'k3', name: 'Dreierpasch', short: '3 gleiche · Summe aller', rule: 'Mindestens drei Würfel zeigen dieselbe Zahl. Dann zählt die Summe aller fünf Würfel, auch die der beiden übrigen.', ex: [4, 4, 4, 2, 6], calc: d => (maxSame(d) >= 3 ? sumOf(d) : 0) },
  k4: { id: 'k4', name: 'Viererpasch', short: '4 gleiche · Summe aller', rule: 'Mindestens vier Würfel zeigen dieselbe Zahl. Gezählt wird die Summe aller fünf Würfel.', ex: [5, 5, 5, 5, 1], calc: d => (maxSame(d) >= 4 ? sumOf(d) : 0) },
  fh: { id: 'fh', name: 'Full House', short: '3 + 2 gleiche · 25', rule: 'Drei gleiche plus zwei andere gleiche Würfel. Gibt immer 25 Punkte, egal welche Zahlen. Fünf gleiche Würfel sind kein Full House.', ex: [3, 3, 3, 6, 6], calc: d => (isFullHouse(d) ? 25 : 0) },
  ks: { id: 'ks', name: 'Kleine Straße', short: '4 in Folge · 30', rule: 'Vier Zahlen in Folge: 1-2-3-4, 2-3-4-5 oder 3-4-5-6. Der fünfte Würfel ist egal. Gibt immer 30 Punkte.', ex: [2, 3, 4, 5, 5], calc: d => (hasRun(d, 4) ? 30 : 0) },
  gs: { id: 'gs', name: 'Große Straße', short: '5 in Folge · 40', rule: 'Alle fünf Würfel in Folge: 1-2-3-4-5 oder 2-3-4-5-6. Gibt immer 40 Punkte.', ex: [1, 2, 3, 4, 5], calc: d => (hasRun(d, 5) ? 40 : 0) },
  ge: { id: 'ge', name: 'Gerade Sache', isNew: true, short: 'Alle gerade · Summe +10', rule: 'Alle fünf Würfel zeigen eine gerade Zahl (2, 4 oder 6). Punkte: Summe aller Würfel plus 10 Extrapunkte.', ex: [2, 4, 4, 6, 2], calc: d => (d.every(x => x % 2 === 0) ? sumOf(d) + 10 : 0) },
  tf: { id: 'tf', name: 'Tiefflieger', isNew: true, short: 'Summe ≤ 12 · 30', rule: 'Die Augensumme aller fünf Würfel ist 12 oder kleiner. Gibt immer 30 Punkte. Hier sind kleine Zahlen plötzlich Gold wert.', ex: [1, 2, 2, 3, 4], calc: d => (sumOf(d) <= 12 ? 30 : 0) },
  hs: { id: 'hs', name: 'Hochstapler', isNew: true, short: 'Summe ≥ 25 · Summe aller', rule: 'Die Augensumme aller fünf Würfel ist 25 oder größer. Dann zählt die Summe. Darunter gibt es nichts, das Feld ist also eine Chance mit Mindestwurf.', ex: [6, 6, 5, 5, 4], calc: d => (sumOf(d) >= 25 ? sumOf(d) : 0) },
  kn: { id: 'kn', name: 'Kniffel', short: '5 gleiche · 50', rule: 'Alle fünf Würfel zeigen dieselbe Zahl. Gibt 50 Punkte.', ex: [6, 6, 6, 6, 6], calc: d => (isKniffel(d) ? 50 : 0) },
  ch: { id: 'ch', name: 'Chance', short: 'Alles geht · Summe aller', rule: 'Jeder Wurf ist erlaubt, gezählt wird die Summe aller fünf Würfel. Das Rettungsfeld für Würfe, die sonst nirgends passen.', ex: [6, 5, 3, 2, 1], calc: d => sumOf(d) },
} satisfies Record<string, FieldDef>;

const L = LOWER_FIELDS;

export const VARIANTS: Record<VariantKey, VariantDef> = {
  classic: { key: 'classic', name: 'Kniffel', tag: 'Klassisch', upper: UPPER_FIELDS, lower: [L.k3, L.k4, L.fh, L.ks, L.gs, L.kn, L.ch], bonus: [{ at: 63, pts: 35, label: 'Bonus' }] },
  extreme: { key: 'extreme', name: 'Kniffel Extreme', tag: 'Extreme', upper: UPPER_FIELDS, lower: [L.zp, L.k3, L.k4, L.fh, L.ks, L.gs, L.ge, L.tf, L.hs, L.kn, L.ch], bonus: [{ at: 63, pts: 35, label: 'Bonus' }, { at: 80, pts: 25, label: 'Superbonus', tiny: 'Super' }] },
};

export const FIELDS_BY_ID: Record<string, FieldDef> = Object.fromEntries([...UPPER_FIELDS, ...Object.values(L)].map(f => [f.id, f]));

export const isVariantKey = (v: unknown): v is VariantKey => v === 'classic' || v === 'extreme';
export const fieldsOf = (v: VariantDef): FieldDef[] => [...v.upper, ...v.lower];

const possibleCache = new Map<string, number[]>();

/** Alle Punktwerte, die ein Feld bei irgendeinem Wurf ergeben kann (inklusive 0). */
export function possibleValues(f: FieldDef): number[] {
  let values = possibleCache.get(f.id);
  if (!values) {
    const set = new Set<number>([0]);
    for (const roll of ALL_ROLLS) set.add(f.calc(roll));
    values = [...set].sort((a, b) => a - b);
    possibleCache.set(f.id, values);
  }
  return values;
}

export function possibleText(f: FieldDef): string {
  const v = possibleValues(f).filter(x => x > 0);
  if (v.length === 1) return String(v[0]);
  if (v.length <= 6) return v.slice(0, -1).join(', ') + ' oder ' + v[v.length - 1];
  const lo = v[0]!;
  const hi = v[v.length - 1]!;
  if (v.every((x, i) => !i || x - v[i - 1]! === 1)) return `${lo} bis ${hi}`;
  if (v.every(x => x % 2 === 0)) return `gerade Werte von ${lo} bis ${hi}`;
  return `${lo} bis ${hi}`;
}

/** Extrapunkte für jeden weiteren Kniffel. */
export const extraKniffelValue = (variant: VariantKey, extraRule: boolean): number => (variant === 'extreme' ? 100 : extraRule ? 50 : 0);

export function ruleText(f: FieldDef, variant: VariantKey, extraRule: boolean): string {
  if (f.id !== 'kn') return f.rule;
  const kb = extraKniffelValue(variant, extraRule);
  return (
    f.rule +
    (kb
      ? ` Jeder weitere Kniffel bringt +${kb} Extrapunkte, sobald das Kniffel-Feld mit 50 belegt ist. Den Wurf trägst du zusätzlich in ein freies Feld deiner Wahl ein.`
      : ' Weitere Kniffel bringen in der klassischen Regel nichts extra. Du trägst sie wie einen normalen Wurf in ein anderes Feld ein.')
  );
}
