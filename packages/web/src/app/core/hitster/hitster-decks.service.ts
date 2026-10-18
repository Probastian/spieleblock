import { Injectable, computed, inject, signal } from '@angular/core';
import { hitster } from '@spieleblock/games';
import { SpotifyApi, SpotifyError, type LoadedPlaylist } from '../spotify/spotify-api.service';
import { artistLine, duplicateKey, type SpotifyTrack } from '../spotify/spotify.util';
import { Store } from '../state/store.service';
import { ISRC_BATCH, MusicBrainzDown, lookupIsrcBatch, lookupYear } from './musicbrainz';

type Options = hitster.HitsterOptions;

const REQUEST_GAP_MS = 1100;
const SAVE_EVERY = 8;
const CACHE_MS = 5 * 60_000;
/** So viele Songs hintereinander ohne Antwort von MusicBrainz, dann pausiert die Prüfung. */
const MAX_FAILURES = 3;

export interface YearCheck {
  playlistId: string;
  done: number;
  total: number;
  state: 'running' | 'done' | 'stopped' | 'down';
}

export interface DeckCards {
  cards: hitster.HitsterCard[];
  /** Songs, die noch keine MusicBrainz-Prüfung hatten (Jahr kommt dann von Spotify). */
  unchecked: number;
  /** Songs, deren Jahr zur Kontrolle markiert ist. */
  unsure: number;
  /** Ohne verwertbares Jahr aussortiert. */
  dropped: number;
  /** Gleicher Song mehrfach in der Playlist. */
  duplicates: number;
}

/**
 * Playlists für Hitster: einlesen, Jahre prüfen, Karten daraus bauen. Die geprüften Jahre liegen in den
 * Einstellungen des Spiels (und damit auf allen Geräten), die Songs selbst werden immer frisch von Spotify gelesen.
 */
@Injectable({ providedIn: 'root' })
export class HitsterDecks {
  private readonly store = inject(Store);
  private readonly api = inject(SpotifyApi);

  readonly options = computed(() => this.store.options<Options>('hitster'));
  readonly years = computed(() => this.options().years);
  readonly decks = computed(() => this.options().decks);
  /** Läuft gerade eine Jahresprüfung? */
  readonly check = signal<YearCheck | null>(null);

  private cache = new Map<string, { at: number; playlist: LoadedPlaylist }>();
  private abort: AbortController | null = null;

  /** Liest eine Playlist (kurz zwischengespeichert) und merkt sie in der Bibliothek. */
  async load(input: string, onProgress?: (done: number, total: number) => void, fresh = false): Promise<LoadedPlaylist> {
    const hit = [...this.cache.values()].find(c => Date.now() - c.at < CACHE_MS && (c.playlist.id === input || input.includes(c.playlist.id)));
    if (hit && !fresh) return hit.playlist;
    const playlist = await this.api.playlist(input, onProgress);
    this.cache.set(playlist.id, { at: Date.now(), playlist });
    this.remember(playlist);
    return playlist;
  }

  remove(id: string): void {
    this.store.updateMeta(m => {
      const o = m.settings.games['hitster'] as Options;
      o.decks = o.decks.filter(d => d.id !== id);
      if (o.source?.id === id) o.source = null;
    });
  }

  select(id: string): void {
    const d = this.decks().find(x => x.id === id);
    this.store.setGameOptions<Options>('hitster', { source: d ? { id: d.id, name: d.name } : null });
  }

  /** Baut die Karten einer Playlist aus den bekannten Jahren. Für noch nicht geprüfte Songs gilt das Spotify-Jahr. */
  cardsOf(playlist: LoadedPlaylist): DeckCards {
    const years = this.years();
    const seen = new Set<string>();
    const out: DeckCards = { cards: [], unchecked: 0, unsure: 0, dropped: 0, duplicates: 0 };
    for (const t of playlist.tracks) {
      const known = years[t.id];
      const entry = known ?? hitster.resolveYear(t.year, null);
      if (!entry) {
        out.dropped++;
        continue;
      }
      const key = duplicateKey(t, hitster.norm, hitster.cleanTitle);
      if (seen.has(key)) {
        out.duplicates++;
        continue;
      }
      seen.add(key);
      if (!known) out.unchecked++;
      if (entry.unsure && entry.src !== 'user') out.unsure++;
      out.cards.push({ id: t.id, title: t.title.slice(0, 80), artist: artistLine(t.artists), year: entry.y, ...(t.cover ? { cover: t.cover } : {}) });
    }
    return out;
  }

  /** Karten für ein neues Spiel: Playlist lesen und Karten bauen. */
  async build(source: hitster.DeckRef): Promise<DeckCards & { playlist: LoadedPlaylist }> {
    const playlist = await this.load(source.id);
    return { ...this.cardsOf(playlist), playlist };
  }

  /** Trägt ein Jahr von Hand ein; es gilt ab sofort in allen Spielen mit diesem Song. */
  setUserYear(trackId: string, year: number): void {
    this.writeYears({ [trackId]: { y: year, src: 'user' } });
  }

