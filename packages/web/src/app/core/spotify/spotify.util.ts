/** Reine Hilfen für die Spotify-Anbindung (ohne Angular, gut testbar). */

export const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state';

export interface SpotifyTrack {
  id: string;
  title: string;
  artists: string[];
  /** Jahr des Albums laut Spotify (kann bei Sammlern und Neuauflagen vom Original abweichen). */
  year: number | null;
  isrc: string | null;
  /** Name und Art des Albums (`album`, `single`, `compilation`), damit Neuauflagen und Sampler auffallen. */
  album: string;
  albumType: string;
  /** Bild-ID des Albumcovers (40 Hex-Zeichen der Adresse bei `i.scdn.co`), falls vorhanden. */
  cover: string | null;
}

const base64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Zufälliger Text aus Zeichen, die in URLs unverändert bleiben. */
export function randomToken(bytes = 48): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** PKCE-Prüfwert: SHA-256 des Verifiers, URL-sicher kodiert. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/** Playlist-ID aus einem Link (`open.spotify.com/playlist/…?si=…`), einer URI (`spotify:playlist:…`) oder der nackten ID. */
export function parsePlaylistId(input: string): string | null {
  const text = input.trim();
  const m = text.match(/playlist[/:]([A-Za-z0-9]{10,40})/) ?? text.match(/^([A-Za-z0-9]{10,40})$/);
  return m ? m[1]! : null;
}

/** Jahr aus Spotify-Datum (`2004-02-16`, `2004-02` oder `2004`). */
export function yearOf(date: unknown): number | null {
  const y = parseInt(String(date ?? '').slice(0, 4), 10);
  return y >= 1900 && y <= 2100 ? y : null;
}

/** Bild-ID aus der Cover-Liste von Spotify: das kleinste Bild ab etwa 250 Pixeln (scharf genug für die Karte, aber nicht unnötig groß), sonst das größte vorhandene. */
export function coverIdOf(images: unknown): string | null {
  const list = (Array.isArray(images) ? images : [])
    .map((i: any) => ({ w: Number(i?.width) || 0, id: String(i?.url ?? '').split('/').pop() ?? '' }))
    .filter(i => /^[a-f0-9]{40}$/.test(i.id));
  const sharp = list.filter(i => i.w >= 250).sort((a, b) => a.w - b.w);
  return (sharp[0] ?? list.sort((a, b) => b.w - a.w)[0])?.id ?? null;
}

/**
 * Macht aus einem Eintrag der Playlist einen Track, oder `null` für alles, was nicht spielbar ist:
 * lokale Dateien, Podcast-Folgen, gelöschte oder im Land gesperrte Songs.
 * Die Antwort enthält den Song je nach Fassung unter `item` oder `track`.
 */
export function trackOf(entry: unknown): SpotifyTrack | null {
  const e = entry as Record<string, any> | null;
  const t = (e?.['item'] ?? e?.['track']) as Record<string, any> | null | undefined;
  if (!e || !t || e['is_local'] || t['is_local'] || (t['type'] && t['type'] !== 'track') || t['is_playable'] === false) return null;
  if (typeof t['id'] !== 'string' || !/^[A-Za-z0-9]{10,30}$/.test(t['id']) || typeof t['name'] !== 'string') return null;
  const artists = (Array.isArray(t['artists']) ? t['artists'] : []).map((a: any) => String(a?.name ?? '')).filter(Boolean);
  if (!artists.length) return null;
  return { id: t['id'], title: t['name'], artists, year: yearOf(t['album']?.['release_date']), isrc: typeof t['external_ids']?.['isrc'] === 'string' ? t['external_ids']['isrc'] : null, cover: coverIdOf(t['album']?.['images']), album: String(t['album']?.['name'] ?? '').slice(0, 120), albumType: String(t['album']?.['album_type'] ?? '') };
}

export interface PlaylistHit {
  id: string;
  name: string;
  owner: string;
  /** Anzahl Songs, falls Spotify sie nennt. */
  tracks: number | null;
  /** Adresse des Titelbilds bei Spotify, falls vorhanden. */
  image: string | null;
}

/** Titelbild einer Playlist: das kleinste ab 100 Pixeln (sonst das erste). Nur Adressen von Spotifys Bilderservern. */
export function playlistImageOf(images: unknown): string | null {
  const list = (Array.isArray(images) ? images : [])
    .map((i: any) => ({ w: Number(i?.width) || 0, url: String(i?.url ?? '') }))
    .filter(i => /^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\//i.test(i.url));
  const sharp = list.filter(i => i.w >= 100).sort((a, b) => a.w - b.w);
  return (sharp[0] ?? list[0])?.url ?? null;
}

/** Ein Eintrag aus „Meine Playlists“ oder der Suche; `null` für gelöschte oder unbrauchbare Einträge (Spotify liefert dort manchmal `null`). */
export function playlistHitOf(raw: unknown): PlaylistHit | null {
  const p = raw as Record<string, any> | null;
  if (!p || typeof p['id'] !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(p['id']) || typeof p['name'] !== 'string' || !p['name']) return null;
  // Die Anzahl heißt je nach Fassung der Antwort `tracks.total` oder `items.total`
  const total = Number(p['tracks']?.['total'] ?? p['items']?.['total']);
  return { id: p['id'], image: playlistImageOf(p['images']), name: p['name'].slice(0, 80), owner: String(p['owner']?.['display_name'] ?? p['owner']?.['id'] ?? '').slice(0, 40), tracks: Number.isFinite(total) ? total : null };
}

/** Anzeige-Interpret für die Karte: alle Namen, gekürzt. */
export const artistLine = (artists: readonly string[]): string => artists.join(', ').slice(0, 60);

/** Gleicher Song unter anderer ID (Single, Album, Sampler): Titel und erster Interpret ohne Zusätze. */
export function duplicateKey(track: Pick<SpotifyTrack, 'title' | 'artists'>, norm: (s: string) => string, clean: (s: string) => string): string {
  return norm(clean(track.title)) + '|' + norm(track.artists[0] ?? '');
}

export type SpotifyErrorKind = 'auth' | 'premium' | 'device' | 'forbidden' | 'notfound' | 'rate' | 'network' | 'other';

/** Spotify-Fehler in eine Art und eine verständliche Meldung übersetzen. */
export function describeSpotifyError(status: number, reason: string | undefined): { kind: SpotifyErrorKind; message: string } {
  if (status === 0) return { kind: 'network', message: 'Spotify ist gerade nicht erreichbar.' };
  if (status === 401) return { kind: 'auth', message: 'Die Spotify-Anmeldung ist abgelaufen. Bitte neu anmelden.' };
  if (reason === 'PREMIUM_REQUIRED') return { kind: 'premium', message: 'Zum Steuern der Wiedergabe braucht das Spotify-Konto Premium.' };
  if (reason === 'NO_ACTIVE_DEVICE' || status === 404) return { kind: status === 404 && reason !== 'NO_ACTIVE_DEVICE' && reason !== 'DEVICE_NOT_FOUND' ? 'notfound' : 'device', message: 'Kein Spotify-Gerät gefunden. Öffne Spotify auf einem Gerät und wähle es aus.' };
  if (status === 403) return { kind: 'forbidden', message: 'Spotify verweigert den Zugriff. Ist das Konto in der Spotify-App freigeschaltet (Entwicklermodus: höchstens 5 Nutzer)?' };
  if (status === 429) return { kind: 'rate', message: 'Spotify bremst gerade. Gleich nochmal versuchen.' };
  return { kind: 'other', message: 'Spotify hat einen Fehler gemeldet.' };
}
