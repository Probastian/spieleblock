import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { hitster } from '@spieleblock/games';

export type CardSize = 'l' | 's';
export type CardState = '' | 'new' | 'miss';

/** Eine Song-Karte wie im echten Hitster: quadratisch, das Albumcover als Hintergrund, Jahr groß, darunter Titel und Interpret. */
@Component({
  selector: 'sb-ht-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  host: {
    class: 'htc',
    '[class.s]': "size() === 's'",
    '[class.new]': "state() === 'new'",
    '[class.miss]': "state() === 'miss'",
    '[style.background-image]': 'image()',
    '[style.--hue]': 'hue()',
  },
  template: `
    <span class="htc-y">{{ card().year }}</span>
    @if (size() === 'l') {
      <span class="htc-t"><b>{{ card().title }}</b><span>{{ card().artist }}</span></span>
    }
  `,
})
export class HitsterCardComponent {
  readonly card = input.required<hitster.HitsterCard>();
  readonly size = input<CardSize>('l');
  readonly state = input<CardState>('');

  /** Ohne Cover (oder solange es lädt) bleibt eine Farbe, die zum Song passt. */
  protected readonly hue = computed(() => [...this.card().id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7));
  protected readonly image = computed(() => {
    const url = hitster.coverUrl(this.card());
    return url ? `url("${url}")` : null;
  });
}
