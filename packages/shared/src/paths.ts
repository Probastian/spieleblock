/**
 * Dokumentpfade der Datenbank. Der Server erlaubt nur diese Form; die Web-App baut ihre Pfade
 * ausschließlich über die Funktionen unten.
 *
 *   data/users/<uid>/meta                    Spieler und Einstellungen
 *   data/users/<uid>/meta/games/<gameId>     ein Spiel
 *   tables/<CODE>                            Live-Tisch (geteiltes Spiel)
 *   tables/<CODE>/seats/<color>              belegte Plätze
 */
export type PathKind = 'doc' | 'col';

const SEGMENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const USER_ID_RE = /^[0-9a-f]{16}$/;
export const TABLE_CODE_RE = /^[A-Z0-9]{4,8}$/;
export const TABLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MAX_PATH_LENGTH = 300;
export const MAX_PATH_DEPTH = 8;

export function parsePath(path: unknown): string[] | null {
  if (typeof path !== 'string' || !path || path.length > MAX_PATH_LENGTH) return null;
  const segments = path.split('/');
  if (segments.length > MAX_PATH_DEPTH || !segments.every(s => SEGMENT_RE.test(s))) return null;
  return segments;
}

/** Dokumente haben eine gerade, Sammlungen eine ungerade Zahl an Segmenten. */
export function isAllowedPath(segments: string[] | null, kind: PathKind): segments is string[] {
  if (!segments) return false;
  if (kind === 'doc' && segments.length % 2 !== 0) return false;
  if (kind === 'col' && segments.length % 2 !== 1) return false;
  const [root, second, third] = segments;
  if (root === 'data') return second === 'users' && segments.length >= 4 && USER_ID_RE.test(third ?? '');
  if (root === 'tables') return TABLE_CODE_RE.test(second ?? '');
  return false;
}

/** Nutzerdaten sind nur mit der passenden Gerätekennung les- und schreibbar. */
export function ownerOf(segments: string[]): string | null {
  return segments[0] === 'data' ? (segments[2] ?? null) : null;
}

/** Liegt der Pfad unter dem Live-Tisch mit diesem Code (der Tisch selbst eingeschlossen)? */
export function belongsToTable(path: string, code: string): boolean {
  return path === `tables/${code}` || path.startsWith(`tables/${code}/`);
}

export const userMetaPath = (uid: string) => `data/users/${uid}/meta`;
export const userGamesPath = (uid: string) => `${userMetaPath(uid)}/games`;
export const userGamePath = (uid: string, gameId: string) => `${userGamesPath(uid)}/${gameId}`;
export const tablePath = (code: string) => `tables/${code}`;
export const seatsPath = (code: string) => `tables/${code}/seats`;
export const seatPath = (code: string, color: number | string) => `tables/${code}/seats/${color}`;

export const isTableCode = (code: unknown): code is string => typeof code === 'string' && TABLE_CODE_RE.test(code);

export function normalizeTableCode(input: unknown): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function generateTableCode(random: () => number = Math.random): string {
  return Array.from({ length: 5 }, () => TABLE_CODE_ALPHABET[Math.floor(random() * TABLE_CODE_ALPHABET.length)]).join('');
}
