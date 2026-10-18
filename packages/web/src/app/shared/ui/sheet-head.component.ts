import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SheetService } from '../../core/ui/sheet.service';
import { IconComponent } from './icon.component';

/** Kopf eines Sheets: kleine Überschrift, große Überschrift, Schließen-Knopf. Eigene Überschrift per `<ng-content select="[eyebrow]">`. */
@Component({
  selector: 'sb-sheet-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="sh-head">
      <div>
        <div class="eyebrow"><ng-content select="[eyebrow]" />{{ eyebrow() }}</div>
        <h2>{{ title() }}</h2>
      </div>
      <button class="iconbtn" type="button" (click)="sheets.close()" aria-label="Schließen"><svg sb-icon name="close"></svg></button>
    </div>
  `,
})
export class SheetHeadComponent {
  protected readonly sheets = inject(SheetService);
  readonly eyebrow = input('');
  readonly title = input.required<string>();
}
