import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChartConfig } from './chart-model';
import { LineChartComponent } from './line-chart.component';

/** Diagramm in einer Karte; ohne Daten ein Platzhalter mit Erklärung. */
@Component({
  selector: 'sb-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChartComponent],
  template: `
    @if (config(); as c) {
      <section class="card lcard"><sb-line-chart [config]="c" /></section>
    } @else {
      <div class="blank"><b>Noch kein Verlauf</b>{{ empty() }}</div>
    }
  `,
})
export class ChartCardComponent {
  readonly config = input<ChartConfig | null>(null);
  readonly empty = input('');
}
