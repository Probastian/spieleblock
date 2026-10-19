import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { imposter } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';

/** Auf dem Endbildschirm: alle Runden mit Wort und Imposter. */
@Component({
  selector: 'sb-imposter-end',
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
              <span><b>{{ r.word }}</b><br /><small>Imposter: {{ r.who }}</small></span>
              <small>{{ r.outcome }}</small>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class ImposterEnd {
  private readonly game = inject(PlayContext).typed<imposter.ImposterGame>();
  protected readonly rows = computed(() => {
    const g = this.game();
    return g.history.map(h => ({
      n: h.n,
      word: h.word,
      who: h.imposters.map(i => g.players[i]?.name ?? '?').join(', '),
      outcome: h.caught ? (h.guessed ? 'erwischt, Wort erraten' : 'erwischt') : h.accused === null ? 'Gleichstand' : 'durchgerutscht',
    }));
  });
}
