import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import type { hitster } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { HitsterMiniLine } from './hitster-mini-line.component';

/** Auf dem Endbildschirm: die Zeitstrahlen aller Spieler. */
@Component({
  selector: 'sb-hitster-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [AvatarComponent, HitsterMiniLine],
  host: { style: 'display: contents' },
  template: `
    <section class="card ht-others" aria-label="Zeitstrahlen">
      <h2 class="lbl">Zeitstrahlen</h2>
      @for (p of game().players; track $index) {
        <div class="ht-other" [style.--pc]="'var(--p' + p.color + ')'">
          <div class="ht-who"><span [sbAvatar]="p" small></span>{{ p.name }} · {{ p.line.length }} Karten</div>
          <sb-ht-mini-line [cards]="p.line" />
        </div>
      }
    </section>
  `,
})
export class HitsterEnd {
  private readonly ctx = inject(PlayContext);
  protected readonly game = computed(() => this.ctx.game() as hitster.HitsterGame);
}
