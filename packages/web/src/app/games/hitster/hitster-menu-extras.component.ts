import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { HitsterRulesSheet } from './hitster-rules.sheet';
import { PlaybackSheet } from './playback.sheet';

/** Zusätzliche Einträge im Spielmenü. */
@Component({
  selector: 'sb-hitster-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(playback)">
      <span><span class="mi-t">Wiedergabe</span><span class="mi-s">Spotify-Gerät wählen, auf diesem Gerät abspielen</span></span>
    </button>
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gespielt</span><span class="mi-s">Ablauf, Token und Jahre</span></span>
    </button>
  `,
})
export class HitsterMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly playback = PlaybackSheet;
  protected readonly rules = HitsterRulesSheet;
}
