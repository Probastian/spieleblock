import { describe, expect, it, vi } from 'vitest';
import { createFilmService, toEntry } from './films';
import { startTestServer } from '../test-support';

const movie = (id: number, year = 1999) => ({ id, title: 'Film ' + id, original_title: 'Film ' + id, release_date: `${year}-05-01`, poster_path: `/abcdefgh${id}.jpg` });

function fakeFetch(handler: (url: URL, init?: RequestInit) => unknown) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const body = handler(new URL(String(input)), init);
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('TMDB-Filmliste', () => {
  it('wandelt Treffer um und verwirft unbrauchbare', () => {
    expect(toEntry(movie(1))).toEqual({ id: 1, title: 'Film 1', original: '', year: 1999, poster: 'abcdefgh1.jpg' });
    expect(toEntry({ ...movie(2), original_title: 'Other' })!.original).toBe('Other');
    expect(toEntry({ ...movie(3), poster_path: '/../../x' })!.poster).toBe('');
    expect(toEntry({ ...movie(4), release_date: '' })).toBeNull();
    expect(toEntry({ ...movie(5), title: ' ' })).toBeNull();
    expect(toEntry({ ...movie(6), release_date: '1800-01-01' })).toBeNull();
  });

  it('holt mehrere Seiten, entfernt Doppelte, merkt sich die Antwort und sendet das Token', async () => {
    let t = 1000;
    const f = fakeFetch(url => ({ results: [movie(Number(url.searchParams.get('page'))), movie(99)] }));
    const svc = createFilmService({ tmdbToken: 'eyJhbGciOiJIUzI1NiJ9.abc.def-ghi_jkl' }, f, () => t);
    const films = await svc.list('1990er');
    expect(films.map(x => x.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 99]);
    const call = f.mock.calls[0]!;
    const url = new URL(String(call[0]));
    expect(url.searchParams.get('primary_release_date.gte')).toBe('1990-01-01');
    expect(url.searchParams.get('language')).toBe('de-DE');
    expect((call[1]!.headers as Record<string, string>)['Authorization']).toMatch(/^Bearer eyJ/);
    expect(url.searchParams.get('api_key')).toBeNull();
    const n = f.mock.calls.length;
    await svc.list('1990er');
    expect(f.mock.calls.length).toBe(n);
    t += 13 * 3600e3;
    await svc.list('1990er');
    expect(f.mock.calls.length).toBe(n * 2);
  });

  it('v3-Schlüssel geht als Parameter mit', async () => {
    const f = fakeFetch(() => ({ results: [movie(1)] }));
    await createFilmService({ tmdbToken: '0123456789abcdef0123456789abcdef' }, f).list('beliebt');
    const url = new URL(String(f.mock.calls[0]![0]));
    expect(url.searchParams.get('api_key')).toBe('0123456789abcdef0123456789abcdef');
  });

  it('Fehler von TMDB werden nicht gemerkt', async () => {
    let fail = true;
    const f = vi.fn(async () => (fail ? ({ ok: false, status: 500 } as Response) : ({ ok: true, status: 200, json: async () => ({ results: [movie(1)] }) } as Response))) as unknown as typeof fetch;
    const svc = createFilmService({ tmdbToken: 'x'.repeat(30) }, f);
    await expect(svc.list('deutsch')).rejects.toThrow();
    fail = false;
    expect((await svc.list('deutsch')).length).toBe(1);
  });
});

describe('/api/films', () => {
  it('meldet fehlenden Zugang und prüft die Liste', async () => {
    const s = await startTestServer();
    try {
      const info = (await (await fetch(s.url + '/api/info')).json()) as { tmdb: boolean };
      expect(info.tmdb).toBe(false);
      expect((await fetch(s.url + '/api/films?list=beliebt')).status).toBe(503);
    } finally {
      await s.close();
    }
    const s2 = await startTestServer({ tmdbToken: 'x'.repeat(30) });
    try {
      expect(((await (await fetch(s2.url + '/api/info')).json()) as { tmdb: boolean }).tmdb).toBe(true);
      expect((await fetch(s2.url + '/api/films?list=gibtsnicht')).status).toBe(400);
    } finally {
      await s2.close();
    }
  });
});
