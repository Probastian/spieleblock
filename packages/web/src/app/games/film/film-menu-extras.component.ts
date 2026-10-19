import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { FilmRulesSheet } from './film-rules.sheet';

@Component({
  selector: 'sb-film-menu-extras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <button class="mi" type="button" (click)="sheets.open(rules)">
      <span><span class="mi-t">So wird gespielt</span><span class="mi-s">Ablauf, Token und Jahre</span></span>
    </button>
  `,
})
export class FilmMenuExtras {
  protected readonly sheets = inject(SheetService);
  protected readonly rules = FilmRulesSheet;
}
