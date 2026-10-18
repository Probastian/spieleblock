import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { buildTrend, engineOf, gameTime, trendGroups } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { formatDateTime } from '../../core/util/format';
import { LineChartComponent } from '../../shared/ui/line-chart.component';
import type { ChartConfig } from '../../shared/ui/chart-model';
import { formatNumber } from '../../shared/ui/chart-model';

const PAGE = 25;

@Component({
  selector: 'sb-history-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [RouterLink, LineChartComponent],
  template: `
    @if (!finished().length) {
      <div class="blank"><b>Noch nichts gespielt</b>Beendete Spiele erscheinen hier mit Rangliste. Rekorde und Siege pro Spieler wertet der Block automatisch aus.</div>
    } @else {
      @if (chart(); as c) {
        <section class="sec">
          <h2 class="lbl">Entwicklung</h2>
          @if (groups().length > 1) {
            <div class="chips" style="margin-top: 0">
              @for (g of groups(); track g.key) {
                <button type="button" class="chip txt" [attr.aria-pressed]="g.key === current().key" (click)="trendKey.set(g.key)">{{ g.label }}</button>
              }
            </div>
          }
          <div class="card lcard"><sb-line-chart [config]="c" /></div>
        </section>
      }

      @if (store.records().length) {
        <section class="sec">
          <h2 class="lbl">Rekorde</h2>
          <div class="recs">
            @for (r of store.records(); track r.key) {
              <div class="rec"><span class="lbl">{{ r.label }}</span><b class="mono">{{ r.total }}</b><span>{{ r.name }} · {{ date(r.date).slice(0, 5) }}</span></div>
            }
          </div>
        </section>
      }

      <section class="sec">
        <h2 class="lbl">Gespielt <span class="count">{{ finished().length }}</span></h2>
        <ul class="hist2">
          @for (h of shown(); track h.id) {
            <li>
              <a class="hitem" [routerLink]="['/spiel', h.id]">
                <span class="hd">{{ h.date }} · {{ h.label }}{{ h.legacy ? ' · übernommen' : '' }}</span>
                <span class="hw">
                  @for (r of h.rows; track $index) {
                    @if (r.place === 1 && h.multi) { <b>{{ r.name }} {{ r.total }}</b> } @else { {{ r.name }} {{ r.total }} }
                    @if (!$last) { · }
                  }
                </span>
              </a>
            </li>
          }
        </ul>
        @if (finished().length > limit()) {
          <button class="btn" type="button" (click)="limit.set(limit() + PAGE)">Mehr anzeigen</button>
        }
      </section>
    }
  `,
})
export class HistoryTab {
  protected readonly store = inject(Store);
  protected readonly PAGE = PAGE;
  protected readonly limit = signal(PAGE);
  protected readonly trendKey = signal<string | null>(null);
  protected readonly date = formatDateTime;

  protected readonly finished = this.store.finishedGames;
  protected readonly shown = computed(() =>
    this.finished().slice(0, this.limit()).map(g => {
      const engine = engineOf(g.type)!;
      const rows = engine.result(g);
      return { id: g.id, label: engine.label(g), date: formatDateTime(gameTime(g)), legacy: !!g.legacy, rows, multi: rows.length > 1 };
    }),
  );

  protected readonly groups = computed(() => trendGroups([...this.finished()].reverse(), engineOf));
  protected readonly current = computed(() => this.groups().find(g => g.key === this.trendKey()) ?? this.groups()[0]);

  protected readonly chart = computed<ChartConfig | null>(() => {
    const group = this.current();
    if (!group) return null;
    const { series, offset, shown } = buildTrend(group, engineOf);
    if (!series.length) return null;
    const numbers = shown.map((_, i) => offset + i + 1);
    const when = (n: number) => formatDateTime(gameTime(group.games[n - 1]!));
    return {
      id: 'trend-' + group.key,
      title: 'Punkte pro Partie',
      series: series.map(s => ({ name: s.name, color: `var(--c${s.color})`, mk: s.color, pts: s.pts })),
      xTitle: 'Partie',
      h: 236,
      head: x => `Partie ${x} · ${when(x)}`,
      xmin: numbers[0],
      xmax: numbers[numbers.length - 1],
      table: {
        head: ['Partie', 'Datum', ...series.map(s => s.name)],
        rows: numbers.map(n => [String(n), when(n), ...series.map(s => { const p = s.pts.find(q => q[0] === n); return p ? formatNumber(p[1]) : '–'; })]),
      },
      aria: `Liniendiagramm: Punkte pro Partie in ${group.label}, ${shown.length} Partien, ${series.length} Spieler.`,
      note: 'Jeder Punkt ist eine beendete Partie. Die Linie verbindet die Partien eines Spielers.',
    };
  });
}
