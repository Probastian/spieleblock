import { hitster } from '@spieleblock/games';
import type { SpotifyTrack } from '../spotify/spotify.util';

const ENDPOINT = 'https://musicbrainz.org/ws/2/recording';
const TIMEOUT_MS = 12_000;
const RETRY_WAIT_MS = [3000, 6000, 12_000, 24_000];
/** So viele ISRCs in einer Anfrage. Zu jeder gibt es nur wenige Aufnahmen, die Antwort (höchstens 100 Treffer) reicht dafür. */
export const ISRC_BATCH = 20;

/** MusicBrainz ist nicht erreichbar oder lehnt dauerhaft ab (nicht: kein Treffer). */
export class MusicBrainzDown extends Error {}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Eine Suche. Bei „Server beschäftigt“ (503) oder Drosselung (429) wird mit wachsender Pause wiederholt. */
async function search(query: string, signal?: AbortSignal): Promise<hitster.MbRecording[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&fmt=json&limit=100`;
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      if (res.ok) return ((await res.json()) as { recordings?: hitster.MbRecording[] }).recordings ?? [];
      if (res.status !== 503 && res.status !== 429) throw new MusicBrainzDown(`MusicBrainz ${res.status}`);
    } catch (e) {
      if (signal?.aborted) throw e;
      if (e instanceof MusicBrainzDown) throw e;
      // Netzwerkfehler oder Zeitüberschreitung: wie „beschäftigt“ behandeln
    } finally {
      clearTimeout(timer);
    }
    const wait = RETRY_WAIT_MS[attempt];
    if (wait === undefined) throw new MusicBrainzDown('MusicBrainz antwortet nicht');
    await sleep(wait);
  }
}

/**
 * Schnelle Stufe: das früheste Erscheinungsjahr der Aufnahme je ISRC, viele Songs in einer Anfrage.
 * Songs ohne Ergebnis fehlen in der Antwort.
 */
export async function lookupIsrcBatch(tracks: readonly SpotifyTrack[], signal?: AbortSignal): Promise<Map<string, hitster.MbYear>> {
  const found = new Map<string, hitster.MbYear>();
  const query = hitster.buildIsrcBatchQuery(tracks.map(t => t.isrc));
  if (!query) return found;
  const recordings = await search(query, signal);
  for (const t of tracks) {
    const code = hitster.normIsrc(t.isrc);
    const year = code ? hitster.pickMbYearByIsrc(code, recordings) : null;
    if (code && year) found.set(code, year);
  }
  return found;
}

/** Genaue Stufe: Suche nach Titel und Interpret. Findet auch das Original, wenn Spotify eine Neuauflage nennt, braucht aber eine Anfrage je Song. */
export async function lookupYear(track: SpotifyTrack, signal?: AbortSignal): Promise<hitster.MbYear | null> {
  const recordings = await search(hitster.buildQuery(track.title, track.artists[0] ?? ''), signal);
  return hitster.pickMbYear(track.title, track.artists, recordings);
}
