import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { engineOf, signed, wizard, withMinus } from '@spieleblock/games';
import { shortName } from '../../core/util/format';
import { SheetService } from '../../core/ui/sheet.service';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { ChartCardComponent } from '../../shared/ui/chart-card.component';
import { roundsChartConfig } from '../../shared/ui/chart-model';
import { WizardRoundSheet, type RoundSheetData } from './wizard-round.sheet';

/** Das Blatt für Wizard: Zwischenstand, aktuelle Runde, Verlauf, Rundentabelle. */
@Component({
  selector: 'sb-wizard-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './wizard.css',
  imports: [GameTopbarComponent, AvatarComponent, ChartCardComponent],
  template: `
    @let g = game();
    @let s = state();
    <sb-game-topbar title="Wizard" [subtitle]="done() + ' von ' + total() + ' Runden · ' + g.players.length + ' Spieler'" />
    <main class="wrap main" [class.has-dock2]="!finished()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (s.phase === 'done') {
        <div class="notice"><span>Alle {{ total() }} Runden gespielt.</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      } @else {
        <section class="wz-now" aria-live="polite">
          <div class="wz-k"><b>Runde {{ s.k }}</b><span>von {{ total() }} · {{ s.k }} {{ s.k === 1 ? 'Karte' : 'Karten' }} pro Spieler</span></div>
          <p class="wz-deal">Geber <b>{{ dealer().name }}</b> · Ansage beginnt bei <b>{{ starter().name }}</b></p>
          @if (s.phase === 'trick') {
            <div class="wz-bids" aria-label="Ansagen">
              @for (p of g.players; track $index; let i = $index) {
                <span class="wz-bid" [style.--pc]="'var(--p' + p.color + ')'"><span class="dot"></span>{{ short(p.name) }} <b>{{ current()!.b[i] }}</b></span>
              }
            </div>
            <p class="wz-deal">Ansagen zusammen: <b>{{ bidTotal() }}</b> bei {{ s.k }} {{ s.k === 1 ? 'Stich' : 'Stichen' }}</p>
          }
          <span class="bar"><i [style.width.%]="progress()"></i></span>
        </section>
      }

      <ol class="stands" aria-label="Zwischenstand">
        @for (r of standings(); track r.name + $index) {
          <li class="stand" [class.lead]="r.place === 1 && done() > 0 && g.players.length > 1" [style.--pc]="'var(--p' + r.color + ')'">
            <span class="rk">{{ r.place }}</span>
            <span [sbAvatar]="r"></span>
            <span class="stand-n"><b>{{ r.name }}</b><small>{{ r.delta === null ? 'Noch keine Runde' : 'Letzte Runde ' + sign(r.delta) }}</small></span>
            <span class="stand-t mono">{{ minus(r.total) }}</span>
          </li>
        }
      </ol>

      <sb-chart-card [config]="chart()" empty="Nach der ersten abgeschlossenen Runde zeichnet der Block hier den Punkteverlauf aller Spieler." />

      @if (g.rounds.length) {
        <div class="tbl-wrap">
          <table class="tbl wt">
            <thead>
              <tr>
                <th scope="col">Rd.</th>
                @for (p of g.players; track $index) {
                  <th scope="col" [attr.aria-label]="p.name"><span [sbAvatar]="p" small></span></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of g.rounds; track $index; let k = $index) {
                <tr>
                  <th scope="row">{{ k + 1 }}</th>
                  @for (p of g.players; track $index; let i = $index) {
                    <td>
                      @if (!r.t) {
                        <button class="wc open" type="button" (click)="open('edit', k)" [attr.aria-label]="'Runde ' + (k + 1) + ', ' + p.name + ': Ansage ' + r.b[i] + ', Stiche offen'"><b>…</b><small>sagt {{ r.b[i] }}</small></button>
                      } @else {
                        @let pts = score(r.b[i]!, r.t[i]!);
                        <button class="wc" [class.ok]="r.b[i] === r.t[i]" [class.no]="r.b[i] !== r.t[i]" type="button" (click)="open('edit', k)"
                          [attr.aria-label]="'Runde ' + (k + 1) + ', ' + p.name + ': Ansage ' + r.b[i] + ', Stiche ' + r.t[i] + ', ' + pts + ' Punkte'"><b>{{ pts > 0 ? '+' : '' }}{{ minus(pts) }}</b><small>{{ r.b[i] }}/{{ r.t[i] }}</small></button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="sum tot">
                <th scope="row">Σ</th>
                @for (series of cum(); track $index) {
                  <td>{{ minus(series[done()]!) }}</td>
                }
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="note" style="margin: 0">Unter den Punkten steht Ansage/Stiche. Runde antippen, um sie zu ändern.</p>
      } @else {
        <div class="blank"><b>Noch keine Runde</b>Erst sagt jeder seine Stiche an, nach der Runde trägst du ein, wie viele es wirklich waren.</div>
      }
    </main>

    @if (!finished()) {
      <div class="dock" role="region" aria-label="Runde eintragen">
        <div class="wrap">
          @if (s.phase === 'done') {
            <button class="btn primary big" type="button" (click)="ctx.finish()">Spiel auswerten</button>
          } @else {
            <button class="btn primary big" type="button" (click)="openCurrent()">{{ s.phase === 'bid' ? 'Ansagen für Runde ' + s.k : 'Stiche für Runde ' + s.k }}</button>
          }
        </div>
      </div>
    }
  `,
})
export class WizardBoard {
  protected readonly ctx = inject(PlayContext);
  private readonly sheets = inject(SheetService);

  protected readonly game = this.ctx.typed<wizard.WizardGame>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly total = computed(() => wizard.totalRounds(this.game()));
  protected readonly done = computed(() => wizard.roundsDone(this.game()));
  protected readonly state = computed(() => wizard.state(this.game()));
  protected readonly cum = computed(() => wizard.cumulative(this.game()));
  protected readonly progress = computed(() => Math.round((this.done() / this.total()) * 100));
  protected readonly current = computed(() => this.game().rounds[this.state().k - 1]);
  protected readonly dealer = computed(() => this.game().players[(this.state().k - 1) % this.game().players.length]!);
  protected readonly starter = computed(() => this.game().players[this.state().k % this.game().players.length]!);
  protected readonly bidTotal = computed(() => (this.current()?.b ?? []).reduce((a, b) => a + b, 0));

  protected readonly standings = computed(() => {
    const cum = this.cum();
    const done = this.done();
    return engineOf('wizard')!.result(this.game()).map(r => ({ ...r, delta: done ? cum[r.i!]![done]! - cum[r.i!]![done - 1]! : null }));
  });

  protected readonly chart = computed(() => {
    const g = this.game();
    return roundsChartConfig('r-' + g.id, 'Punkteverlauf', g.players, this.cum());
  });

  protected readonly score = wizard.score;
  protected readonly sign = signed;
  protected readonly minus = withMinus;
  protected readonly short = shortName;

  protected open(mode: RoundSheetData['mode'], index = 0): void {
    this.sheets.open(WizardRoundSheet, { data: { mode, index } satisfies RoundSheetData });
  }

  protected openCurrent(): void {
    const s = this.state();
    if (s.phase === 'bid') this.open('bid');
    else if (s.phase === 'trick') this.open('trick', s.k - 1);
  }
}
