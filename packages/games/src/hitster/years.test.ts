import { describe, expect, it } from 'vitest';
import { buildIsrcBatchQuery, buildQuery, earliest, needsOriginalCheck, normIsrc, pickMbYearByIsrc, cleanTitle, norm, pickMbYear, resolveYear, type MbRecording } from './years';

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

describe('ISRC-Abfrage für viele Songs', () => {
  it('baut eine Anfrage aus allen gültigen ISRCs, ohne Doppelte', () => {
    const q = buildIsrcBatchQuery(['ussm10008431', 'GBCEL0300192', 'USSM10008431', 'kaputt', null]);
    expect(q).toBe('(isrc:USSM10008431 OR isrc:GBCEL0300192) AND firstreleasedate:[1900-01-01 TO 2100-12-31]');
    expect(buildIsrcBatchQuery(['kaputt', null])).toBeNull();
    expect(buildIsrcBatchQuery([])).toBeNull();
    expect(normIsrc(' gbcel0300192 ')).toBe('GBCEL0300192');
    expect(normIsrc('zu kurz')).toBeNull();
  });

  const withIsrc = (isrc: string, date: string | undefined): MbRecording => ({ title: 'x', score: 100, 'first-release-date': date, isrcs: [{ id: isrc }] });

  it('ordnet Treffer über die ISRC zu und nimmt das früheste Jahr', () => {
    const list = [withIsrc('USSM10008431', '2000-09-29'), withIsrc('USSM10008431', '2004'), withIsrc('GBCEL0300192', '2003-10-20'), withIsrc('USSM10008431', undefined)];
    expect(pickMbYearByIsrc('ussm10008431', list)).toEqual({ year: 2000, support: 1 });
    expect(pickMbYearByIsrc('GBCEL0300192', list)).toEqual({ year: 2003, support: 1 });
    expect(pickMbYearByIsrc('USRC10800300', list)).toBeNull();
    expect(pickMbYearByIsrc(null, list)).toBeNull();
    expect(pickMbYearByIsrc('USSM10008431', [withIsrc('USSM10008431', '1800')])).toBeNull();
  });

  it('wählt das frühere von zwei Fundstellen', () => {
    expect(earliest({ year: 1990, support: 2 }, { year: 1985, support: 1 })).toEqual({ year: 1985, support: 1 });
    expect(earliest({ year: 1980, support: 2 }, { year: 1985, support: 1 })).toEqual({ year: 1980, support: 2 });
    expect(earliest(null, { year: 1985, support: 1 })).toEqual({ year: 1985, support: 1 });
    expect(earliest(null, null)).toBeNull();
  });
});

describe('Verdächtige Alben', () => {
  const track = (album: string, albumType = 'album', title = 'Song') => ({ title, album, albumType });

  it('erkennt Neuauflagen und Sammler, bei denen das Albumjahr vom Original abweichen kann', () => {
    expect(needsOriginalCheck(track('Greatest Hits'))).toBe(true);
    expect(needsOriginalCheck(track('The Best Of 1980-1990'))).toBe(true);
    expect(needsOriginalCheck(track('Nevermind (Deluxe Edition)'))).toBe(true);
    expect(needsOriginalCheck(track('Rumours (Remastered)'))).toBe(true);
    expect(needsOriginalCheck(track('Irgendwas', 'compilation'))).toBe(true);
    expect(needsOriginalCheck(track('Bravo Hits 42'))).toBe(true);
    expect(needsOriginalCheck(track('Gold'))).toBe(true);
    expect(needsOriginalCheck(track('Abbey Road', 'album', 'Come Together - 2019 Mix'))).toBe(false); // der Titel allein zählt nur bei bekannten Wörtern
    expect(needsOriginalCheck(track('Abbey Road', 'album', 'Something - Remastered 2009'))).toBe(true);
  });

  it('lässt gewöhnliche Alben und Singles durch', () => {
    expect(needsOriginalCheck(track('Nevermind'))).toBe(false);
    expect(needsOriginalCheck(track('Hot Fuss'))).toBe(false);
    expect(needsOriginalCheck(track('Take Me Out', 'single'))).toBe(false);
    expect(needsOriginalCheck(track('Crazy World'))).toBe(false);
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
