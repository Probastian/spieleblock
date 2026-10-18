import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';
import { SpotifyPlayer } from '../../core/spotify/spotify-player.service';

/** Spotify-Verbindung und Wiedergabe dieses Geräts: anmelden, „Hier abspielen“, Gerät wählen. */
@Component({
  selector: 'sb-hitster-playback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  template: `
    <div class="ht-opts">
      @if (!auth.available()) {
        <p class="note" style="margin: 0">Dieser Block ist noch nicht mit einer Spotify-App verbunden. Der Betreiber muss <b>SPOTIFY_CLIENT_ID</b> am Server setzen (siehe docs/betrieb.md).</p>
      } @else if (!auth.loggedIn()) {
        <div class="ht-opt">
          <h3>Spotify verbinden</h3>
          <p>Damit liest der Block deine Playlists und kann Songs auf einem Spotify-Gerät starten. Die Anmeldung bleibt auf diesem Gerät.</p>
          <button class="btn primary" type="button" (click)="auth.login(back())">Mit Spotify anmelden</button>
        </div>
      } @else {
        <div class="switchrow">
          <div>
            <b>Auf diesem Gerät abspielen</b>
            <small>{{ player.on() ? 'Jede neue Karte startet auf ' + (player.deviceName() || 'dem gewählten Gerät') : 'Aus: Die Musik kommt von einem anderen Gerät' }}</small>
          </div>
          <button class="switch" type="button" role="switch" [attr.aria-checked]="player.on()" aria-label="Auf diesem Gerät abspielen" (click)="toggle()"><i></i></button>
        </div>

        @if (player.on()) {
          <div class="ht-opt">
            <h3>Spotify-Gerät</h3>
            <p>Handy, Computer oder Box. Die Spotify-App muss dort offen sein. Zum Auswählen kurz etwas anspielen.</p>
            @if (player.devices().length) {
              <ul class="ht-dev">
                @for (d of player.devices(); track d.id) {
                  <li><button type="button" [attr.aria-pressed]="d.name === player.deviceName()" (click)="player.selectDevice(d)">{{ d.name }}<small>{{ d.active ? 'läuft gerade' : d.type }}</small></button></li>
                }
              </ul>
            }
            <div><button class="btn sm" type="button" (click)="player.refreshDevices()">Geräte suchen</button></div>
            @if (player.error(); as e) {
              <p class="ht-err">{{ e }}</p>
            }
          </div>
          <p class="note" style="margin: 0">Tipp: Die Spotify-App zeigt Titel und Interpret des laufenden Songs an. Spielt lieber auf einer Box oder legt das Handy mit dem Display nach unten.</p>
        }
        <div><button class="link" type="button" (click)="auth.logout()">Von Spotify abmelden</button></div>
      }
    </div>
  `,
})
export class HitsterPlayback {
  protected readonly auth = inject(SpotifyAuth);
  protected readonly player = inject(SpotifyPlayer);

  /** Wohin es nach dem Spotify-Login zurückgeht. */
  readonly returnTo = input<string>('');
  protected readonly back = computed(() => this.returnTo() || location.pathname);

  constructor() {
    void this.auth.init();
  }

  protected toggle(): void {
    const on = !this.player.on();
    this.player.setOn(on);
    if (on) void this.player.refreshDevices();
  }
}
