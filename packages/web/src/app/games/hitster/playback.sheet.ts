import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { HitsterPlayback } from './hitster-playback.component';

@Component({
  selector: 'sb-hitster-playback-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, HitsterPlayback],
  template: `
    <sb-sheet-head eyebrow="Hitster" title="Wiedergabe" />
    <sb-hitster-playback />
  `,
})
export class PlaybackSheet {}
