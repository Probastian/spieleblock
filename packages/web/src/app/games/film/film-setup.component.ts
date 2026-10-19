import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { hitster } from '@spieleblock/games';
import { FilmDecks } from '../../core/film/film-decks.service';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { FilmRulesSheet } from './film-rules.sheet';

type Options = hitster.HitsterOptions;
const GOALS = [5, 7, 10, 15, 20];
const START_TOKENS = [0, 1, 2, 3, 4, 5];
const SKIP_COSTS = [0, 1, 2];
const BUY_COSTS = [0, 2, 3, 4, 5];
const VETO_COSTS = [0, 1, 2, 3];

/** Einstellungen für ein neues Film-Zeitstrahl-Spiel: Filmliste und Regeln. */
@Component({
  selector: 'sb-film-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="fL">
      <h2 class="lbl" id="fL">Filmliste</h2>
      <div class="variants">
        @for (l of decks.lists(); track l.id) {
          <button class="vopt" type="button" [attr.aria-pressed]="selected() === l.id" (click)="decks.select(l.id)">
            <span class="vname">{{ l.name }}</span><span class="vdesc">{{ l.blurb }}</span>
          </button>
        }
      </div>
      @if (!decks.online()) {
        <p class="note" style="margin: 0">Mit einem TMDB-Zugang auf dem Server gibt es weitere Listen mit Plakaten (Jahrzehnte, deutsche Filme, Animation). Siehe docs/betrieb.md.</p>
      }
    </section>

    <section class="card" aria-labelledby="fR">
      <h2 class="lbl" id="fR">Regeln</h2>
      <div class="pt-opts">
        <div class="pt-opt">
          <h3>Karten zum Sieg</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of goals; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().goal === v" (click)="set({ goal: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="pt-opt">
          <h3>Start-Token</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of startTokens; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().startTokens === v" (click)="set({ startTokens: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="pt-opt">
          <h3>Film überspringen kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of skipCosts; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().skipCost === v" (click)="set({ skipCost: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="pt-opt">
          <h3>Einspruch kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of vetoCosts; track v) {
              <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().vetoCost === v" (click)="set({ vetoCost: v })">{{ v || 'Aus' }}</button>
            }
          </div>
        </div>
        <div class="pt-opt">
          <h3>Karte kaufen kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of buyCosts; track v) {
              <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().buyCost === v" (click)="set({ buyCost: v })">{{ v || 'Aus' }}</button>
            }
          </div>
        </div>
      </div>
      <p class="note" style="margin: 0">
        Mindestens {{ playerCount() + 5 }} Filme braucht ein Spiel mit {{ playerCount() }} {{ playerCount() === 1 ? 'Spieler' : 'Spielern' }}.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rulesSheet)">So wird gespielt</button>
      </p>
    </section>
  `,
})
export class FilmSetup {
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly decks = inject(FilmDecks);
  protected readonly sheets = inject(SheetService);
  protected readonly rulesSheet = FilmRulesSheet;
  protected readonly goals = GOALS;
  protected readonly startTokens = START_TOKENS;
  protected readonly skipCosts = SKIP_COSTS;
  protected readonly buyCosts = BUY_COSTS;
  protected readonly vetoCosts = VETO_COSTS;

  protected readonly options = computed(() => this.store.options<Options>('film'));
  /** Gewählte Liste; ohne Wahl gilt die mitgelieferte. */
  protected readonly selected = computed(() => {
    const id = this.options().source?.id;
    return this.decks.lists().some(l => l.id === id) ? id : this.decks.lists()[0]!.id;
  });

  constructor() {
    // Ohne Wahl gleich die erste Liste vormerken, damit das neue Spiel sie bekommt
    queueMicrotask(() => {
      if (!this.options().source) this.decks.select(this.decks.lists()[0]!.id);
    });
  }

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('film', patch);
  }
}
