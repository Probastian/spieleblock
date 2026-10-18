import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { hitster } from '@spieleblock/games';
import { HitsterCardComponent } from './hitster-card.component';

/** Der Zeitstrahl eines Spielers in klein: Cover mit Jahr, waagerecht scrollbar. */
@Component({
  selector: 'sb-ht-mini-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [HitsterCardComponent],
  host: { class: 'htm', role: 'list' },
  template: `
    @for (c of cards(); track c.id) {
      <sb-ht-card role="listitem" [card]="c" size="s" [state]="c.id === mark() ? 'new' : ''" [attr.title]="c.title + ' – ' + c.artist" />
    } @empty {
      <span class="htm-empty">noch keine Karte</span>
    }
  `,
})
export class HitsterMiniLine {
  readonly cards = input.required<readonly hitster.HitsterCard[]>();
  /** Karte, die gerade neu dazugekommen ist (grün umrandet). */
  readonly mark = input('');
}
