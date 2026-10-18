import { hitster } from '@spieleblock/games';
import type { SpotifyTrack } from '../spotify/spotify.util';

const ENDPOINT = 'https://musicbrainz.org/ws/2/recording';
const TIMEOUT_MS = 12_000;
const RETRY_WAIT_MS = [3000, 6000, 12_000, 24_000];

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
 * Frühestes Erscheinungsjahr eines Songs laut MusicBrainz, oder `null` ohne passenden Treffer.
 * Erst Titel und Interpret, bei Misserfolg die ISRC des Spotify-Tracks. `pause` hält den Abstand zwischen den Anfragen ein.
 */
export async function lookupYear(track: SpotifyTrack, pause: () => Promise<void>, signal?: AbortSignal): Promise<hitster.MbYear | null> {
  const artist = track.artists[0] ?? '';
  const byName = hitster.pickMbYear(track.title, track.artists, await search(hitster.buildQuery(track.title, artist), signal));
  if (byName) return byName;
  const isrcQuery = hitster.buildIsrcQuery(track.isrc);
  if (!isrcQuery) return null;
  await pause();
  return hitster.pickMbYear(track.title, track.artists, await search(isrcQuery, signal));
}
