import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { wavelength } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';

/** Auf dem Endbildschirm: alle Runden mit Gegensatz und Hinweisgeber. */
@Component({
  selector: 'sb-wavelength-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (rows().length) {
      <section class="card" aria-label="Runden">
        <h2 class="lbl">Runden</h2>
        <div class="pt-hist">
          @for (r of rows(); track r.n) {
            <div>
              <small>{{ r.n }}</small>
              <span><b>{{ r.pair }}</b><br /><small>Hinweis von {{ r.giver }}</small></span>
              <small>Ziel {{ r.target }} %</small>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class WavelengthEnd {
  private readonly game = inject(PlayContext).typed<wavelength.WavelengthGame>();
  protected readonly rows = computed(() => {
    const g = this.game();
    return g.history.map(h => ({ n: h.n, pair: `${h.left} ↔ ${h.right}`, giver: g.players[h.giver]?.name ?? '?', target: h.target }));
  });
}
