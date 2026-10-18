import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatDateTime } from '../../core/util/format';
import { withMinus } from '@spieleblock/games';
import { SheetService } from '../../core/ui/sheet.service';
import { LazyComponent } from '../../shared/ui/lazy.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { scrollToTop } from '../../shared/dom';
import { GameMenuSheet } from './game-menu.sheet';
import { PlayContext } from './play-context';

/** Ergebnis nach dem Spielende: Sieger, Rangliste, Rekord, Revanche. */
@Component({
  selector: 'sb-end-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LazyComponent],
  template: `
    @if (view(); as v) {
      <main class="wrap end">
        <div>
          <button class="link" type="button" style="margin-left: -2px" (click)="ctx.home()"><svg sb-icon name="chevL" [size]="16"></svg> Hauptmenü</button>
          <div class="eyebrow" style="margin-top: 6px">{{ v.label }} · {{ v.date }}</div>
          <h1>{{ v.head }}</h1>
          <p class="lede">{{ v.lede }}</p>
        </div>

        @if (v.record; as r) {
          <div class="record">Neuer Rekord für {{ v.label }}: {{ r.best }} Punkte (bisher {{ r.prev }}).</div>
        }

        <ol class="podium">
          @for (x of v.rows; track $index) {
            <li class="pod" [class.win]="x.place === 1 && !v.solo" [style.--pc]="'var(--p' + x.color + ')'">
              <span class="place">{{ x.place }}.</span>
              <span class="pname">{{ x.name }}</span>
              <span class="ptotal mono">{{ minus(x.total) }}</span>
              <span class="pbreak">{{ x.sub }}</span>
            </li>
          }
        </ol>

        @if (ctx.ui()?.endExtras; as extras) {
          <sb-lazy [loader]="extras" />
        }
        @if (v.note) {
          <p class="note" style="margin: 0">{{ v.note }}</p>
        }

        <div class="end-actions">
          @if (!v.legacy) {
            <button class="btn primary big" type="button" (click)="ctx.rematch()">Revanche{{ v.solo ? '' : ' – nächster beginnt' }}</button>
            <button class="btn big" type="button" (click)="review()">{{ ctx.ui()?.reviewLabel ?? 'Blätter ansehen' }}</button>
          }
          <button class="btn big" type="button" (click)="ctx.home()">Zum Hauptmenü</button>
          <button class="link" type="button" style="justify-self: center" (click)="sheets.open(menuSheet)">Mehr</button>
        </div>
      </main>
    }
  `,
})
export class EndScreenComponent {
  protected readonly ctx = inject(PlayContext);
  protected readonly sheets = inject(SheetService);
  protected readonly menuSheet = GameMenuSheet;
  protected readonly minus = withMinus;

  protected readonly view = computed(() => {
    const g = this.ctx.game();
    const engine = this.ctx.engine();
    if (!g || !engine) return null;
    const rows = engine.result(g);
    const winners = rows.filter(x => x.place === 1);
    const solo = rows.length === 1;
    let head: string;
    let lede: string;
    if (solo) {
      head = `${rows[0]!.total} Punkte`;
      lede = `${rows[0]!.name}, das ist dein Endstand.`;
    } else if (winners.length > 1) {
      head = 'Unentschieden!';
      lede = `${winners.map(x => x.name).join(' und ')} teilen sich Platz 1 mit ${winners[0]!.total} Punkten.`;
    } else {
      const second = rows.find(x => x.place > 1);
      head = `${winners[0]!.name} gewinnt`;
      lede = `${winners[0]!.total} Punkte${second ? `, ${Math.abs(winners[0]!.total - second.total)} ${engine.higherIsBetter ? 'vor' : 'Abstand zu'} ${second.name}` : ''}.`;
    }
    return { rows, solo, head, lede, label: engine.label(g), date: formatDateTime(g.finishedAt || g.u), note: engine.endNote(g), record: g.record, legacy: !!g.legacy };
  });

  protected review(): void {
    this.ctx.review.set(true);
    scrollToTop();
  }
}