  // ------------------------------------------------------------ Jahresprüfung
  /**
   * Prüft alle Songs der Playlist ohne bekannte Jahre bei MusicBrainz. Läuft im Hintergrund, bis fertig oder abgebrochen.
   *
   * Zwei Stufen, weil MusicBrainz nur etwa eine Anfrage pro Sekunde erlaubt:
   * 1. schnell: je 20 Songs in einer Anfrage über ihre ISRC,
   * 2. genau: einzeln nach Titel und Interpret, aber nur für Songs, bei denen das Albumjahr falsch sein kann
   *    (Remaster, Sammler, Neuauflage) oder die ISRC nichts ergab.
   */
  async checkYears(playlist: LoadedPlaylist): Promise<void> {
    if (this.check()?.state === 'running') return;
    const todo = playlist.tracks.filter(t => !this.years()[t.id]);
    const total = todo.length;
    if (!total) {
      this.check.set({ playlistId: playlist.id, done: 0, total: 0, state: 'done' });
      return;
    }
    this.abort = new AbortController();
    const { signal } = this.abort;
    let done = 0;
    let failures = 0;
    let pending: Record<string, hitster.YearEntry> = {};
    const set = (state: YearCheck['state']) => this.check.set({ playlistId: playlist.id, done, total, state });
    const flush = () => {
      if (Object.keys(pending).length) this.writeYears(pending);
      pending = {};
    };
    const finish = (t: SpotifyTrack, mb: hitster.MbYear | null) => {
      const entry = hitster.resolveYear(t.year, mb);
      if (entry) pending[t.id] = entry;
      done++;
    };
    let last = 0;
    const pause = async () => {
      const wait = last + REQUEST_GAP_MS - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      last = Date.now();
      if (signal.aborted) throw new DOMException('abgebrochen', 'AbortError');
    };
    /** Ein Fehlschlag von MusicBrainz überspringt den Schritt; nach mehreren hintereinander pausiert die Prüfung. */
    const guarded = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        const r = await fn();
        failures = 0;
        return r;
      } catch (e) {
        if (!(e instanceof MusicBrainzDown) || ++failures >= MAX_FAILURES) throw e;
        return undefined;
      }
    };

    set('running');
    try {
      // Stufe 1: viele Songs je Anfrage
      const byIsrc = new Map<string, hitster.MbYear>();
      const withIsrc = todo.filter(t => hitster.normIsrc(t.isrc));
      for (let i = 0; i < withIsrc.length; i += ISRC_BATCH) {
        await pause();
        const found = await guarded(() => lookupIsrcBatch(withIsrc.slice(i, i + ISRC_BATCH), signal));
        for (const [code, y] of found ?? []) byIsrc.set(code, y);
      }

      // Wem trauen wir der schnellen Antwort? Nur Songs von gewöhnlichen Alben mit Treffer.
      const exact: SpotifyTrack[] = [];
      for (const t of todo) {
        const quick = byIsrc.get(hitster.normIsrc(t.isrc) ?? '') ?? null;
        if (quick && !hitster.needsOriginalCheck(t)) finish(t, quick);
        else exact.push(t);
      }
      flush();
      set('running');

      // Stufe 2: einzeln, nur wo es nötig ist
      for (const t of exact) {
        await pause();
        const byName = await guarded(() => lookupYear(t, signal));
        if (byName === undefined) continue; // MusicBrainz war nicht erreichbar: später nochmal
        finish(t, hitster.earliest(byName, byIsrc.get(hitster.normIsrc(t.isrc) ?? '') ?? null));
        if (done % SAVE_EVERY === 0) flush();
        set('running');
      }
      flush();
      set('done');
    } catch (e) {
      flush();
      set(e instanceof MusicBrainzDown ? 'down' : 'stopped');
    } finally {
      this.abort = null;
    }
  }

  stopCheck(): void {
    this.abort?.abort();
  }

  // ----------------------------------------------------------------- intern
  private remember(p: LoadedPlaylist): void {
    this.store.updateMeta(m => {
      const o = m.settings.games['hitster'] as Options;
      const info: hitster.DeckInfo = { id: p.id, name: p.name, count: p.tracks.length, at: Date.now() };
      o.decks = [info, ...o.decks.filter(d => d.id !== p.id)].slice(0, hitster.MAX_DECKS);
      o.source ??= { id: p.id, name: p.name };
      if (o.source.id === p.id) o.source.name = p.name;
    });
  }

  /** Schreibt Jahre in die Einstellungen, ohne spätere Änderungen anderer Geräte zu überschreiben. */
  private writeYears(updates: Record<string, hitster.YearEntry>): void {
    this.store.updateMeta(m => {
      const o = m.settings.games['hitster'] as Options;
      o.years = hitster.normalizeYears({ ...o.years, ...updates });
    });
  }

  /** Für die Oberfläche: Spotify-Fehler lesbar machen. */
  errorText(e: unknown): string {
    return e instanceof SpotifyError ? e.message : 'Das hat nicht geklappt.';
  }

  trackYear(t: SpotifyTrack): hitster.YearEntry | null {
    return this.years()[t.id] ?? hitster.resolveYear(t.year, null);
  }
}
