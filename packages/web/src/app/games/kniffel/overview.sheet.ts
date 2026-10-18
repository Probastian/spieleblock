import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SheetService } from '../../core/ui/sheet.service';
import { PlayContext } from '../../features/play/play-context';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { KniffelActions } from './kniffel-actions';

/** Alle Spieler nebeneinander; Wert antippen springt zum Blatt dieses Spielers. */
@Component({
  selector: 'sb-kniffel-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, NgTemplateOutlet],
  template: `
    @let g = game();
    <sb-sheet-head [eyebrow]="def().name + ' · Runde ' + round() + ' von ' + count()" title="Übersicht" />
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">Feld</th>
            @for (p of g.players; track $index) {
              <th scope="col" [style.--pc]="'var(--p' + p.color + ')'"><span class="dot"></span>{{ p.name }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (f of def().upper; track f.id) {
            <ng-container *ngTemplateOutlet="fieldRow; context: { f: f }" />
          }
          <tr class="sum"><th scope="row">Summe oben</th>@for (t of totals(); track $index) { <td>{{ t.up }}</td> }</tr>
          @for (b of def().bonus; track b.at) {
            <tr class="sum"><th scope="row">{{ b.label }}</th>@for (t of totals(); track $index) { <td>{{ t.up >= b.at ? b.pts : 0 }}</td> }</tr>
          }
          @for (f of def().lower; track f.id) {
            <ng-container *ngTemplateOutlet="fieldRow; context: { f: f }" />
          }
          @if (extra()) {
            <tr><th scope="row">Extra-Kniffel</th>@for (t of totals(); track $index) { <td>{{ t.kb }}</td> }</tr>
          }
          @if (g.firstRule) {
            <tr><th scope="row">Erste Hand</th>@for (t of totals(); track $index) { <td>{{ t.hand }}</td> }</tr>
          }
          <tr class="sum"><th scope="row">Summe unten</th>@for (t of totals(); track $index) { <td>{{ t.low + t.kb + t.hand }}</td> }</tr>
          <tr class="grand"><th scope="row">Gesamt</th>@for (t of totals(); track $index) { <td [class.lead]="t.total === best() && g.players.length > 1 && best() > 0">{{ t.total }}</td> }</tr>
        </tbody>
      </table>
    </div>
    <p class="note">Wert antippen, um zum Blatt zu springen.</p>

    <ng-template #fieldRow let-f="f">
      <tr>
        <th scope="row">{{ f.name }}</th>
        @for (p of g.players; track $index; let i = $index) {
          <td>
            <button class="tc" type="button" [class.z]="p.scores[f.id] === 0" [class.o]="p.scores[f.id] === undefined" (click)="jump(i, f.id)"
              [attr.aria-label]="p.name + ', ' + f.name + ': ' + (p.scores[f.id] === undefined ? 'offen' : p.scores[f.id])">{{ p.scores[f.id] === undefined ? '·' : p.scores[f.id] }}</button>
          </td>
        }
      </tr>
    </ng-template>
  `,
})
export class KniffelOverviewSheet {
  private readonly ctx = inject(PlayContext);
  private readonly sheets = inject(SheetService);
  private readonly actions = inject(KniffelActions);

  protected readonly game = this.ctx.typed<kniffel.KniffelGame>();
  protected readonly def = computed(() => kniffel.variantOf(this.game()));
  protected readonly count = computed(() => kniffel.allFields(this.game()).length);
  protected readonly round = computed(() => kniffel.currentRound(this.game()));
  protected readonly extra = computed(() => kniffel.extraValue(this.game()) > 0);
  protected readonly totals = computed(() => this.game().players.map(p => kniffel.totals(this.game(), p)));
  protected readonly best = computed(() => Math.max(...this.totals().map(t => t.total)));

  protected jump(playerIndex: number, fieldId: string): void {
    this.sheets.close();
    this.actions.show(playerIndex);
    if (this.game().status === 'finished') this.ctx.review.set(true);
    this.ctx.highlight(fieldId, true);
  }
}
