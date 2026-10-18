import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, inject, input } from '@angular/core';
import { SpotifyPlayer } from '../../core/spotify/spotify-player.service';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Die Musiksteuerung der gezogenen Karte: eine drehende Schallplatte, Equalizer, Neustart und Pause/Weiter.
 * Zeigt nichts vom Song selbst, auch kein Cover, denn das würde ihn verraten.
 */
@Component({
  selector: 'sb-ht-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [IconComponent],
  host: { class: 'htp', '[class.playing]': 'player.on() && player.playing()' },
  template: `
    <div class="htp-disc" aria-hidden="true"><i class="htp-label"><svg sb-icon name="music" [size]="14"></svg></i></div>

    @if (player.on()) {
      <div class="htp-info">
        <div class="htp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <span class="htp-dev">{{ player.busy() ? 'Starte …' : player.deviceName() ? 'auf ' + player.deviceName() : 'Gerät wählen im Menü' }}</span>
      </div>
      <div class="htp-ctrls">
        <button class="htp-b" type="button" aria-label="Song von vorn" (click)="player.play(trackId(), true)"><svg sb-icon name="replay" [size]="18"></svg></button>
        <button class="htp-b big" type="button" [attr.aria-label]="player.playing() ? 'Pause' : 'Abspielen'" (click)="player.toggle(trackId())">
          <svg sb-icon [name]="player.playing() ? 'pause' : 'play'" [size]="22"></svg>
        </button>
      </div>
    } @else {
      <span class="htp-info htp-dev">Musik läuft auf einem anderen Gerät.</span>
      <div class="htp-ctrls"><button class="btn sm" type="button" (click)="playHere()">Hier abspielen</button></div>
    }
    @if (player.error(); as e) {
      <p class="ht-err htp-err" role="alert">{{ e }}</p>
    }
  `,
})
export class HitsterPlayerComponent {
  protected readonly player = inject(SpotifyPlayer);
  readonly trackId = input.required<string>();

  constructor() {
    // Solange diese Karte gehört wird, gelegentlich nachsehen, ob der Song noch läuft
    effect(onCleanup => {
      const id = this.trackId();
      if (this.player.on()) onCleanup(this.player.watch(id));
    });
  }

  protected playHere(): void {
    this.player.setOn(true);
    void this.player.refreshDevices();
    void this.player.play(this.trackId(), true);
  }
}
