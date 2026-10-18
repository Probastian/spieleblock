import { Injectable, computed, inject, signal } from '@angular/core';
import { readJson, writeJson } from '../util/storage';
import { SpotifyApi, SpotifyError, type SpotifyDevice } from './spotify-api.service';
import { SpotifyAuth } from './spotify-auth.service';

const LS_PLAYER = 'spieleblock.spotify.player';

interface Stored {
  /** Soll dieses Gerät die Songs abspielen? */
  on: boolean;
  deviceId: string | null;
  deviceName: string;
}

/**
 * Die Wiedergabe über Spotify Connect. Jedes Gerät entscheidet selbst, ob es abspielt: Wer „Hier abspielen“
 * einschaltet, startet bei jeder neuen Karte den Song auf seinem gewählten Spotify-Gerät (Handy, Box, Computer).
 * Die Einstellung gehört dem Gerät und wird nicht am Live-Tisch geteilt.
 */
@Injectable({ providedIn: 'root' })
export class SpotifyPlayer {
  private readonly api = inject(SpotifyApi);
  private readonly auth = inject(SpotifyAuth);

  private readonly state = signal<Stored>({ on: false, deviceId: null, deviceName: '', ...readJson<Partial<Stored>>(LS_PLAYER) });
  /** Letzter Fehler als Meldung für die Oberfläche. */
  readonly error = signal('');
  readonly devices = signal<SpotifyDevice[]>([]);
  readonly busy = signal(false);
  private lastTrack = '';

  readonly on = computed(() => this.state().on && this.auth.loggedIn());
  readonly deviceName = computed(() => this.state().deviceName);
  readonly hasDevice = computed(() => !!this.state().deviceId);

  setOn(on: boolean): void {
    this.patch({ on });
    if (!on) this.error.set('');
  }

  selectDevice(d: SpotifyDevice): void {
    this.patch({ deviceId: d.id, deviceName: d.name });
    this.error.set('');
  }

  async refreshDevices(): Promise<void> {
    try {
      this.devices.set(await this.api.devices());
      this.error.set('');
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * Spielt einen Song, wenn dieses Gerät abspielen soll. Derselbe Song wird nicht doppelt gestartet,
   * außer `force` (Knopf „Nochmal“).
   */
  async play(trackId: string, force = false): Promise<void> {
    if (!this.on() || (!force && trackId === this.lastTrack)) return;
    this.lastTrack = trackId;
    this.busy.set(true);
    try {
      const id = await this.ensureDevice();
      if (!id) return;
      await this.api.play(id, trackId);
      this.error.set('');
    } catch (e) {
      this.lastTrack = '';
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async pause(): Promise<void> {
    const id = this.state().deviceId;
    if (!this.on() || !id) return;
    try {
      await this.api.pause(id);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Vergisst, welcher Song zuletzt lief (z. B. beim Verlassen des Spiels), damit er beim Zurückkehren wieder startet. */
  reset(): void {
    this.lastTrack = '';
  }

  /** Das gewählte Gerät, sonst das aktive oder einzige Gerät aus der Liste. */
  private async ensureDevice(): Promise<string | null> {
    const chosen = this.state().deviceId;
    if (chosen) return chosen;
    const list = await this.api.devices();
    this.devices.set(list);
    const pick = list.find(d => d.active) ?? (list.length === 1 ? list[0] : undefined);
    if (pick) {
      this.selectDevice(pick);
      return pick.id;
    }
    this.error.set(list.length ? 'Wähle ein Spotify-Gerät aus.' : 'Kein Spotify-Gerät gefunden. Öffne Spotify auf einem Gerät und spiel kurz etwas an.');
    return null;
  }

  private fail(e: unknown): void {
    const err = e instanceof SpotifyError ? e : null;
    this.error.set(err?.message ?? 'Die Wiedergabe hat nicht geklappt.');
    // Ein gespeichertes Gerät, das es nicht mehr gibt, soll nicht für immer hängen bleiben
    if (err?.kind === 'device') this.patch({ deviceId: null, deviceName: '' });
  }

  private patch(p: Partial<Stored>): void {
    const next = { ...this.state(), ...p };
    this.state.set(next);
    writeJson(LS_PLAYER, next);
  }
}
