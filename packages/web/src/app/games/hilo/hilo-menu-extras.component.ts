import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { HiloRulesSheet } from './hilo-rules.sheet';

@Component({
  selector: 'sb-hilo-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gespielt</span><span class="mi-s">Ablauf, Leben und Quelle der Zahlen</span></span>
    </button>
  `,
})
export class HiloMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly rules = HiloRulesSheet;
}
