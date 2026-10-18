import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { DieComponent } from '../../shared/ui/die.component';

/** Erklärkasten zu einem Feld: Regel, Beispielwurf, mögliche Werte. */
@Component({
  selector: 'sb-rule-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DieComponent],
  template: `
    <div class="rulebox">
      <p>{{ text() }}</p>
      <div class="example">
        <span class="exdice">@for (d of field().ex; track $index) { <svg sb-die [n]="d"></svg> }</span>
        <span class="exeq">ergibt <b>{{ field().calc(field().ex) }}</b> Punkte</span>
      </div>
      <div class="poss">Mögliche Werte: {{ possible() }}. Streichen ergibt 0.</div>
    </div>
  `,
})
export class RuleBoxComponent {
  readonly field = input.required<kniffel.FieldDef>();
  readonly variant = input.required<kniffel.VariantKey>();
  readonly extra = input(false);
  protected readonly text = computed(() => kniffel.ruleText(this.field(), this.variant(), this.extra()));
  protected readonly possible = computed(() => kniffel.possibleText(this.field()));
}
