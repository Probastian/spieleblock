import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SheetService } from '../core/ui/sheet.service';

/** Zeigt das aktuell geöffnete Sheet über dem Rest der App. */
@Component({
  selector: 'sb-sheet-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet],
  host: { '(document:keydown.escape)': 'sheets.close()' },
  template: `
    <div id="layer">
      @if (sheets.active(); as s) {
        <div class="scrim" (click)="sheets.close()"></div>
        <div class="sheet" [class.tall]="s.tall" role="dialog" aria-modal="true">
          <div class="grab" aria-hidden="true"></div>
          <div class="sheet-inner"><ng-container *ngComponentOutlet="s.component; injector: s.injector" /></div>
        </div>
      }
    </div>
  `,
})
export class SheetHostComponent {
  protected readonly sheets = inject(SheetService);
}
