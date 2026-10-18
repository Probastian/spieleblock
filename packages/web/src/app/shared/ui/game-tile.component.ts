import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { GameUi } from '../../games/game-ui';
import { DieComponent } from './die.component';
import { IconComponent } from './icon.component';

/** Die farbige Kachel mit dem Symbol eines Spiels. */
@Component({
  selector: 'span[sbGameTile]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DieComponent, IconComponent],
  host: { class: 'gtile', '[style.--tile]': 'ui().tile' },
  template: `
    @if (ui().icon === 'die5') {
      <svg sb-die [n]="5"></svg>
    } @else {
      <svg sb-icon [name]="$any(ui().icon)"></svg>
    }
  `,
})
export class GameTileComponent {
  readonly ui = input.required<GameUi>({ alias: 'sbGameTile' });
}
