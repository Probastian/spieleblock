import { Injectable, inject } from '@angular/core';
import { SpotifyAuth } from './spotify-auth.service';
import { describeSpotifyError, parsePlaylistId, playlistHitOf, playlistImageOf, trackOf, type PlaylistHit, type SpotifyErrorKind, type SpotifyTrack } from './spotify.util';

const API = 'https://api.spotify.com/v1';
const PAGE = 50;
const MAX_PAGES = 40;
const MAX_WAIT_MS = 10_000;

export class SpotifyError extends Error {
  constructor(
    readonly kind: SpotifyErrorKind,
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

export interface LoadedPlaylist {
  id: string;
  name: string;
  tracks: SpotifyTrack[];
  /** Einträge, die nicht spielbar waren (lokale Dateien, Podcasts, gesperrt). */
  skipped: number;
  /** Mehr Einträge, als wir lesen. */
  truncated: boolean;
  owner: string;
  image: string | null;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Die wenigen Spotify-Aufrufe, die Hitster braucht: Playlist lesen, Geräte listen, abspielen. */
@Injectable({ providedIn: 'root' })
export class SpotifyApi {
  private readonly auth = inject(SpotifyAuth);

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T | null> {
    const token = await this.auth.token();
    if (!token) throw new SpotifyError('auth', describeSpotifyError(401, undefined).message, 401);

    let res: Response;
    try {
      res = await fetch(API + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new SpotifyError('network', describeSpotifyError(0, undefined).message);
    }

    if (res.status === 401 && !retried && (await this.auth.refresh())) return this.request<T>(method, path, body, true);
    if (res.status === 429 && !retried) {
      const wait = Math.min(MAX_WAIT_MS, (Number(res.headers.get('retry-after')) || 1) * 1000);
      await sleep(wait);
      return this.request<T>(method, path, body, true);
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { reason?: string } } | null;
      const e = describeSpotifyError(res.status, json?.error?.reason);
      throw new SpotifyError(e.kind, e.message, res.status);
    }
    if (res.status === 204) return null;
    return (await res.json().catch(() => null)) as T | null;
  }

  /** Liest eine Playlist komplett (bis zu einer Obergrenze). Ungeeignete Einträge werden gezählt, nicht geliefert. */
  async playlist(input: string, onProgress?: (done: number, total: number) => void): Promise<LoadedPlaylist> {
    const id = parsePlaylistId(input);
    if (!id) throw new SpotifyError('notfound', 'Das sieht nicht nach einer Spotify-Playlist aus. Füge den Link zur Playlist ein.');

    const head = await this.playlistHead(id);
    const tracks: SpotifyTrack[] = [];
    let skipped = 0;
    let total = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await this.request<{ items?: unknown[]; total?: number; next?: string | null }>('GET', `/playlists/${id}/items?limit=${PAGE}&offset=${page * PAGE}&market=from_token`);
      const items = data?.items ?? [];
      total = data?.total ?? total;
      for (const entry of items) {
        const t = trackOf(entry);
        if (t) tracks.push(t);
        else skipped++;
      }
      onProgress?.(Math.min(total, (page + 1) * PAGE), total);
      if (!data?.next || !items.length) break;
    }
    return { id, name: head?.name?.slice(0, 80) || 'Playlist', tracks, skipped, truncated: total > MAX_PAGES * PAGE, owner: head?.owner ?? '', image: head?.image ?? null };
  }

  private async playlistHead(id: string): Promise<{ name: string; owner: string; image: string | null; total: number | null } | null> {
    const h = await this.request<Record<string, any>>('GET', `/playlists/${id}?fields=name,images,owner(display_name),tracks.total,items.total`);
    if (!h) return null;
    const total = Number(h['tracks']?.['total'] ?? h['items']?.['total']);
    return { name: String(h['name'] ?? ''), owner: String(h['owner']?.['display_name'] ?? ''), image: playlistImageOf(h['images']), total: Number.isFinite(total) ? total : null };
  }

  /** Kurzinfo zu einer Playlist (für einen eingefügten Link), ohne alle Songs zu laden. */
  async playlistInfo(input: string): Promise<PlaylistHit> {
    const id = parsePlaylistId(input);
    if (!id) throw new SpotifyError('notfound', 'Das sieht nicht nach einer Spotify-Playlist aus.');
    const h = await this.playlistHead(id);
    return { id, name: h?.name.slice(0, 80) || 'Playlist', owner: (h?.owner ?? '').slice(0, 40), tracks: h?.total ?? null, image: h?.image ?? null };
  }

  /** Die eigenen und abonnierten Playlists (bis zu 150). */
  async myPlaylists(): Promise<PlaylistHit[]> {
    const out: PlaylistHit[] = [];
    for (let page = 0; page < 3; page++) {
      const data = await this.request<{ items?: unknown[]; next?: string | null }>('GET', `/me/playlists?limit=50&offset=${page * 50}`);
      for (const raw of data?.items ?? []) {
        const hit = playlistHitOf(raw);
        if (hit) out.push(hit);
      }
      if (!data?.next) break;
    }
    return out;
  }

  /** Öffentliche Playlists suchen (Spotify liefert für neue Apps höchstens 10 je Anfrage). */
  async searchPlaylists(query: string): Promise<PlaylistHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const data = await this.request<{ playlists?: { items?: unknown[] } }>('GET', `/search?q=${encodeURIComponent(q)}&type=playlist&limit=10`);
    return (data?.playlists?.items ?? []).map(playlistHitOf).filter((h): h is PlaylistHit => !!h);
  }

  async devices(): Promise<SpotifyDevice[]> {
    const data = await this.request<{ devices?: { id: string | null; name: string; type: string; is_active: boolean; is_restricted?: boolean }[] }>('GET', '/me/player/devices');
    return (data?.devices ?? []).filter(d => d.id && !d.is_restricted).map(d => ({ id: d.id!, name: d.name, type: d.type, active: d.is_active }));
  }

  /** Startet einen Song auf dem Gerät. Weckt auch ein Gerät, das gerade nichts spielt. */
  async play(deviceId: string, trackId: string): Promise<void> {
    await this.request('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { uris: [`spotify:track:${trackId}`] });
  }

  /** Setzt die Wiedergabe auf dem Gerät fort, wo sie angehalten wurde. */
  async resume(deviceId: string): Promise<void> {
    await this.request('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`);
  }

  /** Was spielt gerade? `null`, wenn auf keinem Gerät etwas läuft oder angehalten ist (Spotify antwortet dann mit 204). */
  async state(): Promise<{ playing: boolean; trackId: string } | null> {
    const data = await this.request<{ is_playing?: boolean; item?: { id?: string } | null }>('GET', '/me/player');
    return data ? { playing: !!data.is_playing, trackId: String(data.item?.id ?? '') } : null;
  }

  async pause(deviceId: string): Promise<void> {
    await this.request('PUT', `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`);
  }
}
