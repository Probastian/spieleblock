import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { hilo } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { HiloDataCategory, loadHiloData } from './hilo-data';
import { HiloRulesSheet } from './hilo-rules.sheet';

type Options = hilo.HiloOptions;

@Component({
  selector: 'sb-hilo-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="hK">
      <h2 class="lbl" id="hK">Thema</h2>
      @if (categories().length) {
        <div class="variants">
          @for (c of categories(); track c.id) {
            <button class="vopt" type="button" [attr.aria-pressed]="selected() === c.id" (click)="set({ category: c.id })">
              <span class="vname">{{ c.name }}</span><span class="vdesc">{{ c.metric }} · {{ c.items.length }} Einträge</span>
            </button>
          }
        </div>
      } @else {
        <p class="note" style="margin: 0">Lade die Themen …</p>
      }
    </section>

    <section class="card" aria-labelledby="hR">
      <h2 class="lbl" id="hR">Regeln</h2>
      <div class="pt-opts">
        <div class="pt-opt">
          <h3>Leben</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of lives; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().lives === v" (click)="set({ lives: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="pt-opt">
          <h3>Tippen</h3>
          <div class="variants">
            <button class="vopt" type="button" [attr.aria-pressed]="options().mode === 'all'" (click)="set({ mode: 'all' })"><span class="vname">Gleichzeitig</span><span class="vdesc">Alle tippen in jeder Runde</span></button>
            <button class="vopt" type="button" [attr.aria-pressed]="options().mode === 'turns'" (click)="set({ mode: 'turns' })"><span class="vname">Reihum</span><span class="vdesc">Immer nur einer ist dran</span></button>
          </div>
        </div>
      </div>
      <p class="note" style="margin: 0">
        1 bis 8 Spieler. Zahlen aus Wikidata.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rulesSheet)">So wird gespielt</button>
      </p>
    </section>
  `,
})
export class HiloSetup {
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly sheets = inject(SheetService);
  protected readonly rulesSheet = HiloRulesSheet;
  protected readonly lives = hilo.LIVES;
  protected readonly categories = signal<HiloDataCategory[]>([]);
  protected readonly options = computed(() => this.store.options<Options>('hilo'));
  /** Gewähltes Thema; fehlt es, gilt das erste. */
  protected readonly selected = computed(() => {
    const cats = this.categories();
    const id = this.options().category;
    return cats.some(c => c.id === id) ? id : (cats[0]?.id ?? '');
  });

  constructor() {
    void loadHiloData().then(cats => this.categories.set(cats));
  }

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('hilo', patch);
  }
}
