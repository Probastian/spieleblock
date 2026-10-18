import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, untracked } from '@angular/core';
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Ändert sich nur, wenn sich die Karten wirklich ändern, nicht bei jedem Zwischenstand des Spiels (sonst würde eine von Hand verschobene Ansicht ständig zurückspringen). */
  private readonly key = computed(() => this.cards().map(c => c.id).join(',') + '|' + this.mark());

  constructor() {
    // Ist die Reihe länger als der Platz, steht die Ansicht in der Mitte (oder auf der neuen Karte), nicht ganz links
    effect(() => {
      this.key();
      untracked(() => setTimeout(() => this.center(), 0));
    });
  }

  private center(): void {
    const el = this.host.nativeElement;
    if (el.scrollWidth <= el.clientWidth) return;
    const fresh = el.querySelector<HTMLElement>('.htc.new');
    if (fresh) {
      const e = el.getBoundingClientRect();
      const c = fresh.getBoundingClientRect();
      el.scrollLeft += c.left - e.left - el.clientWidth / 2 + c.width / 2;
    } else el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }
}
