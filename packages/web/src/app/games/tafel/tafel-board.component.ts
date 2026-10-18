import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { tafel, engineOf, pluralize, signed } from '@spieleblock/games';
import { SheetService } from '../../core/ui/sheet.service';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { ChartCardComponent } from '../../shared/ui/chart-card.component';
import { roundsChartConfig } from '../../shared/ui/chart-model';
import { RoundSheet } from './round.sheet';

/** Das Blatt der Punktetafel: Zwischenstand, Verlauf, Rundentabelle. */
@Component({
  selector: 'sb-tafel-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameTopbarComponent, AvatarComponent, ChartCardComponent],
  template: `
    @let g = game();
    <sb-game-topbar title="Punktetafel" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!finished()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      }
      @if (reached(); as names) {
        <div class="notice"><span>Ziel {{ g.target }} erreicht: <b>{{ names.join(', ') }}</b></span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      }

      <ol class="stands" aria-label="Zwischenstand">
        @for (r of standings(); track r.name + $index) {
          <li class="stand" [class.lead]="r.place === 1 && rounds() && g.players.length > 1" [style.--pc]="'var(--p' + r.color + ')'">
            <span class="rk">{{ r.place }}</span>
            <span [sbAvatar]="r"></span>
            <span class="stand-n">
              <b>{{ r.name }}</b>
              <small>{{ r.last == null ? 'Noch keine Runde' : 'Letzte Runde ' + sign(r.last) }}</small>
              @if (g.target) {
                <span class="bar"><i [style.width.%]="percent(r.total)"></i></span>
              }
            </span>
            <span class="stand-t mono">{{ r.total }}</span>
          </li>
        }
      </ol>

      @if (rounds() > 1) {
        <sb-chart-card [config]="chart()" />
      }

      @if (rounds()) {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th scope="col">Runde</th>
                @for (p of g.players; track $index) {
                  <th scope="col" [style.--pc]="'var(--p' + p.color + ')'"><span class="dot"></span>{{ p.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (round of g.rounds; track $index; let k = $index) {
                <tr>
                  <th scope="row">{{ k + 1 }}</th>
                  @for (p of g.players; track $index; let i = $index) {
                    <td>
                      <button class="tc" type="button" [class.o]="!round[i]" (click)="edit(k)" [attr.aria-label]="'Runde ' + (k + 1) + ', ' + p.name + ': ' + (round[i] || 0)">{{ round[i] || 0 }}</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="sum tot">
                <th scope="row">Summe</th>
                @for (t of totals(); track $index) {
                  <td>{{ t }}</td>
                }
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="note" style="margin: 0">Wert antippen, um die Runde zu ändern.</p>
      } @else {
        <div class="blank"><b>Noch keine Runde</b>Tippe unten auf „Runde eintragen“ und gib für jeden Spieler die Punkte ein.</div>
      }
    </main>

    @if (!finished()) {
      <div class="dock" role="region" aria-label="Runde eintragen">
        <div class="wrap"><button class="btn primary big" type="button" (click)="edit(-1)">Runde {{ rounds() + 1 }} eintragen</button></div>
      </div>
    }
  `,
})
export class TafelBoard {
  protected readonly ctx = inject(PlayContext);
  private readonly sheets = inject(SheetService);

  protected readonly game = this.ctx.typed<tafel.TafelGame>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly rounds = computed(() => this.game().rounds.length);
  protected readonly totals = computed(() => tafel.totals(this.game()));
  protected readonly standings = computed(() => engineOf('tafel')!.result(this.game()));
  protected readonly reached = computed(() => (this.finished() ? null : tafel.reached(this.game())));
  protected readonly sign = signed;

  protected readonly subtitle = computed(() => {
    const g = this.game();
    return `${pluralize(g.rounds.length, 'Runde', 'Runden')} · ${g.mode === 'low' ? 'Niedrigste gewinnt' : 'Höchste gewinnt'}${g.target ? ` · Ziel ${g.target}` : ''}`;
  });

  protected readonly chart = computed(() => {
    const g = this.game();
    return roundsChartConfig('r-' + g.id, 'Punkteverlauf', g.players, tafel.cumulative(g));
  });

  protected percent(total: number): number {
    const target = this.game().target;
    return target ? Math.max(0, Math.min(100, (total / target) * 100)) : 0;
  }

  protected edit(index: number): void {
    this.sheets.open(RoundSheet, { data: index });
  }
}
