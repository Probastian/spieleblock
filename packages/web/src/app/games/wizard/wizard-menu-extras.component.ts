import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { WizardRulesSheet } from './wizard-rules.sheet';

/** Zusätzlicher Eintrag im Spielmenü. */
@Component({
  selector: 'sb-wizard-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gezählt</span><span class="mi-s">Regeln und Punkte im Überblick</span></span>
    </button>
  `,
})
export class WizardMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly rules = WizardRulesSheet;
}
