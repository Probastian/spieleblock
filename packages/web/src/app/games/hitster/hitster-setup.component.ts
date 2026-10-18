import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import type { hitster } from '@spieleblock/games';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import { SheetService } from '../../core/ui/sheet.service';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';
import { inputValue } from '../../shared/dom';
import { HitsterPlayback } from './hitster-playback.component';
import { DeckSheet } from './deck.sheet';
import { Store } from '../../core/state/store.service';

type Options = hitster.HitsterOptions;
const GOALS = [5, 7, 10, 15, 20];
const SKIP_COSTS = [0, 1, 2];
const REWARDS = [0, 1, 2];
const BUY_COSTS = [0, 2, 3, 4, 5];

/** Einstellungen für ein neues Hitster-Spiel: Spotify, Playlist, Regeln. */
@Component({
  selector: 'sb-hitster-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [HitsterPlayback],
  template: `
    <section class="card" aria-labelledby="hS">
      <h2 class="lbl" id="hS">Spotify</h2>
      <sb-hitster-playback returnTo="/neu/hitster" />
    </section>

    @if (auth.loggedIn()) {
      <section class="card" aria-labelledby="hD">
        <h2 class="lbl" id="hD">Playlist</h2>
        @if (decks.decks().length) {
          <div class="variants">
            @for (d of decks.decks(); track d.id) {
              <button class="vopt" type="button" [attr.aria-pressed]="options().source?.id === d.id" (click)="decks.select(d.id)">
                <span class="vname">{{ d.name }}</span><span class="vdesc">{{ d.count }} Songs</span>
              </button>
            }
          </div>
        }
        <form class="addrow" autocomplete="off" (submit)="add($event)">
          <input class="pin" name="playlist" type="text" inputmode="url" placeholder="Link zur Spotify-Playlist" aria-label="Link zur Spotify-Playlist" [value]="link()" (input)="link.set(inputValue($event))" />
          <button class="btn" type="submit" [disabled]="busy() || !link().trim()">{{ busy() ? 'Lese …' : 'Hinzufügen' }}</button>
        </form>
        @if (message(); as m) {
          <p class="ht-err" role="alert">{{ m }}</p>
        }
        <p class="note" style="margin: 0">In Spotify: Playlist öffnen, „Teilen“, „Link kopieren“. Auch private und gemeinsame Playlists gehen. Mindestens {{ playerCount() + 5 }} Songs braucht ein Spiel mit {{ playerCount() }} {{ playerCount() === 1 ? 'Spieler' : 'Spielern' }}.</p>

        @if (selected(); as d) {
          <div class="ht-opt">
            <h3>Jahre prüfen</h3>
            @if (check(); as c) {
              <div class="ht-bar" role="progressbar" [attr.aria-valuenow]="c.done" [attr.aria-valuemax]="c.total"><i [style.width.%]="c.total ? (c.done / c.total) * 100 : 100"></i></div>
              <p>
                @switch (c.state) {
                  @case ('running') { {{ c.done }} von {{ c.total }} geprüft. Das dauert etwa {{ minutes(c.total - c.done) }}, du kannst schon spielen. }
                  @case ('done') { Alle Songs sind geprüft. }
                  @case ('down') { MusicBrainz antwortet gerade nicht. {{ c.done }} von {{ c.total }} sind geprüft, der Rest läuft mit dem Spotify-Jahr. }
                  @case ('stopped') { Angehalten bei {{ c.done }} von {{ c.total }}. }
                }
              </p>
            } @else {
              <p>Spotify nennt oft das Jahr des Albums, nicht das des Originals (Sampler, Neuauflagen). Der Block gleicht die Jahre deshalb mit der freien Musikdatenbank MusicBrainz ab.</p>
            }
            <div class="ht-ctrls">
              @if (check()?.state === 'running') {
                <button class="btn sm" type="button" (click)="decks.stopCheck()">Anhalten</button>
              } @else {
                <button class="btn sm" type="button" (click)="startCheck()">{{ check() ? 'Weiter prüfen' : 'Jahre prüfen' }}</button>
              }
              <button class="btn sm" type="button" (click)="openDeck(d.id)">Songs ansehen</button>
              <button class="link" type="button" (click)="decks.remove(d.id)">Playlist entfernen</button>
            </div>
          </div>
        }
      </section>
    }

    <section class="card" aria-labelledby="hR">
      <h2 class="lbl" id="hR">Regeln</h2>
      <div class="ht-opts">
        <div class="ht-opt">
          <h3>Karten zum Sieg</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of goals; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().goal === v" (click)="set({ goal: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="ht-opt">
          <h3>Start-Token</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of tokens; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().startTokens === v" (click)="set({ startTokens: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="ht-opt">
          <h3>Song überspringen kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of skipCosts; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().skipCost === v" (click)="set({ skipCost: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="ht-opt">
          <h3>Titel und Interpret genannt bringt</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of rewards; track v) {
              <button type="button" class="chip" [attr.aria-pressed]="options().guessReward === v" (click)="set({ guessReward: v })">{{ v }}</button>
            }
          </div>
        </div>
        <div class="ht-opt">
          <h3>Karte kaufen kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of buyCosts; track v) {
              <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().buyCost === v" (click)="set({ buyCost: v })">{{ v || 'Aus' }}</button>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HitsterSetup {
  /** Von der Einrichtungsseite mitgegeben. */
  readonly playerCount = input(1);

  protected readonly auth = inject(SpotifyAuth);
  protected readonly decks = inject(HitsterDecks);
  private readonly store = inject(Store);
  private readonly sheets = inject(SheetService);

  protected readonly goals = GOALS;
  protected readonly tokens = [0, 1, 2, 3, 5];
  protected readonly skipCosts = SKIP_COSTS;
  protected readonly rewards = REWARDS;
  protected readonly buyCosts = BUY_COSTS;
  protected readonly inputValue = inputValue;

  protected readonly options = computed(() => this.store.options<Options>('hitster'));
  protected readonly selected = computed(() => this.options().source);
  protected readonly check = computed(() => {
    const c = this.decks.check();
    return c && c.playlistId === this.selected()?.id ? c : null;
  });
  protected readonly link = signal('');
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('hitster', patch);
  }

  protected async add(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const playlist = await this.decks.load(this.link(), undefined, true);
      this.decks.select(playlist.id);
      this.link.set('');
      const cards = this.decks.cardsOf(playlist);
      if (cards.cards.length < this.playerCount() + 5) this.message.set(`Nur ${cards.cards.length} spielbare Songs in dieser Playlist. Das ist zu wenig für ein Spiel.`);
      else if (playlist.truncated) this.message.set(`Die Playlist ist sehr lang. Pro Spiel werden höchstens ${400} zufällige Songs verwendet.`);
      void this.decks.checkYears(playlist);
    } catch (err) {
      this.message.set(this.decks.errorText(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async startCheck(): Promise<void> {
    const d = this.selected();
    if (!d) return;
    try {
      void this.decks.checkYears(await this.decks.load(d.id));
    } catch (err) {
      this.message.set(this.decks.errorText(err));
    }
  }

  protected openDeck(id: string): void {
    this.sheets.open(DeckSheet, { tall: true, data: { id } });
  }

  protected minutes(songs: number): string {
    const m = Math.max(1, Math.round((songs * 1.5) / 60));
    return m === 1 ? 'eine Minute' : `${m} Minuten`;
  }
}
