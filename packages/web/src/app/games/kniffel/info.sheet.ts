import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SHEET_DATA } from '../../core/ui/sheet.service';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { RuleBoxComponent } from './rule-box.component';

export interface InfoSheetData {
  fieldId: string;
  variant: kniffel.VariantKey;
  extra: boolean;
}

@Component({
  selector: 'sb-kniffel-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, RuleBoxComponent],
  template: `
    <sb-sheet-head eyebrow="So wird gezählt" [title]="field.name" />
    <sb-rule-box [field]="field" [variant]="data.variant" [extra]="data.extra" />
  `,
})
export class KniffelInfoSheet {
  protected readonly data = inject(SHEET_DATA) as InfoSheetData;
  protected readonly field = kniffel.FIELDS_BY_ID[this.data.fieldId]!;
}
