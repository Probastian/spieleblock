import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';

const MESSAGES = {
  denied: 'Du hast die Verbindung zu Spotify abgebrochen.',
  invalid: 'Die Anmeldung konnte nicht zugeordnet werden. Bitte nochmal von vorn versuchen.',
  failed: 'Spotify hat die Anmeldung nicht bestätigt. Ist die Adresse dieser Seite als Redirect-URI in der Spotify-App eingetragen?',
} as const;

/** Rückkehr vom Spotify-Login: tauscht den Code gegen Tokens und geht dorthin zurück, wo der Nutzer herkam. */
@Component({
  selector: 'sb-spotify-callback-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap setup">
      <div class="blank">
        @if (error(); as e) {
          <b>Spotify hat nicht geklappt</b>{{ e }}
          <p><button class="btn" type="button" (click)="home()">Zurück zum Hauptmenü</button></p>
        } @else {
          <b>Verbinde mit Spotify …</b>Einen Moment.
        }
      </div>
    </main>
  `,
})
export class SpotifyCallbackPage {
  private readonly auth = inject(SpotifyAuth);
  private readonly router = inject(Router);
  protected readonly error = signal('');

  constructor() {
    void this.run();
  }

  private async run(): Promise<void> {
    const result = await this.auth.handleCallback(new URLSearchParams(location.search));
    if (result.ok) void this.router.navigateByUrl(result.back, { replaceUrl: true });
    else this.error.set(MESSAGES[result.reason]);
  }

  protected home(): void {
    void this.router.navigate(['/spiele'], { replaceUrl: true });
  }
}
