import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { tafel } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { inputValue } from '../../shared/dom';

type Options = tafel.TafelOptions;
const PRESETS = [0, 50, 100, 250, 500, 1000];

@Component({
  selector: 'sb-tafel-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="hW">
      <h2 class="lbl" id="hW">Wertung</h2>
      <div class="variants">
        <button class="vopt" type="button" [attr.aria-pressed]="options().mode !== 'low'" (click)="set({ mode: 'high' })"><span class="vname">Höchste</span><span class="vdesc">Wer am meisten Punkte hat, gewinnt</span></button>
        <button class="vopt" type="button" [attr.aria-pressed]="options().mode === 'low'" (click)="set({ mode: 'low' })"><span class="vname">Niedrigste</span><span class="vdesc">Wer am wenigsten hat, gewinnt</span></button>
      </div>
    </section>

    <section class="card" aria-labelledby="hZ">
      <h2 class="lbl" id="hZ">Zielpunktzahl <span style="text-transform: none; letter-spacing: 0; font-weight: 500">(optional)</span></h2>
      <div class="chips" style="margin-top: 0">
        @for (v of presets; track v) {
          <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().target === v" (click)="set({ target: v })">{{ v || 'Kein Ziel' }}</button>
        }
      </div>
      <input class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="Eigene Zahl" aria-label="Eigene Zielpunktzahl" [value]="custom()" (input)="typed($event)" />
      <p class="note" style="margin: 0">Sobald jemand das Ziel erreicht, schlägt der Block die Auswertung vor. Du kannst trotzdem weiterspielen.</p>
    </section>
  `,
})
export class TafelSetup {
  /** Von der Einrichtungsseite mitgegeben; die Tafel braucht sie nicht. */
  readonly playerCount = input(0);
  private readonly store = inject(Store);

  protected readonly presets = PRESETS;
  protected readonly options = computed(() => this.store.options<Options>('tafel'));
  protected readonly custom = computed(() => {
    const t = this.options().target;
    return t && !PRESETS.includes(t) ? String(t) : '';
  });

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('tafel', patch);
  }

  protected typed(e: Event): void {
    const el = e.target as HTMLInputElement;
    const n = parseInt(inputValue(e).replace(/\D/g, ''), 10) || 0;
    el.value = n ? String(n) : '';
    this.set({ target: n });
  }
}
