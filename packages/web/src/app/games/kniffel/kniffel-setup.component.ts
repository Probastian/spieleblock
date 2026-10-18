import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { KniffelRulesSheet } from './rules.sheet';

type Options = kniffel.KniffelOptions;

@Component({
  selector: 'sb-kniffel-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="hV">
      <h2 class="lbl" id="hV">Variante</h2>
      <div class="variants">
        <button class="vopt" type="button" [attr.aria-pressed]="classic()" (click)="set({ variant: 'classic' })"><span class="vname">Klassisch</span><span class="vdesc">13 Felder · Bonus ab 63</span></button>
        <button class="vopt" type="button" [attr.aria-pressed]="!classic()" (click)="set({ variant: 'extreme' })"><span class="vname">Extreme</span><span class="vdesc">17 Felder · Superbonus · Extra-Kniffel +100</span></button>
      </div>

      @if (classic()) {
        <div class="switchrow">
          <span><b>Extra-Kniffel +50</b><small>Hausregel: jeder weitere Kniffel gibt Punkte</small></span>
          <button class="switch" type="button" role="switch" [attr.aria-checked]="options().extraKniffel" aria-label="Extra-Kniffel +50" (click)="set({ extraKniffel: !options().extraKniffel })"><i></i></button>
        </div>
      } @else {
        <div class="newlist" aria-label="Neue Felder">
          @for (name of newFields; track name) { <span>{{ name }}</span> }
          <span>Superbonus ab 80</span>
        </div>
      }

      <div class="switchrow">
        <span><b>Erste Hand +5</b><small>Hausregel: Feld mit Punkten direkt aus dem ersten Wurf gefüllt gibt 5 Extrapunkte</small></span>
        <button class="switch" type="button" role="switch" [attr.aria-checked]="options().firstHand" aria-label="Erste Hand plus 5" (click)="set({ firstHand: !options().firstHand })"><i></i></button>
      </div>
      <button class="link" type="button" style="justify-self: start" (click)="rules()">So zählt jedes Feld</button>
    </section>
  `,
})
export class KniffelSetup {
  /** Von der Einrichtungsseite mitgegeben; Kniffel braucht sie nicht. */
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  private readonly sheets = inject(SheetService);

  protected readonly options = computed(() => this.store.options<Options>('kniffel'));
  protected readonly classic = computed(() => this.options().variant === 'classic');
  protected readonly newFields = kniffel.VARIANTS.extreme.lower.filter(f => f.isNew).map(f => f.name);

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('kniffel', patch);
  }

  protected rules(): void {
    const o = this.options();
    this.sheets.open(KniffelRulesSheet, { tall: true, data: { variant: o.variant, extra: o.extraKniffel, firstHand: o.firstHand } });
  }
}
