import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, effect, inject, input, signal, untracked } from '@angular/core';
import type { hitster } from '@spieleblock/games';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import { SheetService } from '../../core/ui/sheet.service';
import { SpotifyApi } from '../../core/spotify/spotify-api.service';
import { ToastService } from '../../core/ui/toast.service';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';
import { parsePlaylistId, type PlaylistHit } from '../../core/spotify/spotify.util';
import { HitsterPlaylistRow, type PlaylistRow } from './hitster-playlist-row.component';
import { inputValue } from '../../shared/dom';
import { HitsterPlayback } from './hitster-playback.component';
import { DeckSheet } from './deck.sheet';
import { Store } from '../../core/state/store.service';

type Options = hitster.HitsterOptions;
const GOALS = [5, 7, 10, 15, 20];
const SKIP_COSTS = [0, 1, 2];
const REWARDS = [0, 1, 2];
const BUY_COSTS = [0, 2, 3, 4, 5];
const VETO_COSTS = [0, 1, 2, 3];

/** Einstellungen für ein neues Hitster-Spiel: Spotify, Playlist, Regeln. */
@Component({
  selector: 'sb-hitster-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [HitsterPlayback, HitsterPlaylistRow],
  template: `
    <section class="card" aria-labelledby="hS">
      <h2 class="lbl" id="hS">Spotify</h2>
      <sb-hitster-playback returnTo="/neu/hitster" />
    </section>


    @if (auth.loggedIn()) {
      <section class="card" aria-labelledby="hD">
        <h2 class="lbl" id="hD">Playlist</h2>

        @if (selectedRow(); as sel) {
          <div class="ht-sel">
            <sb-ht-plrow [item]="sel" [selected]="true" [removable]="true" (remove)="removeDeck(sel.id)" (pick)="openDeck(sel.id)" />
            <div class="ht-selbar">
              @if (check(); as c) {
                <div class="ht-bar" role="progressbar" [attr.aria-valuenow]="c.done" [attr.aria-valuemax]="c.total"><i [style.width.%]="c.total ? (c.done / c.total) * 100 : 100"></i></div>
                <span class="ht-selt">{{ checkText(c) }}</span>
              } @else {
                <span class="ht-selt">Jahre noch nicht geprüft</span>
              }
              <span class="ht-ctrls">
                @if (check()?.state === 'running') {
                  <button class="btn sm" type="button" (click)="decks.stopCheck()">Anhalten</button>
                } @else {
                  <button class="btn sm" type="button" (click)="startCheck()">{{ check() ? 'Weiter prüfen' : 'Jahre prüfen' }}</button>
                }
                <button class="btn sm" type="button" (click)="openDeck(sel.id)">Songs ansehen</button>
              </span>
            </div>
          </div>
        }

        <div class="ht-search">
          <input class="pin" type="search" name="q" autocomplete="off" placeholder="Playlist suchen oder Link einfügen" aria-label="Playlist suchen oder Link einfügen" [value]="query()" (input)="query.set(inputValue($event))" />
          @if (query()) {
            <button class="ht-clear" type="button" aria-label="Eingabe löschen" (click)="query.set('')">×</button>
          }
        </div>
        @if (message() || searchError(); as m) {
          <p class="ht-err" role="alert">{{ m }}</p>
        }

        <div class="ht-plist" role="list">
          @if (linkId()) {
            @if (linkState(); as ls) {
              @if (ls === 'loading') {
                <p class="ht-ph">Link wird gelesen …</p>
              } @else if (ls === 'error') {
                <p class="ht-ph">Diese Playlist ließ sich nicht lesen. Ist der Link richtig und die Playlist öffentlich oder gehört sie dir?</p>
              } @else {
                <h3 class="ht-ph">Link</h3>
                <sb-ht-plrow [item]="ls" [busy]="busy()" (pick)="choose(ls, false)" />
              }
            }
          } @else {
            @if (libRows().length) {
              <h3 class="ht-ph">Zuletzt verwendet</h3>
              @for (r of libRows(); track r.id) {
                <sb-ht-plrow [item]="r" [removable]="true" (pick)="choose(r, true)" (remove)="removeDeck(r.id)" />
              }
            }
            @if (mineRows().length) {
              <h3 class="ht-ph">Meine Playlists</h3>
              @for (r of mineRows(); track r.id) {
                <sb-ht-plrow [item]="r" [busy]="busy()" (pick)="choose(r, false)" />
              }
            }
            @if (foundRows().length) {
              <h3 class="ht-ph">Auf Spotify</h3>
              @for (r of foundRows(); track r.id) {
                <sb-ht-plrow [item]="r" [busy]="busy()" (pick)="choose(r, false)" />
              }
            }
            @if (searching()) {
              <p class="ht-ph">Suche …</p>
            } @else if (!libRows().length && !mineRows().length && !foundRows().length && !selectedRow()) {
              <p class="ht-ph">{{ query().trim().length >= 2 ? 'Nichts gefunden.' : 'Noch keine Playlists. Such oben oder füge einen Link ein.' }}</p>
            }
          }
        </div>
        <p class="note" style="margin: 0">Ein Spiel braucht mindestens {{ playerCount() + 5 }} Songs. Auch private und gemeinsame Playlists gehen. Spotify nennt oft das Albumjahr, nicht das des Originals; der Block gleicht es deshalb mit MusicBrainz ab.</p>
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
          <h3>Einspruch kostet</h3>
          <div class="chips" style="margin-top: 0">
            @for (v of vetoCosts; track v) {
              <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().vetoCost === v" (click)="set({ vetoCost: v })">{{ v || 'Aus' }}</button>
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
  private readonly api = inject(SpotifyApi);
  private readonly toasts = inject(ToastService);

  protected readonly goals = GOALS;
  protected readonly tokens = [0, 1, 2, 3, 5];
  protected readonly skipCosts = SKIP_COSTS;
  protected readonly rewards = REWARDS;
  protected readonly buyCosts = BUY_COSTS;
  protected readonly vetoCosts = VETO_COSTS;
  protected readonly inputValue = inputValue;

  protected readonly options = computed(() => this.store.options<Options>('hitster'));
  protected readonly selected = computed(() => this.options().source);
  protected readonly check = computed(() => {
    const c = this.decks.check();
    return c && c.playlistId === this.selected()?.id ? c : null;
  });
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  // ------------------------------------------------------------ Suche: eine Leiste für alles
  /** Eingabe: Suchbegriff oder Link. */
  protected readonly query = signal('');
  protected readonly mine = signal<PlaylistHit[]>([]);
  private readonly found = signal<PlaylistHit[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal('');
  protected readonly linkState = signal<PlaylistRow | 'loading' | 'error' | null>(null);
  private mineLoaded = false;
  /** Je ein Zähler für Suche und Link, damit veraltete Antworten verworfen werden, ohne sich gegenseitig zu stören. */
  private seqText = 0;
  private seqLink = 0;

  /** Ein eingefügter Link (oder eine nackte Playlist-ID von 22 Zeichen) statt eines Suchbegriffs. */
  protected readonly linkId = computed(() => {
    const q = this.query().trim();
    return /spotify/i.test(q) || /^[A-Za-z0-9]{22}$/.test(q) ? parsePlaylistId(q) : null;
  });
  private readonly text = computed(() => (this.linkId() ? '' : this.query().trim().toLowerCase()));

  private readonly mineImage = computed(() => new Map(this.mine().map(h => [h.id, h.image] as [string, string | null])));
  private readonly known = computed(() => new Set([...this.decks.decks().map(d => d.id), ...(this.selected() ? [this.selected()!.id] : [])]));
  private static row(h: PlaylistHit): PlaylistRow {
    return { id: h.id, name: h.name, image: h.image, sub: h.owner + (h.tracks !== null ? (h.owner ? ' · ' : '') + h.tracks + ' Songs' : '') };
  }

  /** Die gewählte Playlist, mit Titelbild aus der Bibliothek oder den eigenen Playlists. */
  protected readonly selectedRow = computed<PlaylistRow | null>(() => {
    const s = this.selected();
    if (!s) return null;
    const d = this.decks.decks().find(x => x.id === s.id);
    return { id: s.id, name: s.name, sub: d ? `${d.count} Songs` : '', image: d?.image ?? this.mineImage().get(s.id) ?? null };
  });
  protected readonly libRows = computed<PlaylistRow[]>(() =>
    this.decks
      .decks()
      .filter(d => d.id !== this.selected()?.id && (!this.text() || d.name.toLowerCase().includes(this.text())))
      .map(d => ({ id: d.id, name: d.name, sub: `${d.count} Songs`, image: d.image ?? this.mineImage().get(d.id) ?? null })),
  );
  protected readonly mineRows = computed<PlaylistRow[]>(() =>
    this.mine()
      .filter(h => !this.known().has(h.id) && (!this.text() || h.name.toLowerCase().includes(this.text())))
      .map(HitsterSetup.row),
  );
  protected readonly foundRows = computed<PlaylistRow[]>(() => {
    const mineIds = new Set(this.mine().map(h => h.id));
    return this.found().filter(h => !this.known().has(h.id) && !mineIds.has(h.id)).map(HitsterSetup.row);
  });

  constructor() {
    // Sobald Spotify verbunden ist, die eigenen Playlists laden
    effect(() => {
      if (this.auth.loggedIn() && !this.mineLoaded) {
        this.mineLoaded = true;
        untracked(() => void this.loadMine());
      }
    });
    // Suchbegriff: kurz warten, dann auf Spotify suchen (die eigenen Playlists filtern sofort)
    effect(onCleanup => {
      const q = this.text();
      const my = ++this.seqText;
      untracked(() => {
        this.found.set([]);
        this.searchError.set('');
      });
      if (q.length < 2) return;
      const timer = setTimeout(() => void this.searchGlobal(q, my), 500);
      onCleanup(() => clearTimeout(timer));
    });
    // Link: Name und Titelbild nachladen, damit er wie jede andere Playlist aussieht
    effect(onCleanup => {
      const id = this.linkId();
      const my = ++this.seqLink;
      untracked(() => this.linkState.set(id ? 'loading' : null));
      if (!id) return;
      const timer = setTimeout(() => {
        this.api.playlistInfo(id).then(
          h => my === this.seqLink && this.linkState.set(HitsterSetup.row(h)),
          () => my === this.seqLink && this.linkState.set('error'),
        );
      }, 300);
      onCleanup(() => clearTimeout(timer));
    });
  }

  private async loadMine(): Promise<void> {
    this.searching.set(true);
    try {
      this.mine.set(await this.api.myPlaylists());
    } catch (e) {
      this.searchError.set(this.decks.errorText(e));
    } finally {
      this.searching.set(false);
    }
  }

  private async searchGlobal(q: string, my: number): Promise<void> {
    this.searching.set(true);
    try {
      const hits = await this.api.searchPlaylists(q);
      if (my === this.seqText) this.found.set(hits);
    } catch (e) {
      if (my === this.seqText) this.searchError.set(this.decks.errorText(e));
    } finally {
      if (my === this.seqText) this.searching.set(false);
    }
  }

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('hitster', patch);
  }

  /** Tippen auf eine Zeile: Aus der Bibliothek wird sie nur gewählt, alles andere wird erst eingelesen und vorgemerkt. */
  protected async choose(row: PlaylistRow, inLibrary: boolean): Promise<void> {
    if (inLibrary) {
      this.decks.select(row.id);
      return;
    }
    await this.addId(row.id);
    this.query.set('');
  }

  protected removeDeck(id: string): void {
    const name = this.decks.decks().find(d => d.id === id)?.name ?? this.selected()?.name ?? 'Playlist';
    const removed = this.decks.remove(id);
    if (removed) this.toasts.show(`„${name}“ entfernt`, () => this.decks.restore(removed));
  }

  /** Playlist per Link oder ID einlesen und vormerken. */
  protected async addId(input: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const playlist = await this.decks.load(input, undefined, true);
      this.decks.select(playlist.id);
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

  protected checkText(c: { done: number; total: number; state: string }): string {
    switch (c.state) {
      case 'running':
        return `Jahre: ${c.done} von ${c.total} geprüft`;
      case 'done':
        return 'Alle Jahre geprüft';
      case 'down':
        return `MusicBrainz antwortet nicht (${c.done} von ${c.total} geprüft), der Rest gilt mit dem Spotify-Jahr`;
      default:
        return `Angehalten bei ${c.done} von ${c.total}`;
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
}
