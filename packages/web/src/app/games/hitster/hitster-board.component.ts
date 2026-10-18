import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, computed, effect, inject, signal, untracked } from '@angular/core';
import { hitster, pluralize } from '@spieleblock/games';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';
import { SpotifyPlayer } from '../../core/spotify/spotify-player.service';
import { SheetService } from '../../core/ui/sheet.service';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { YearFixSheet } from './year-fix.sheet';

type Row =
  | { kind: 'slot'; key: string; i: number }
  | { kind: 'card'; key: string; card: hitster.HitsterCard; fresh: boolean }
  | { kind: 'miss'; key: string; card: hitster.HitsterCard };

type Prep = { kind: 'idle' } | { kind: 'loading'; text: string; done: number; total: number } | { kind: 'error'; text: string };

/** Das Blatt für Hitster: Stapel vorbereiten, Karte ziehen, hören, einsortieren, auflösen. */
@Component({
  selector: 'sb-hitster-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [GameTopbarComponent, AvatarComponent, IconComponent],
  template: `
    @let g = game();
    <sb-game-topbar title="Hitster" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!!dock()">
      @if (!g.started) {
        <section class="ht-now">
          @if (prep().kind === 'loading') {
            @let p = $any(prep());
            <div class="ht-k"><b>Stapel wird vorbereitet</b></div>
            <p class="ht-deal">{{ p.text }}</p>
            @if (p.total) {
              <div class="ht-bar"><i [style.width.%]="(p.done / p.total) * 100"></i></div>
            }
          } @else {
            <div class="ht-k"><b>Noch kein Stapel</b></div>
            @if (!g.source) {
              <p class="ht-deal">Für dieses Spiel wurde keine Playlist gewählt. Geh zurück, wähle beim Einrichten eine Playlist und starte neu.</p>
            } @else if (!auth.loggedIn()) {
              <p class="ht-deal">Um „{{ g.source.name }}“ zu laden, muss dieses Gerät mit Spotify verbunden sein.</p>
              <div class="ht-ctrls"><button class="btn primary" type="button" (click)="login()">Mit Spotify anmelden</button></div>
            } @else if (waitsForHost()) {
              <p class="ht-deal">Der Gastgeber lädt gerade „{{ g.source.name }}“. Sobald der Stapel da ist, geht es los.</p>
              <div class="ht-ctrls"><button class="btn" type="button" (click)="prepare()">Selbst laden</button></div>
            } @else {
              @if (prepError()) {
                <p class="ht-err" role="alert">{{ prepError() }}</p>
              }
              <div class="ht-ctrls"><button class="btn primary" type="button" (click)="prepare()">{{ prepError() ? 'Nochmal versuchen' : 'Stapel laden' }}</button></div>
            }
          }
        </section>
      } @else {
        @if (winners(); as w) {
          @if (!finished()) {
            <div class="notice"><span>{{ w.join(' und ') }} {{ w.length > 1 ? 'haben' : 'hat' }} {{ g.rules.goal }} Karten.</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
          }
        }
        @if (finished()) {
          <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
        }

        @let c = g.current;
        <section class="ht-now" aria-live="polite">
          @if (!c) {
            <div class="ht-k"><b>{{ active().name }}</b><span>ist dran · {{ active().line.length }} von {{ g.rules.goal }} Karten</span></div>
            <p class="ht-deal">Zieh eine Karte, hör den Song und sortiere ihn in den Zeitstrahl ein.</p>
          } @else if (c.phase !== 'revealed') {
            <div class="ht-k"><b>{{ active().name }}</b><span>Wann ist dieser Song erschienen?</span></div>
            <div class="ht-mystery">
              <span class="ht-disc" [class.spin]="player.on() && !player.busy()"><svg sb-icon name="music" [size]="34"></svg></span>
              <div class="ht-ctrls">
                @if (player.on()) {
                  <button class="btn sm" type="button" (click)="replay()">Nochmal</button>
                  <button class="btn sm" type="button" (click)="player.pause()">Pause</button>
                } @else {
                  <span class="ht-deal">Auf diesem Gerät läuft keine Musik. Sie kommt von einem anderen Gerät.</span>
                }
              </div>
            </div>
            @if (player.error(); as e) {
              <p class="ht-err" role="alert">{{ e }}</p>
            }
          } @else {
            <div class="ht-reveal" [class.ok]="c.ok" [class.no]="!c.ok">
              <span class="ht-year">{{ c.card.year }}</span>
              <span class="ht-title">{{ c.card.title }}</span>
              <span class="ht-artist">{{ c.card.artist }}</span>
              <span class="ht-verdict">{{ c.ok ? 'Richtig gelegt, die Karte bleibt im Zeitstrahl.' : 'Falsch gelegt, die Karte ist raus.' }}</span>
            </div>
            <div class="ht-ctrls">
              @if (canAct()) {
                <button class="link" type="button" (click)="fixYear()">Jahr stimmt nicht?</button>
                @if (winners()) {
                  <button class="link" type="button" (click)="next()">Trotzdem weiterspielen</button>
                }
              }
            </div>
          }

          @if (canAct() && !finished()) {
            <div class="ht-tools">
              <button class="btn" type="button" [disabled]="!canSkip()" (click)="skip()">Überspringen <small>−{{ g.rules.skipCost }}</small></button>
              @if (g.rules.guessReward > 0) {
                <button class="btn" type="button" (click)="guess()">Titel &amp; Interpret richtig <small>+{{ g.rules.guessReward }}</small></button>
              }
              @if (g.rules.buyCost > 0) {
                <button class="btn" type="button" [disabled]="!canBuy()" (click)="buy()">Karte kaufen <small>−{{ g.rules.buyCost }}</small></button>
              }
            </div>
          }
        </section>


        <div class="ht-end" aria-hidden="true">früher</div>
        <ol class="ht-line" [attr.aria-label]="'Zeitstrahl von ' + active().name">
          @for (r of rows(); track r.key) {
            <li>
              @switch (r.kind) {
                @case ('slot') {
                  <button class="ht-slot" type="button" [class.on]="chosen() === r.i" [disabled]="!canAct()" [attr.aria-pressed]="chosen() === r.i"
                    [attr.aria-label]="chosen() === r.i ? 'Hier liegt der Song' : 'Hier einsortieren'" (click)="place(r.i)">{{ chosen() === r.i ? 'Hier liegt der Song' : '+' }}</button>
                }
                @case ('card') {
                  <div class="ht-card" [class.new]="r.fresh"><span class="ht-y">{{ r.card.year }}</span><span class="ht-t"><b>{{ r.card.title }}</b><span>{{ r.card.artist }}</span></span></div>
                }
                @case ('miss') {
                  <div class="ht-card miss"><span class="ht-y">{{ r.card.year }}</span><span class="ht-t"><b>{{ r.card.title }}</b><span>falsch gelegt</span></span></div>
                }
              }
            </li>
          }
        </ol>
        <div class="ht-end" aria-hidden="true">später</div>

        <ol class="ht-stands" aria-label="Spielstand">
          @for (p of g.players; track $index; let i = $index) {
            <li class="ht-stand" [class.turn]="i === g.turn && !finished()" [style.--pc]="'var(--p' + p.color + ')'">
              <span [sbAvatar]="p"></span>
              <span><b>{{ p.name }}@if (g.tbl && g.tblSeat === p.color) { <em class="me">du</em> }</b>
                <small>
                  @for (t of tokenDots(p.tokens); track $index) { <span class="ht-tok"></span> }
                  {{ pluralize(p.tokens, 'Token', 'Token') }}
                </small></span>
              <span class="ht-n">{{ p.line.length }}<small> / {{ g.rules.goal }}</small></span>
            </li>
          }
        </ol>

        @if (g.players.length > 1) {
          <div class="ht-others">
            <h2 class="lbl">Zeitstrahl der anderen</h2>
            @for (p of others(); track p.name) {
              <div class="ht-other" [style.--pc]="'var(--p' + p.color + ')'">
                <div class="ht-who"><span [sbAvatar]="p" small></span>{{ p.name }}</div>
                <div class="ht-years">@for (card of p.line; track card.id) { <span>{{ card.year }}</span> }</div>
              </div>
            }
          </div>
        }
      }
    </main>

    @if (dock(); as d) {
      <div class="dock" role="region" aria-label="Nächster Schritt">
        <div class="wrap">
          <button class="btn primary big" type="button" [disabled]="!canAct() || !d.act" (click)="run(d.act)">{{ canAct() ? d.label : active().name + ' ist dran' }}</button>
        </div>
      </div>
    }
  `,
})
export class HitsterBoard {
  protected readonly ctx = inject(PlayContext);
  protected readonly auth = inject(SpotifyAuth);
  protected readonly player = inject(SpotifyPlayer);
  private readonly decks = inject(HitsterDecks);
  private readonly sheets = inject(SheetService);
  protected readonly pluralize = pluralize;

