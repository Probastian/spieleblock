import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ResultRow } from '@spieleblock/games';
import { AvatarComponent } from '../../shared/ui/avatar.component';

/** Punktestand der Spieler als Liste (aus `engine.result`). `gain` zeigt die Punkte der letzten Runde. */
@Component({
  selector: 'sb-pt-standings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  template: `
    <ol class="stands" aria-label="Punktestand">
      @for (r of rows(); track r.name + $index) {
        <li class="stand" [class.lead]="r.place === 1 && lead()" [style.--pc]="'var(--p' + r.color + ')'">
          <span class="rk">{{ r.place }}</span>
          <span [sbAvatar]="r"></span>
          <span class="stand-n">
            <b>{{ r.name }}@if (me() === r.i) { <em class="me">du</em> }</b>
            @if (r.sub) {
              <small>{{ r.sub }}</small>
            }
          </span>
          <span class="stand-t mono">{{ r.total }}@if (gain()?.[r.i!]; as x) { <small class="pt-gain">+{{ x }}</small> }</span>
        </li>
      }
    </ol>
  `,
})
export class PartyStandings {
  readonly rows = input.required<ResultRow[]>();
  /** Index des eigenen Spielers am Live-Tisch. */
  readonly me = input<number | null>(null);
  readonly gain = input<number[] | null>(null);
  readonly lead = input(true);
}
