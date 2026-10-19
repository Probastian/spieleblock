import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { ImposterRulesSheet } from './imposter-rules.sheet';

@Component({
  selector: 'sb-imposter-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gespielt</span><span class="mi-s">Ablauf und Punkte</span></span>
    </button>
  `,
})
export class ImposterMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly rules = ImposterRulesSheet;
}