  protected readonly game = this.ctx.typed<hitster.HitsterGame>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly active = computed(() => hitster.active(this.game()));
  protected readonly winners = computed(() => hitster.reached(this.game()));
  protected readonly chosen = computed(() => (this.game().current?.phase === 'placed' ? this.game().current!.slot : null));

  /** Am Live-Tisch darf nur der Platz am Zug handeln; ohne eigenen Platz (oder lokal) darf jeder. */
  protected readonly canAct = computed(() => {
    const g = this.game();
    if (g.status === 'finished') return false;
    return !g.tbl || g.tblSeat == null || this.active().color === g.tblSeat;
  });
  protected readonly waitsForHost = computed(() => !!this.game().tbl && !this.game().tblHost);

  protected readonly prep = signal<Prep>({ kind: 'idle' });
  protected readonly prepError = signal('');
  private autoTried = false;

  protected readonly subtitle = computed(() => {
    const g = this.game();
    return g.started ? `Ziel ${g.rules.goal} Karten · ${g.deck.length} im Stapel` : g.source?.name || 'Playlist wählen';
  });

  protected readonly rows = computed<Row[]>(() => {
    const g = this.game();
    const line = this.active().line;
    const c = g.current;
    const placing = !!c && c.phase !== 'revealed';
    const out: Row[] = [];
    for (let i = 0; i <= line.length; i++) {
      if (placing) out.push({ kind: 'slot', key: 's' + i, i });
      else if (c?.phase === 'revealed' && !c.ok && c.slot === i) out.push({ kind: 'miss', key: 'm' + i, card: c.card });
      const card = line[i];
      if (card) out.push({ kind: 'card', key: card.id, card, fresh: c?.phase === 'revealed' && !!c.ok && c.card.id === card.id });
    }
    return out;
  });

