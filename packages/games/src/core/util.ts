/** Zahl aus beliebiger Eingabe; ungültige Werte werden zum Standardwert. */
export const num = (value: unknown, fallback = 0): number => (Number.isFinite(+(value as number)) ? +(value as number) : fallback);

export const isId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(value);

/** Ganze Zahl, auf [min, max] begrenzt. */
export const clampInt = (value: unknown, min: number, max: number): number => Math.min(max, Math.max(min, num(value) | 0));

/** Kurze, zeitlich sortierbare ID. */
export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Ein fairer Würfelwurf (1 bis 6) aus dem Zufallsgenerator des Systems. */
export function rollDie(): number {
  try {
    const byte = new Uint8Array(1);
    do {
      globalThis.crypto.getRandomValues(byte);
    } while (byte[0]! >= 252);
    return (byte[0]! % 6) + 1;
  } catch {
    return 1 + Math.floor(Math.random() * 6);
  }
}

/** Fisher-Yates; `random` ist austauschbar, damit Tests eine feste Reihenfolge bekommen. */
export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Ein zufälliges Element (die Liste darf nicht leer sein). */
export const pickOne = <T>(list: readonly T[], random: () => number = Math.random): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;

export const MAX_UNDO = 60;

/** Hängt einen Rückgängig-Eintrag an und begrenzt die Liste. */
export function pushUndo<T>(list: T[], entry: T): void {
  list.push(entry);
  if (list.length > MAX_UNDO) list.shift();
}

export const pluralize = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Vorzeichen-Darstellung mit echtem Minuszeichen: +5, −5, 0 */
export const signed = (v: number): string => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
export const withMinus = (v: number): string => (v < 0 ? `−${Math.abs(v)}` : String(v));
