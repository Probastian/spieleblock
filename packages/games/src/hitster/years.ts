import { MIN_YEAR, maxYear, type YearEntry } from './game';

/** Ein Treffer der MusicBrainz-Suche, soweit wir ihn brauchen. */
export interface MbRecording {
  title?: string;
  score?: number;
  'first-release-date'?: string;
  isrcs?: { id?: string }[];
  'artist-credit'?: { name?: string; artist?: { name?: string } }[];
}

export interface MbYear {
  year: number;
  /** Wie viele Treffer das früheste Jahr stützen. */
  support: number;
}

/** Vergleichsform: ohne Akzente, Klammern, Satzzeichen und Groß-/Kleinschreibung. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const VERSION_WORDS = /(remaster|remix|live|version|edit|mono|stereo|deluxe|bonus|single|mix|acoustic|reprise|\b(19|20)\d\d\b)/i;

const VARIANT_WORDS = /\b(live|remix|demo|karaoke|instrumental|acoustic|unplugged|cover|tribute|a cappella)\b/gi;

/** Art der Aufnahme, soweit der Titel sie verrät. Eine Live-Aufnahme ist nicht dasselbe Stück wie die Studioversion. */
const variantsOf = (title: string): string =>
  [...new Set((title.match(VARIANT_WORDS) ?? []).map(w => w.toLowerCase()))].sort().join(',');

/** Entfernt Zusätze wie „ - Remastered 2011“ oder „ - Radio Edit“, die den Songnamen nicht ändern. */
export function cleanTitle(title: string): string {
  const parts = title.split(/\s+-\s+/);
  const head = parts[0] ?? title;
  const rest = parts.slice(1).filter(p => !VERSION_WORDS.test(p));
  return [head, ...rest].join(' - ').replace(/\s*\((?=[^)]*(remaster|version|edit|live|mono|stereo|mix))[^)]*\)/gi, '').trim();
}

/** Die Suchanfrage für MusicBrainz. Der Datumsfilter ist wichtig: sonst stehen oft nur Treffer ohne Datum vorn. */
export function buildQuery(title: string, artist: string): string {
  const clean = (s: string) => s.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return `recording:"${clean(cleanTitle(title))}" AND artist:"${clean(artist)}" AND firstreleasedate:[1900-01-01 TO 2100-12-31]`;
}

export const normIsrc = (isrc: string | null | undefined): string | null => {
  const code = (isrc ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{12}$/.test(code) ? code : null;
};

/**
 * Eine Anfrage für viele Songs: Zu einer ISRC gibt es nur wenige Aufnahmen, deshalb passen auch 20 in eine Antwort
 * (die Suche liefert höchstens 100 Treffer). Mit Titel und Interpret ginge das nicht, da verdrängen beliebte Songs alle anderen.
 */
export function buildIsrcBatchQuery(isrcs: readonly (string | null)[]): string | null {
  const codes = [...new Set(isrcs.map(normIsrc).filter((c): c is string => !!c))];
  return codes.length ? `(${codes.map(c => `isrc:${c}`).join(' OR ')}) AND firstreleasedate:[1900-01-01 TO 2100-12-31]` : null;
}

/** Frühestes Erscheinungsjahr der Aufnahmen mit dieser ISRC. Für Songs, deren Aufnahme als Neuauflage unter anderer ISRC läuft, findet das nicht das Original. */
export function pickMbYearByIsrc(isrc: string | null, recordings: readonly MbRecording[]): MbYear | null {
  const code = normIsrc(isrc);
  if (!code) return null;
  const years: number[] = [];
  for (const r of recordings) {
    if (!(r.isrcs ?? []).some(i => (i.id ?? '').toUpperCase() === code)) continue;
    const year = parseInt((r['first-release-date'] ?? '').slice(0, 4), 10);
    if (year >= MIN_YEAR && year <= maxYear()) years.push(year);
  }
  if (!years.length) return null;
  const year = Math.min(...years);
  return { year, support: years.filter(y => y === year).length };
}

const REISSUE_WORDS = /(remaster|re-?issue|best of|greatest|hits|collection|anthology|essential|gold|deluxe|anniversary|edition|\blive\b|sampler|ultimate|platinum|classics|legends|singles|the very best|now that|\d{4} version|bonus|expanded|mono|stereo|unplugged|acoustic|karaoke|cover|tribute)/i;

/**
 * Sieht das Album nach einer Neuauflage oder Zusammenstellung aus? Dann kann das Albumjahr vom Original abweichen,
 * und wir fragen genauer nach (Titel und Interpret), statt der schnellen ISRC-Abfrage zu trauen.
 */
export function needsOriginalCheck(track: { title: string; album: string; albumType: string }): boolean {
  return track.albumType === 'compilation' || REISSUE_WORDS.test(track.album) || REISSUE_WORDS.test(track.title);
}

/** Aus zwei Fundstellen das frühere Jahr; die Zahl der stützenden Treffer stammt von der gewählten. */
export function earliest(a: MbYear | null, b: MbYear | null): MbYear | null {
  if (!a || !b) return a ?? b;
  return b.year < a.year ? b : a;
}

/**
 * Wertet die Treffer aus: Titel und Interpret müssen übereinstimmen, dann zählt das früheste Jahr.
 * `artists` sind alle Interpreten des Spotify-Tracks.
 */
export function pickMbYear(title: string, artists: string[], recordings: readonly MbRecording[]): MbYear | null {
  const want = norm(cleanTitle(title));
  const wantVariants = variantsOf(title);
  const who = new Set(artists.map(norm).filter(Boolean));
  if (!want || !who.size) return null;

  const years: number[] = [];
  for (const r of recordings) {
    if ((r.score ?? 0) < 90 || norm(cleanTitle(r.title ?? '')) !== want || variantsOf(r.title ?? '') !== wantVariants) continue;
    const credited = (r['artist-credit'] ?? []).some(a => who.has(norm(a.name ?? '')) || who.has(norm(a.artist?.name ?? '')));
    if (!credited) continue;
    const year = parseInt((r['first-release-date'] ?? '').slice(0, 4), 10);
    if (year >= MIN_YEAR && year <= maxYear()) years.push(year);
  }
  if (!years.length) return null;
  const year = Math.min(...years);
  return { year, support: years.filter(y => y === year).length };
}

/**
 * Entscheidet das Jahr einer Karte. Das Original kann nie später erschienen sein als eine Neuauflage,
 * deshalb gilt das frühere der beiden Jahre. Unsicher ist es, wenn sich die Quellen um mehr als ein Jahr
 * widersprechen und kein zweiter Treffer das frühere Jahr stützt, oder wenn MusicBrainz später liegt als Spotify.
 */
export function resolveYear(spotifyYear: number | null, mb: MbYear | null): YearEntry | null {
  const valid = (y: number | null): y is number => y !== null && y >= MIN_YEAR && y <= maxYear();
  const sp = valid(spotifyYear) ? spotifyYear : null;
  if (sp === null && !mb) return null;
  if (!mb) return { y: sp!, src: 'spotify' };
  if (sp === null) return { y: mb.year, src: 'mb', unsure: mb.support < 2 };

  const diff = Math.abs(mb.year - sp);
  if (mb.year <= sp) return { y: mb.year, src: mb.year === sp ? 'spotify' : 'mb', ...(diff > 1 && mb.support < 2 ? { unsure: true } : {}) };
  return { y: sp, src: 'spotify', ...(diff > 1 ? { unsure: true } : {}) };
}
