import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { buildChart, formatNumber, markShape, type ChartConfig, type ChartModel } from './chart-model';

/** Liniendiagramm mit Fadenkreuz, Tooltip (Maus und Finger), Legende und Tabellenansicht. */
@Component({
  selector: 'sb-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'hover.set(null)' },
  template: `
    @let c = config();
    <figure class="lc">
      <div class="lc-h">
        <h3>{{ c.title }}</h3>
        @if (c.table) {
          <button class="link" type="button" (click)="showTable.set(!showTable())" [attr.aria-pressed]="showTable()">{{ showTable() ? 'Diagramm' : 'Tabelle' }}</button>
        }
      </div>

      @if (showTable() && c.table; as t) {
        <div class="tbl-wrap lc-tbl">
          <table class="tbl">
            <thead>
              <tr>
                @for (h of t.head; track $index) {
                  <th scope="col">{{ h }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of t.rows; track $index) {
                <tr>
                  @for (v of row; track $index) {
                    @if ($first) {
                      <th scope="row">{{ v }}</th>
                    } @else {
                      <td>{{ v }}</td>
                    }
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (model(); as m) {
        <div class="lc-plot" #plot>
          <svg [attr.viewBox]="'0 0 ' + m.W + ' ' + m.H" role="img" [attr.aria-label]="c.aria || c.title || 'Liniendiagramm'">
            @for (t of m.yTicks; track t.y) {
              <line class="lc-grid" [class.z]="t.zero" [attr.x1]="m.left" [attr.x2]="m.right" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="lc-t" [attr.x]="m.left - 7" [attr.y]="t.y + 4.2" text-anchor="end">{{ t.label }}</text>
            }
            @for (t of m.xTicks; track t.x) {
              <line class="lc-tick" [attr.x1]="t.x" [attr.x2]="t.x" [attr.y1]="m.bottom" [attr.y2]="m.bottom + 5" />
              <text class="lc-t" [attr.x]="t.x" [attr.y]="m.bottom + 19" text-anchor="middle">{{ t.label }}</text>
            }
            <line class="lc-axis" [attr.x1]="m.left" [attr.x2]="m.right" [attr.y1]="m.bottom" [attr.y2]="m.bottom" />
            @if (c.xTitle) {
              <text class="lc-t" [attr.x]="m.right" [attr.y]="m.H - 5" text-anchor="end">{{ c.xTitle }}</text>
            }
            @if (hoverState(); as h) {
              <line class="lc-cross on" [attr.x1]="h.cx" [attr.x2]="h.cx" [attr.y1]="m.top" [attr.y2]="m.bottom" />
            }
            @for (l of m.lines; track $index) {
              <path class="lc-line" [style.stroke]="l.color" [attr.d]="l.d" />
            }
            @for (mk of m.marks; track $index) {
              @switch (mk.shape.kind) {
                @case ('circle') {
                  <circle class="lc-mk" [style.fill]="mk.color" [attr.cx]="$any(mk.shape).cx" [attr.cy]="$any(mk.shape).cy" [attr.r]="$any(mk.shape).r" />
                }
                @default {
                  <polygon class="lc-mk" [style.fill]="mk.color" [attr.points]="$any(mk.shape).points" />
                }
              }
            }
            @for (l of m.labels; track $index) {
              <text class="lc-lab" [attr.x]="l.x" [attr.y]="l.y">{{ l.text }}</text>
            }
            @if (hoverState(); as h) {
              <g>
                @for (r of h.rows; track r.series.name) {
                  @if (r.mark.kind === 'circle') {
                    <circle class="lc-mk" [style.fill]="r.series.color" [attr.cx]="r.mark.cx" [attr.cy]="r.mark.cy" [attr.r]="r.mark.r" />
                  } @else {
                    <polygon class="lc-mk" [style.fill]="r.series.color" [attr.points]="r.mark.points" />
                  }
                }
              </g>
            }
            <rect class="lc-hit" x="0" y="0" [attr.width]="m.W" [attr.height]="m.H" (pointermove)="pointer($event)" (pointerdown)="pointer($event)" (pointerleave)="leave($event)" />
          </svg>
          @if (hoverState(); as h) {
            <div class="lc-tip on" #tip role="status" [style.left.px]="tipLeft()">
              <b class="h">{{ c.head ? c.head(h.x) : h.x }}</b>
              @for (r of h.rows; track r.series.name) {
                <div class="r">
                  <i [style.background]="r.series.color"></i><span>{{ r.series.name }}</span><b>{{ fmt(r.value) }}</b>
                </div>
              }
            </div>
          }
        </div>
        @if (c.series.length > 1 || c.legend) {
          <ul class="lc-leg" aria-label="Legende">
            @for (s of c.series; track s.name) {
              <li>
                <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                  @let shape = legendMark(s.mk);
                  @if (shape.kind === 'circle') {
                    <circle [style.fill]="s.color" [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r" />
                  } @else {
                    <polygon [style.fill]="s.color" [attr.points]="shape.points" />
                  }
                </svg>
                <span>{{ s.name }}</span>
              </li>
            }
          </ul>
        }
      }
      @if (c.note) {
        <p class="note" style="margin:0">{{ c.note }}</p>
      }
    </figure>
  `,
})
export class LineChartComponent {
  private readonly injector = inject(Injector);
  readonly config = input.required<ChartConfig>();

  protected readonly showTable = signal(false);
  protected readonly hover = signal<number | null>(null);
  protected readonly tipLeft = signal(0);
  private readonly plot = viewChild<ElementRef<HTMLElement>>('plot');
  private readonly tip = viewChild<ElementRef<HTMLElement>>('tip');

  protected readonly model = computed<ChartModel | null>(() => buildChart(this.config()));

  protected readonly hoverState = computed(() => {
    const m = this.model();
    const x = this.hover();
    if (!m || x === null) return null;
    const cx = m.xAt(x);
    return { x, cx, rows: m.rowsAt(x).map(r => ({ ...r, mark: markShape(r.series.mk, +cx.toFixed(1), +m.yAt(r.value).toFixed(1), 6) })) };
  });

  protected readonly fmt = formatNumber;
  protected legendMark = (k: number) => markShape(k, 0, 0, 4.5);

  protected pointer(e: PointerEvent): void {
    const m = this.model();
    if (!m) return;
    const rect = (e.target as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * m.W;
    let best = m.xs[0]!;
    let bestDistance = Infinity;
    for (const x of m.xs) {
      const d = Math.abs(m.xAt(x) - vx);
      if (d < bestDistance) {
        bestDistance = d;
        best = x;
      }
    }
    this.hover.set(best);
    // Tooltip links oder rechts vom Fadenkreuz, je nachdem, wo Platz ist
    afterNextRender(
      () => {
        const plot = this.plot()?.nativeElement;
        const tip = this.tip()?.nativeElement;
        if (!plot || !tip) return;
        const px = (m.xAt(best) / m.W) * plot.clientWidth;
        let left = px + 14;
        if (left + tip.offsetWidth > plot.clientWidth) left = px - 14 - tip.offsetWidth;
        this.tipLeft.set(Math.max(0, left));
      },
      { injector: this.injector },
    );
  }

  protected leave(e: PointerEvent): void {
    if (e.pointerType === 'mouse') this.hover.set(null);
  }
}