  protected readonly others = computed(() => this.game().players.filter((_, i) => i !== this.game().turn));

  protected readonly dock = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!g.started || this.finished()) return null;
    if (!c) return g.deck.length ? { label: 'Karte ziehen', act: 'draw' } : { label: 'Der Stapel ist leer: Spiel auswerten', act: 'finish' };
    if (c.phase === 'listen') return { label: 'Wähle einen Platz im Zeitstrahl', act: '' };
    if (c.phase === 'placed') return { label: 'Auflösen', act: 'reveal' };
    if (this.winners()) return { label: 'Spiel auswerten', act: 'finish' };
    return { label: 'Weiter: ' + g.players[(g.turn + 1) % g.players.length]!.name, act: 'next' };
  });

  protected readonly canSkip = computed(() => {
    const g = this.game();
    return g.current?.phase === 'listen' && this.active().tokens >= g.rules.skipCost && g.deck.length > 0;
  });
  protected readonly canBuy = computed(() => {
    const g = this.game();
    return g.rules.buyCost > 0 && this.active().tokens >= g.rules.buyCost && g.deck.length > 0 && (!g.current || g.current.phase === 'listen');
  });

  constructor() {
    // Gastgeber (oder lokales Spiel) lädt den Stapel von selbst, sobald alles da ist
    effect(() => {
      const g = this.game();
      if (g.started || !g.source || !this.auth.loggedIn() || this.waitsForHost() || this.autoTried) return;
      this.autoTried = true;
      untracked(() => void this.prepare());
    });
    // Jede neue Karte startet auf Geräten, die abspielen sollen
    effect(() => {
      const c = this.game().current;
      if (c && c.phase === 'listen') untracked(() => void this.player.play(c.card.id));
    });
    inject(DestroyRef).onDestroy(() => {
      void this.player.pause();
      this.player.reset();
    });
  }

  protected tokenDots = (n: number): number[] => Array.from({ length: Math.min(n, 8) });

  protected login(): void {
    void this.auth.login('/spiel/' + this.game().id);
  }

  protected async prepare(): Promise<void> {
    const source = this.game().source;
    if (!source || this.prep().kind === 'loading') return;
    this.prepError.set('');
    this.prep.set({ kind: 'loading', text: 'Playlist wird gelesen …', done: 0, total: 0 });
    try {
      const playlist = await this.decks.load(source.id, (done, total) => this.prep.set({ kind: 'loading', text: `Playlist wird gelesen … ${done} von ${total}`, done, total }), true);
      const built = this.decks.cardsOf(playlist);
      const error = this.ctx.update<hitster.HitsterGame, string | null>(g => (g.started ? null : hitster.start(g, built.cards)));
      if (error) {
        this.prepError.set(error);
      } else {
        const extra = built.unchecked ? ` · ${built.unchecked} ohne Jahresprüfung` : '';
        this.ctx.notify(`Stapel bereit: ${built.cards.length} Songs${extra}`);
      }
    } catch (e) {
      this.prepError.set(this.decks.errorText(e));
    } finally {
      this.prep.set({ kind: 'idle' });
    }
  }

  protected run(act: string): void {
    if (!this.canAct()) return;
    if (act === 'draw') this.draw();
    else if (act === 'reveal') this.reveal();
    else if (act === 'next') this.next();
    else if (act === 'finish') this.ctx.finish();
  }

  protected draw(): void {
    this.player.reset();
    if (this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.draw(g)) === null) this.ctx.notify('Der Stapel ist leer');
  }

  protected place(slot: number): void {
    if (this.canAct()) this.ctx.update<hitster.HitsterGame>(g => void hitster.place(g, slot));
  }

  protected reveal(): void {
    const r = this.ctx.update<hitster.HitsterGame, ReturnType<typeof hitster.reveal>>(g => hitster.reveal(g));
    if (r) this.ctx.notify(r.message, true);
  }

  protected next(): void {
    this.ctx.update<hitster.HitsterGame>(g => void hitster.endTurn(g));
  }

  protected skip(): void {
    const error = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.skip(g));
    if (error) this.ctx.notify(error);
    else this.player.reset();
  }

  protected guess(): void {
    const msg = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.rewardGuess(g));
    if (msg) this.ctx.notify(msg, true);
  }

  protected buy(): void {
    const msg = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.buyCard(g));
    if (msg) this.ctx.notify(msg, true);
  }

  protected replay(): void {
    const c = this.game().current;
    if (c) void this.player.play(c.card.id, true);
  }

  protected fixYear(): void {
    const c = this.game().current;
    if (c) this.sheets.open(YearFixSheet, { data: { id: c.card.id } });
  }
}
