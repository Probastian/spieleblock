import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject } from '@angular/core';
import { ConfettiService } from '../core/ui/confetti.service';

@Component({
  selector: 'sb-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas id="confetti" aria-hidden="true"></canvas>`,
})
export class ConfettiCanvasComponent {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const confetti = inject(ConfettiService);
    afterNextRender(() => confetti.canvas.set(host.nativeElement.querySelector('canvas')));
  }
}
