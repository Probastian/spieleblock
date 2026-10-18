import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6.5], [17, 6.5], [7, 12], [17, 12], [7, 17.5], [17, 17.5]],
};

/** Ein Spielwürfel als SVG. Verwendung: `<svg sb-die [n]="5"></svg>`; `mini` zeichnet nur die Umrisse. */
@Component({
  selector: 'svg[sb-die]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'die', '[class.mini]': 'mini()', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
  template: `
    <svg:rect class="db" x="1.25" y="1.25" width="21.5" height="21.5" rx="5.5" />
    @for (p of pips(); track $index) {
      <svg:circle class="dp" [class.one]="n() === 1" [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="n() === 1 ? 2.8 : 2.2" />
    }
  `,
})
export class DieComponent {
  readonly n = input.required<number>();
  readonly mini = input(false, { transform: booleanAttribute });
  protected readonly pips = computed(() => PIPS[this.n()] ?? []);
}
