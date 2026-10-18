import { describe, expect, it } from 'vitest';
import { coverIdOf, describeSpotifyError, parsePlaylistId, pkceChallenge, randomToken, trackOf, yearOf } from './spotify.util';

describe('PKCE', () => {
  it('berechnet den Prüfwert aus der RFC-7636-Vorlage', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('erzeugt URL-sichere, verschiedene Zufallswerte', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe('Playlist-Eingabe', () => {
  it('erkennt Link, URI und nackte ID', () => {
    expect(parsePlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123')).toBe('37i9dQZF1DXcBWIGoYBM5M');
    expect(parsePlaylistId('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toBe('37i9dQZF1DXcBWIGoYBM5M');
    expect(parsePlaylistId(' 37i9dQZF1DXcBWIGoYBM5M ')).toBe('37i9dQZF1DXcBWIGoYBM5M');
    expect(parsePlaylistId('https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
    expect(parsePlaylistId('hallo')).toBeNull();
  });
});

describe('Tracks lesen', () => {
  const entry = (t: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({ item: t, track: t, ...extra });
  const song = { id: '4cOdK2wGLETKBW3PvgPWqT', type: 'track', name: 'Teenage Dirtbag', artists: [{ name: 'Wheatus' }], album: { release_date: '2000-09-29' }, external_ids: { isrc: 'USSM10008431' } };

  it('liest einen Song, auch wenn nur track oder nur item gesetzt ist', () => {
    const expected = { id: '4cOdK2wGLETKBW3PvgPWqT', title: 'Teenage Dirtbag', artists: ['Wheatus'], year: 2000, isrc: 'USSM10008431', cover: null, album: '', albumType: '' };
    expect(trackOf(entry(song))).toEqual(expected);
    expect(trackOf({ track: song })).toEqual(expected);
    expect(trackOf({ item: song })).toEqual(expected);
  });

  it('überspringt lokale Dateien, Podcasts, gesperrte und kaputte Einträge', () => {
    expect(trackOf(entry(song, { is_local: true }))).toBeNull();
    expect(trackOf(entry({ ...song, type: 'episode' }))).toBeNull();
    expect(trackOf(entry({ ...song, is_playable: false }))).toBeNull();
    expect(trackOf(entry({ ...song, id: null }))).toBeNull();
    expect(trackOf(entry({ ...song, artists: [] }))).toBeNull();
    expect(trackOf(entry(null))).toBeNull();
    expect(trackOf(null)).toBeNull();
  });

  it('liest Albumname und -art', () => {
    const t = trackOf(entry({ ...song, album: { name: 'Greatest Hits (Remastered)', album_type: 'compilation', release_date: '2011' } }));
    expect(t).toMatchObject({ album: 'Greatest Hits (Remastered)', albumType: 'compilation', year: 2011 });
  });

  it('kommt mit fehlenden Feldern zurecht', () => {
    const t = trackOf(entry({ id: song.id, name: 'X', artists: [{ name: 'Y' }] }));
    expect(t).toMatchObject({ year: null, isrc: null });
  });

  it('nimmt aus der Cover-Liste das kleinste scharfe Bild', () => {
    const id = (prefix: string) => prefix + 'a'.repeat(40 - prefix.length);
    const img = (prefix: string, width: number) => ({ url: 'https://i.scdn.co/image/' + id(prefix), width, height: width });
    const images = [img('ab67616d0000b273', 640), img('ab67616d00001e02', 300), img('ab67616d00004851', 64)];
    expect(coverIdOf(images)).toBe(id('ab67616d00001e02'));
    expect(coverIdOf([images[0], images[2]])).toBe(id('ab67616d0000b273')); // lieber das große als das verwaschene 64er
    expect(coverIdOf([images[2]])).toBe(id('ab67616d00004851')); // gibt es nur das kleine, nehmen wir es
    expect(coverIdOf([{ url: 'https://i.scdn.co/image/kaputt', width: 300 }, 'müll', null])).toBeNull();
    expect(coverIdOf(undefined)).toBeNull();
    expect(trackOf({ track: { ...song, album: { release_date: '2000', images } } })?.cover).toBe(id('ab67616d00001e02'));
  });

  it('versteht Datumsformate', () => {
    expect(yearOf('2004-02-16')).toBe(2004);
    expect(yearOf('1999')).toBe(1999);
    expect(yearOf('0000')).toBeNull();
    expect(yearOf(undefined)).toBeNull();
  });
});

describe('Fehlermeldungen', () => {
  it('unterscheidet die wichtigen Fälle', () => {
    expect(describeSpotifyError(401, undefined).kind).toBe('auth');
    expect(describeSpotifyError(403, 'PREMIUM_REQUIRED').kind).toBe('premium');
    expect(describeSpotifyError(404, 'NO_ACTIVE_DEVICE').kind).toBe('device');
    expect(describeSpotifyError(403, undefined).kind).toBe('forbidden');
    expect(describeSpotifyError(404, undefined).kind).toBe('notfound');
    expect(describeSpotifyError(429, undefined).kind).toBe('rate');
    expect(describeSpotifyError(0, undefined).kind).toBe('network');
    expect(describeSpotifyError(500, undefined).kind).toBe('other');
  });
});
