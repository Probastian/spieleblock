import { describe, expect, it } from 'vitest';
import { buildIsrcQuery, buildQuery, cleanTitle, norm, pickMbYear, resolveYear, type MbRecording } from './years';

const rec = (title: string, date: string | undefined, artist = 'Queen', score = 100): MbRecording => ({ title, score, 'first-release-date': date, 'artist-credit': [{ name: artist }] });

describe('Titel bereinigen', () => {
  it('entfernt Remaster-, Live- und Jahreszusätze, aber keine echten Titelteile', () => {
    expect(cleanTitle('Bohemian Rhapsody - Remastered 2011')).toBe('Bohemian Rhapsody');
    expect(cleanTitle('Dancing Queen - 2011 Remaster')).toBe('Dancing Queen');
    expect(cleanTitle('Angels - Radio Edit')).toBe('Angels');
    expect(cleanTitle('Wind Of Change (Remastered 2002)')).toBe('Wind Of Change');
    expect(cleanTitle('Hold Me Now - Part 2')).toBe('Hold Me Now - Part 2');
    expect(cleanTitle('Major Tom (Völlig losgelöst)')).toBe('Major Tom (Völlig losgelöst)');
  });

  it('vergleicht ohne Akzente, Klammern und Satzzeichen', () => {
    expect(norm('Völlig  losgelöst!')).toBe('vollig losgelost');
    expect(norm('Rock & Roll (Live)')).toBe('rock and roll');
  });

  it('baut die Anfrage mit Datumsfilter und ohne Anführungszeichen im Namen', () => {
    const q = buildQuery('Say "Hello" - Remastered 2009', 'The Band');
    expect(q).toContain('recording:"Say Hello"');
    expect(q).toContain('artist:"The Band"');
    expect(q).toContain('firstreleasedate:[1900-01-01 TO 2100-12-31]');
  });
});

describe('ISRC-Rückfall', () => {
  it('baut die Anfrage nur für gültige Codes', () => {
    expect(buildIsrcQuery('ussm10008431')).toBe('isrc:USSM10008431 AND firstreleasedate:[1900-01-01 TO 2100-12-31]');
    expect(buildIsrcQuery('kaputt')).toBeNull();
    expect(buildIsrcQuery(null)).toBeNull();
  });
});

describe('Jahr aus MusicBrainz', () => {
  it('nimmt das früheste Jahr unter den passenden Treffern', () => {
    const r = pickMbYear('Bohemian Rhapsody - Remastered 2011', ['Queen'], [rec('Bohemian Rhapsody', '1975-10-31'), rec('Bohemian Rhapsody', '1991'), rec('Bohemian Rhapsody', '1975')]);
    expect(r).toEqual({ year: 1975, support: 2 });
  });

  it('ignoriert falschen Titel, falschen Interpreten, schwache Treffer und fehlende Daten', () => {
    const list = [rec('Bohemian Rhapsody (Live)', '1970'), rec('Other Song', '1960'), rec('Bohemian Rhapsody', '1960', 'Someone Else'), rec('Bohemian Rhapsody', '1950', 'Queen', 40), rec('Bohemian Rhapsody', undefined), rec('Bohemian Rhapsody', '1975')];
    expect(pickMbYear('Bohemian Rhapsody', ['Queen'], list)).toEqual({ year: 1975, support: 1 });
  });

  it('erkennt jeden von mehreren Interpreten und den Namen im artist-Objekt', () => {
    const r: MbRecording = { title: 'Song', score: 100, 'first-release-date': '1999', 'artist-credit': [{ artist: { name: 'Zweite Band' } }] };
    expect(pickMbYear('Song', ['Erste Band', 'Zweite Band'], [r])).toEqual({ year: 1999, support: 1 });
  });

  it('liefert null ohne Treffer oder mit unmöglichem Jahr', () => {
    expect(pickMbYear('Song', ['Queen'], [])).toBeNull();
    expect(pickMbYear('Song', ['Queen'], [rec('Song', '1800')])).toBeNull();
    expect(pickMbYear('', ['Queen'], [rec('', '1990')])).toBeNull();
  });
});

describe('Jahr entscheiden', () => {
  it('nimmt Spotify, wenn MusicBrainz nichts weiß', () => {
    expect(resolveYear(1999, null)).toEqual({ y: 1999, src: 'spotify' });
    expect(resolveYear(null, null)).toBeNull();
    expect(resolveYear(1800, null)).toBeNull();
  });

  it('nimmt das frühere Jahr: Neuauflagen sind nie älter als das Original', () => {
    expect(resolveYear(2011, { year: 1975, support: 5 })).toEqual({ y: 1975, src: 'mb' });
    expect(resolveYear(1990, { year: 1990, support: 1 })).toEqual({ y: 1990, src: 'spotify' });
  });

  it('markiert unsichere Fälle', () => {
    // ein einzelner Treffer, der weit vor Spotify liegt
    expect(resolveYear(2011, { year: 1975, support: 1 })).toEqual({ y: 1975, src: 'mb', unsure: true });
    // MusicBrainz liegt deutlich später als Spotify
    expect(resolveYear(1990, { year: 2005, support: 3 })).toEqual({ y: 1990, src: 'spotify', unsure: true });
    // ein Jahr Abstand ist normal (Single vs. Album)
    expect(resolveYear(1991, { year: 1990, support: 1 })).toEqual({ y: 1990, src: 'mb' });
    // ohne Spotify-Jahr genügt ein einzelner Treffer nicht
    expect(resolveYear(null, { year: 1980, support: 1 })).toEqual({ y: 1980, src: 'mb', unsure: true });
  });
});
