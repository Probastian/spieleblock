import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { WhoamiRulesSheet } from './whoami-rules.sheet';

@Component({
  selector: 'sb-whoami-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gespielt</span><span class="mi-s">Am Tisch und als Stirnraten</span></span>
    </button>
  `,
})
export class WhoamiMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly rules = WhoamiRulesSheet;
}
