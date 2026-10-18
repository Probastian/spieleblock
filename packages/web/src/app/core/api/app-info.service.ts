import { Injectable, signal } from '@angular/core';
import { ENDPOINTS, type InfoResponse } from '@spieleblock/shared';

/** Was der Server über sich verrät, ohne Zugangscode: die Release-Version. */
@Injectable({ providedIn: 'root' })
export class AppInfo {
  /** Release-Version des Servers (`v2.0.1`, `dev` ohne Release); leer, solange nicht geladen. */
  readonly version = signal('');
  /** Client-ID der Spotify-App (Hitster); leer, wenn der Server keine hat. */
  readonly spotifyClientId = signal('');
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const res = await fetch(ENDPOINTS.info, { cache: 'no-store' });
      const info = (await res.json()) as Partial<InfoResponse>;
      if (typeof info.version === 'string') this.version.set(info.version);
      if (typeof info.spotifyClientId === 'string') this.spotifyClientId.set(info.spotifyClientId);
    } catch {
      this.loaded = false; // offline: beim nächsten Öffnen nochmal
    }
  }
}
