import type { FilmEntry, FilmListId } from '@spieleblock/shared';
import type { Config } from '../config';

const API = 'https://api.themoviedb.org/3/discover/movie';
const PAGES = 8;
const PARALLEL = 4;
export const CACHE_MS = 12 * 3600e3;

/** Gemeinsame Abfrage-Parameter: deutsche Titel, nach Anzahl der Stimmen (= Bekanntheit) sortiert. */
const BASE = { language: 'de-DE', include_adult: 'false', include_video: 'false', sort_by: 'vote_count.desc' };

const decade = (from: number, to: number, votes: number): Record<string, string> => ({
  'primary_release_date.gte': `${from}-01-01`,
  'primary_release_date.lte': `${to}-12-31`,
  'vote_count.gte': String(votes),
});

/** Was jede Liste bei TMDB abfragt. */
export const QUERIES: Record<FilmListId, Record<string, string>> = {
  beliebt: { 'vote_count.gte': '5000' },
  '2020er': decade(2020, 2029, 1500),
  '2010er': decade(2010, 2019, 3000),
  '2000er': decade(2000, 2009, 2500),
  '1990er': decade(1990, 1999, 2000),
  '1980er': decade(1980, 1989, 1500),
  '1970er': decade(1970, 1979, 1000),
  klassiker: { 'primary_release_date.lte': '1969-12-31', 'vote_count.gte': '600' },
  deutsch: { with_original_language: 'de', 'vote_count.gte': '600' },
  animation: { with_genres: '16', 'vote_count.gte': '3000' },
};

interface TmdbMovie {
  id?: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
}

const POSTER_RE = /^\/([A-Za-z0-9_-]{8,60}\.(?:jpg|png|webp))$/;

/** Macht aus einem TMDB-Treffer einen Film – oder `null`, wenn etwas Wichtiges fehlt. */
export function toEntry(m: TmdbMovie): FilmEntry | null {
  const year = Number(String(m.release_date ?? '').slice(0, 4));
  const title = String(m.title ?? '').trim().slice(0, 80);
  if (!Number.isInteger(m.id) || !title || !(year >= 1900 && year <= new Date().getFullYear() + 1)) return null;
  const original = String(m.original_title ?? '').trim().slice(0, 80);
  return { id: m.id!, title, original: original === title ? '' : original, year, poster: POSTER_RE.exec(m.poster_path ?? '')?.[1] ?? '' };
}

/**
 * Filmlisten aus TMDB. Das Token bleibt auf dem Server; die App bekommt nur Titel, Jahr und Plakat.
 * Antworten werden zwölf Stunden gemerkt, damit ein Spielabend TMDB nicht ständig fragt.
 */
export function createFilmService(config: Pick<Config, 'tmdbToken'>, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<FilmListId, { at: number; films: FilmEntry[] }>();
  const running = new Map<FilmListId, Promise<FilmEntry[]>>();
  const v3 = /^[a-f0-9]{32}$/i.test(config.tmdbToken);

  async function page(list: FilmListId, n: number): Promise<TmdbMovie[]> {
    const params = new URLSearchParams({ ...BASE, ...QUERIES[list], page: String(n) });
    if (v3) params.set('api_key', config.tmdbToken);
    const res = await fetchImpl(`${API}?${params}`, {
      headers: v3 ? { Accept: 'application/json' } : { Accept: 'application/json', Authorization: `Bearer ${config.tmdbToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`TMDB antwortet mit ${res.status}`);
    const body = (await res.json()) as { results?: TmdbMovie[] };
    return Array.isArray(body.results) ? body.results : [];
  }

  async function fetchList(list: FilmListId): Promise<FilmEntry[]> {
    const pages: TmdbMovie[][] = [];
    for (let from = 1; from <= PAGES; from += PARALLEL) {
      const batch = await Promise.all(Array.from({ length: Math.min(PARALLEL, PAGES - from + 1) }, (_, k) => page(list, from + k)));
      pages.push(...batch);
    }
    const seen = new Set<number>();
    const films: FilmEntry[] = [];
    for (const m of pages.flat()) {
      const e = toEntry(m);
      if (e && !seen.has(e.id)) {
        seen.add(e.id);
        films.push(e);
      }
    }
    if (!films.length) throw new Error('TMDB lieferte keine Filme');
    return films;
  }

  return {
    async list(list: FilmListId): Promise<FilmEntry[]> {
      const hit = cache.get(list);
      if (hit && now() - hit.at < CACHE_MS) return hit.films;
      let job = running.get(list);
      if (!job) {
        job = fetchList(list)
          .then(films => {
            cache.set(list, { at: now(), films });
            return films;
          })
          .finally(() => running.delete(list));
        running.set(list, job);
      }
      return job;
    },
  };
}
