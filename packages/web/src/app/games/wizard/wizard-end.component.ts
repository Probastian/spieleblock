import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { wizard } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';
import { ChartCardComponent } from '../../shared/ui/chart-card.component';
import { roundsChartConfig } from '../../shared/ui/chart-model';

@Component({
  selector: 'sb-wizard-end',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartCardComponent],
  host: { style: 'display: contents' },
  template: `<sb-chart-card [config]="chart()" />`,
})
export class WizardEnd {
  private readonly game = inject(PlayContext).typed<wizard.WizardGame>();
  protected readonly chart = computed(() => {
    const g = this.game();
    return roundsChartConfig('e-' + g.id, 'Punkteverlauf', g.players, wizard.cumulative(g));
  });
}
