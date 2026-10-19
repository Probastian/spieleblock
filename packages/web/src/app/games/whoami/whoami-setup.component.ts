import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { whoami, wordCategory } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { WhoamiRulesSheet } from './whoami-rules.sheet';

type Options = whoami.WhoamiOptions;

@Component({
  selector: 'sb-whoami-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="wM">
      <h2 class="lbl" id="wM">Spielart</h2>
      <div class="variants">
        <button class="vopt" type="button" [attr.aria-pressed]="options().mode === 'table'" (click)="mode('table')"><span class="vname">Am Tisch</span><span class="vdesc">Jeder hat eine Figur, die nur die anderen sehen</span></button>
        <button class="vopt" type="button" [attr.aria-pressed]="options().mode === 'forehead'" (click)="mode('forehead')"><span class="vname">Stirnraten</span><span class="vdesc">Ein Handy an der Stirn, die anderen erklären</span></button>
      </div>
    </section>

    <section class="card" aria-labelledby="wR">
      <h2 class="lbl" id="wR">Regeln</h2>
      <div class="pt-opts">
        @if (options().mode === 'table') {
          <div class="pt-opt">
            <h3>Runden</h3>
            <div class="chips" style="margin-top: 0">
              @for (v of tableRounds; track v) {
                <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().rounds === v" (click)="set({ rounds: v })">{{ v || 'Offen' }}</button>
              }
            </div>
            <p>Wer seine Figur als Erster errät, bekommt so viele Punkte wie Spieler, jeder Weitere einen weniger.</p>
          </div>
        } @else {
          <div class="pt-opt">
            <h3>Zeit pro Zug</h3>
            <div class="chips" style="margin-top: 0">
              @for (v of seconds; track v) {
                <button type="button" class="chip" [attr.aria-pressed]="options().seconds === v" (click)="set({ seconds: v })">{{ v }} s</button>
              }
            </div>
          </div>
          <div class="pt-opt">
            <h3>Durchgänge</h3>
            <div class="chips" style="margin-top: 0">
              @for (v of laps; track v) {
                <button type="button" class="chip" [attr.aria-pressed]="options().rounds === v" (click)="set({ rounds: v })">{{ v }}</button>
              }
            </div>
            <p>So oft kommt jeder Spieler dran. Jeder richtige Begriff ist ein Punkt.</p>
          </div>
        }
      </div>
    </section>

    <section class="card" aria-labelledby="wK">
      <h2 class="lbl" id="wK">Kategorien</h2>
      <div class="chips" style="margin-top: 0">
        <button type="button" class="chip txt" [attr.aria-pressed]="!options().categories.length" (click)="set({ categories: [] })">Alle</button>
        @for (c of categories(); track c.id) {
          <button type="button" class="chip txt" [attr.aria-pressed]="options().categories.includes(c.id)" (click)="toggle(c.id)">{{ c.name }}</button>
        }
      </div>
      <p class="note" style="margin: 0">
        Am Tisch geht es mit 2 bis 8 Spielern, am schönsten am Live-Tisch.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rulesSheet)">So wird gespielt</button>
      </p>
    </section>
  `,
})
export class WhoamiSetup {
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly sheets = inject(SheetService);
  protected readonly rulesSheet = WhoamiRulesSheet;
  protected readonly tableRounds = [1, 3, 5, 0];
  protected readonly seconds = whoami.SECONDS;
  protected readonly laps = [1, 2, 3];

  protected readonly options = computed(() => this.store.options<Options>('whoami'));
  protected readonly categories = computed(() => whoami.allowedCategories(this.options().mode).map(id => wordCategory(id)!));

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('whoami', patch);
  }

  protected mode(mode: Options['mode']): void {
    if (this.options().mode === mode) return;
    this.set({ mode, categories: [], rounds: mode === 'forehead' ? 1 : whoami.DEFAULT_RULES.rounds });
  }

  protected toggle(id: string): void {
    const cur = this.options().categories;
    this.set({ categories: cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id] });
  }
}
