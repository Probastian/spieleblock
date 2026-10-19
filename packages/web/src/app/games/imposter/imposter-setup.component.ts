import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IMPOSTER_CATEGORIES, imposter, wordCategory } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ImposterRulesSheet } from './imposter-rules.sheet';

type Options = imposter.ImposterOptions;
const ROUNDS = [3, 5, 8, 0];

@Component({
  selector: 'sb-imposter-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="iR">
      <h2 class="lbl" id="iR">Regeln</h2>
      <div class="pt-opts">
        <div class="pt-opt">
          <h3>Runden</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of rounds; track v) {
              <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().rounds === v" (click)="set({ rounds: v })">{{ v || 'Offen' }}</button>
            }
          </div>
          <p>Bei „Offen“ spielt ihr, so lange ihr wollt, und wertet selbst aus.</p>
        </div>
        <div class="pt-opt">
          <h3>Imposter</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of [1, 2]; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().imposters === v" (click)="set({ imposters: v })">{{ v }}</button>
            }
          </div>
          @if (options().imposters > 1 && playerCount() > 0 && maxImposters() < options().imposters) {
            <p>Mit {{ playerCount() }} Spielern gibt es höchstens {{ maxImposters() }} Imposter.</p>
          }
        </div>
        <div class="switchrow">
          <span>Imposter kennt die Kategorie<small>Ein kleiner Anhaltspunkt für den Imposter</small></span>
          <button class="switch" type="button" role="switch" aria-label="Imposter kennt die Kategorie" [attr.aria-checked]="options().hint" (click)="set({ hint: !options().hint })"><i></i></button>
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="iK">
      <h2 class="lbl" id="iK">Kategorien</h2>
      <div class="chips" style="margin-top: 0">
        <button type="button" class="chip txt" [attr.aria-pressed]="!options().categories.length" (click)="set({ categories: [] })">Alle</button>
        @for (c of categories; track c.id) {
          <button type="button" class="chip txt" [attr.aria-pressed]="options().categories.includes(c.id)" (click)="toggle(c.id)">{{ c.name }}</button>
        }
      </div>
      <p class="note" style="margin: 0">
        3 bis 8 Spieler. Am besten am Live-Tisch, damit jeder seine Rolle auf dem eigenen Handy sieht.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rulesSheet)">So wird gespielt</button>
      </p>
    </section>
  `,
})
export class ImposterSetup {
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly sheets = inject(SheetService);
  protected readonly rulesSheet = ImposterRulesSheet;
  protected readonly rounds = ROUNDS;
  protected readonly categories = IMPOSTER_CATEGORIES.map(id => wordCategory(id)!);
  protected readonly options = computed(() => this.store.options<Options>('imposter'));
  protected readonly maxImposters = computed(() => Math.max(1, Math.floor((this.playerCount() - 1) / 2)));

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('imposter', patch);
  }

  protected toggle(id: string): void {
    const cur = this.options().categories;
    this.set({ categories: cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id] });
  }
}
