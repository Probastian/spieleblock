import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SheetService } from '../../core/ui/sheet.service';
import { PlayContext } from '../../features/play/play-context';
import { KniffelActions } from './kniffel-actions';
import { KniffelOverviewSheet } from './overview.sheet';
import { KniffelRulesSheet, type RulesSheetData } from './rules.sheet';

/** Zusätzliche Einträge im Spielmenü: Übersicht, Regeln, Eingabeart. */
@Component({
  selector: 'sb-kniffel-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(overview, { tall: true })"><span><span class="mi-t">Übersichtstabelle</span><span class="mi-s">Alle Spieler nebeneinander</span></span></button>
    <button class="mi" type="button" (click)="rules()"><span><span class="mi-t">Regeln & Felder</span><span class="mi-s">So zählt jedes Feld</span></span></button>
    <div class="mi">
      <span><span class="mi-t">Eingabe</span><span class="mi-s">Gilt für alle Spieler</span></span>
      <span class="mi-seg">
        <button type="button" [attr.aria-pressed]="game().input === 'dice'" (click)="actions.setInput('dice')">Würfel</button>
        <button type="button" [attr.aria-pressed]="game().input === 'number'" (click)="actions.setInput('number')">Summe</button>
      </span>
    </div>
  `,
})
export class KniffelMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly actions = inject(KniffelActions);
  protected readonly overview = KniffelOverviewSheet;
  protected readonly game = inject(PlayContext).typed<kniffel.KniffelGame>();
  protected readonly info = computed<RulesSheetData>(() => ({ variant: this.game().variant, extra: this.game().extra, firstHand: this.game().firstRule }));

  protected rules(): void {
    this.sheets.open(KniffelRulesSheet, { tall: true, data: this.info() });
  }
}
