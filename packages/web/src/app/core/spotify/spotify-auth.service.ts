import { Injectable, computed, inject, signal } from '@angular/core';
import { AppInfo } from '../api/app-info.service';
import { readJson, removeKey, writeJson } from '../util/storage';
import { SPOTIFY_SCOPES, pkceChallenge, randomToken } from './spotify.util';

const LS_TOKEN = 'spieleblock.spotify.token';
const LS_PKCE = 'spieleblock.spotify.pkce';
const EXPIRY_MARGIN_MS = 60_000;

interface Stored {
  access: string;
  refresh: string;
  /** Ablaufzeit des Zugriffstokens (ms). */
  exp: number;
}

interface Pkce {
  verifier: string;
  state: string;
  /** Wohin es nach dem Login zurückgeht. */
  back: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export type CallbackResult = { ok: true; back: string } | { ok: false; reason: 'denied' | 'invalid' | 'failed' };

/**
 * Spotify-Anmeldung per Authorization Code mit PKCE. Es gibt kein Client-Secret: Alles läuft im Browser.
 * Die Tokens bleiben auf diesem Gerät (`localStorage`) und werden nie mit dem Server oder anderen Geräten geteilt.
 */
@Injectable({ providedIn: 'root' })
export class SpotifyAuth {
  private readonly info = inject(AppInfo);

  private readonly stored = signal<Stored | null>(readJson<Stored>(LS_TOKEN));
  private refreshing: Promise<boolean> | null = null;

  /** Hat der Server eine Spotify-App hinterlegt? */
  readonly available = computed(() => !!this.info.spotifyClientId());
  readonly loggedIn = computed(() => !!this.stored()?.refresh);

  /** Holt die Client-ID vom Server (einmalig); davor ist `available` noch falsch. */
  init(): Promise<void> {
    return this.info.load();
  }

  /** Die Adresse, die in der Spotify-App als Redirect-URI eingetragen sein muss. */
  get redirectUri(): string {
    return `${location.origin}/spotify`;
  }

  async login(back: string): Promise<void> {
    await this.init();
    const clientId = this.info.spotifyClientId();
    if (!clientId) return;
    const verifier = randomToken(64);
    const state = randomToken(12);
    writeJson(LS_PKCE, { verifier, state, back } satisfies Pkce);
    const url = new URL('https://accounts.spotify.com/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge: await pkceChallenge(verifier),
      state,
    }).toString();
    location.assign(url.toString());
  }

  /** Wird auf der Rückkehr-Seite `/spotify` aufgerufen: tauscht den Code gegen Tokens. */
  async handleCallback(params: URLSearchParams): Promise<CallbackResult> {
    await this.init();
    const pkce = readJson<Pkce>(LS_PKCE);
    removeKey(LS_PKCE);
    if (params.get('error')) return { ok: false, reason: 'denied' };
    const code = params.get('code');
    if (!pkce || !code || params.get('state') !== pkce.state) return { ok: false, reason: 'invalid' };
    const ok = await this.requestToken({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri, code_verifier: pkce.verifier });
    return ok ? { ok: true, back: pkce.back.startsWith('/') ? pkce.back : '/spiele' } : { ok: false, reason: 'failed' };
  }

  logout(): void {
    removeKey(LS_TOKEN);
    this.stored.set(null);
  }

  /** Ein gültiges Zugriffstoken oder `null`, wenn nicht angemeldet bzw. die Erneuerung scheitert. */
  async token(): Promise<string | null> {
    const s = this.stored();
    if (!s) return null;
    if (s.exp - Date.now() > EXPIRY_MARGIN_MS) return s.access;
    return (await this.refresh()) ? (this.stored()?.access ?? null) : null;
  }

  /** Erneuert das Token (auch erzwungen, falls Spotify es als abgelaufen meldet). */
  refresh(): Promise<boolean> {
    const s = this.stored();
    if (!s?.refresh) return Promise.resolve(false);
    this.refreshing ??= this.requestToken({ grant_type: 'refresh_token', refresh_token: s.refresh }, s.refresh).finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async requestToken(body: Record<string, string>, keepRefresh?: string): Promise<boolean> {
    const clientId = this.info.spotifyClientId();
    if (!clientId) return false;
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...body, client_id: clientId }),
      });
      const json = (await res.json().catch(() => ({}))) as TokenResponse;
      if (!res.ok || !json.access_token) {
        // Der Refresh-Token ist ungültig (zurückgezogen oder abgelaufen): neu anmelden
        if (res.status === 400 || res.status === 401) this.logout();
        return false;
      }
      const next: Stored = { access: json.access_token, refresh: json.refresh_token || keepRefresh || '', exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
      if (!next.refresh) return false;
      writeJson(LS_TOKEN, next);
      this.stored.set(next);
      return true;
    } catch {
      return false; // offline: Anmeldung bleibt erhalten
    }
  }
}
