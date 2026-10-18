import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { tafel } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';
import { ChartCardComponent } from '../../shared/ui/chart-card.component';
import { roundsChartConfig } from '../../shared/ui/chart-model';

/** Punkteverlauf unter dem Ergebnis. */
@Component({
  selector: 'sb-tafel-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCardComponent],
  host: { style: 'display: contents' },
  template: `
    @if (chart(); as c) {
      <sb-chart-card [config]="c" />
    }
  `,
})
export class TafelEnd {
  private readonly game = inject(PlayContext).typed<tafel.TafelGame>();
  protected readonly chart = computed(() => {
    const g = this.game();
    return g.rounds.length > 1 ? roundsChartConfig('e-' + g.id, 'Punkteverlauf', g.players, tafel.cumulative(g)) : null;
  });
}
