import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/ui/toast.service';

@Component({
  selector: 'sb-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="toast" role="status" aria-live="polite" [class.show]="toast.visible()">
      <span>{{ toast.message().text }}</span>
      @if (toast.message().undo) {
        <button type="button" (click)="toast.runUndo()">Rückgängig</button>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
}
