import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewEncapsulation, computed, effect, inject, signal, untracked } from '@angular/core';
import { hitster, pluralize } from '@spieleblock/games';
import { FilmDecks } from '../../core/film/film-decks.service';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import { SpotifyAuth } from '../../core/spotify/spotify-auth.service';
import { SpotifyPlayer } from '../../core/spotify/spotify-player.service';
import { SheetService } from '../../core/ui/sheet.service';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { prefersReducedMotion } from '../../shared/dom';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { HitsterCardComponent } from './hitster-card.component';
import { HitsterMiniLine } from './hitster-mini-line.component';
import { HitsterPlayerComponent } from './hitster-player.component';
import { YearFixSheet } from './year-fix.sheet';

type Row =
  | { kind: 'slot'; key: string; i: number }
  | { kind: 'card'; key: string; card: hitster.HitsterCard; fresh: boolean }
  | { kind: 'miss'; key: string; card: hitster.HitsterCard };

type Prep = { kind: 'idle' } | { kind: 'loading'; text: string; done: number; total: number } | { kind: 'error'; text: string };

/** Das Blatt für Hitster: Stapel vorbereiten, Karte ziehen, hören, einsortieren, Einspruch, auflösen. */
@Component({
  selector: 'sb-hitster-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [GameTopbarComponent, AvatarComponent, HitsterCardComponent, HitsterMiniLine, HitsterPlayerComponent],
  template: `
    @let g = game();
    <sb-game-topbar [title]="film() ? 'Film-Zeitstrahl' : 'Hitster'" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!g.started && !!dock()">
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
              <p class="ht-deal">Für dieses Spiel wurde {{ film() ? 'keine Filmliste' : 'keine Playlist' }} gewählt. Geh zurück, wähle beim Einrichten {{ film() ? 'eine Liste' : 'eine Playlist' }} und starte neu.</p>
            } @else if (!film() && !auth.loggedIn()) {
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
        @for (key of [turnKey()]; track key) {
        <section class="ht-now" aria-live="polite" [style.--pc]="'var(--p' + active().color + ')'">
          <div class="ht-k">
            <span [sbAvatar]="active()" small></span>
            <b>{{ active().name }}</b>
            <span class="ht-sub">{{ !c ? 'ist dran' : c.phase === 'revealed' ? 'aufgelöst' : c.phase === 'listen' ? 'Wann erschienen?' : 'Platz gewählt' }}</span>
            @if (canAct() && !finished() && (!c || c.phase === 'listen')) {
              <span class="ht-tools">
                @if (c) {
                  <button class="btn" type="button" [disabled]="!canSkip()" (click)="skip()">Überspringen <small class="ht-plus">−{{ g.rules.skipCost }}</small></button>
                }
                @if (g.rules.buyCost > 0) {
                  <button class="btn" type="button" [disabled]="!canBuy()" (click)="buy()">Karte kaufen <small class="ht-plus">−{{ g.rules.buyCost }}</small></button>
                }
              </span>
            }
          </div>

          @if (c && c.phase !== 'revealed') {
            @if (film()) {
              <div class="ht-film" [class.nopic]="!poster(c.card)">
                @if (poster(c.card); as img) {
                  <span class="ht-poster" [style.background-image]="img"></span>
                }
                <span class="ht-ft"><b>{{ c.card.title }}</b>@if (c.card.artist) { <small>{{ c.card.artist }}</small> }</span>
              </div>
            } @else {
              <sb-ht-player [trackId]="c.card.id" />
            }
          } @else if (c) {
            <div class="ht-result">
              <sb-ht-card [card]="c.card" size="s" [state]="c.ok ? 'new' : 'miss'" />
              <div class="ht-res">
                <b class="ht-verdict" [class.ok]="c.ok">{{ verdict() }}</b>
                <span class="ht-song">{{ c.card.title }}{{ c.card.artist ? ' · ' + c.card.artist : '' }}</span>
                @if (canAct()) {
                  <span class="ht-acts">
                    @if (g.rules.guessReward > 0 && !c.guessed) {
                      <button class="btn" type="button" (click)="guess()">Titel &amp; Interpret richtig <small class="ht-plus">+{{ g.rules.guessReward }}</small></button>
                    }
                    <button class="link" type="button" (click)="fixYear()">Jahr stimmt nicht?</button>
                    @if (winners()) {
                      <button class="link" type="button" (click)="next()">Trotzdem weiterspielen</button>
                    }
                  </span>
                }
              </div>
            </div>
          }
        </section>
        }
      }
    </main>

    @if (g.started) {
      <section class="ht-full" aria-label="Zeitstrahl">
        <div class="ht-axis wrap" aria-hidden="true"><span>◀ früher</span><span>später ▶</span></div>
        <div class="ht-track" [class.picking]="vetoing() !== null" [style.--pc]="vetoColor()" tabindex="-1">
          <ol class="ht-rail" [attr.aria-label]="'Zeitstrahl von ' + active().name">
            @for (r of rows(); track r.key) {
              <li>
                @switch (r.kind) {
                  @case ('slot') {
                    @let by = vetoAt().get(r.i);
                    @if (chosen() === r.i) {
                      <span class="ht-slot on" [style.--pc]="'var(--p' + active().color + ')'"><span class="ht-q">?</span><small>{{ active().name }}</small></span>
                    } @else if (by !== undefined) {
                      <span class="ht-slot on veto" [style.--pc]="'var(--p' + g.players[by]!.color + ')'"><span class="ht-q">?</span><small>Einspruch {{ g.players[by]!.name }}</small></span>
                    } @else {
                      <button class="ht-slot" type="button" [disabled]="!slotEnabled(r.i)" aria-label="Hier einsortieren" (click)="onSlot(r.i)"><span>+</span></button>
                    }
                  }
                  @case ('card') {
                    <sb-ht-card [card]="r.card" [state]="r.fresh ? 'new' : ''" />
                  }
                  @case ('miss') {
                    <sb-ht-card [card]="r.card" state="miss" />
                  }
                }
              </li>
            }
          </ol>
        </div>

      </section>

      <section class="wrap ht-bands" [class.pad]="!!dock()" aria-label="Spielstand">
        @for (p of g.players; track $index; let i = $index) {
          <div class="ht-band" [class.turn]="i === g.turn && !finished()" [style.--pc]="'var(--p' + p.color + ')'">
            <div class="ht-sh">
              <span [sbAvatar]="p"></span>
              <span class="ht-sn"><b>{{ p.name }}@if (g.tbl && g.tblSeat === p.color) { <em class="me">du</em> }
                  @switch (vetoState().get(i)) {
                    @case ('pending') { <span class="ht-vtag wait">überlegt …</span> }
                    @case ('veto') { <span class="ht-vtag hit">Einspruch</span> }
                    @case ('pass') { <span class="ht-vtag">kein Einspruch</span> }
                  }</b>
                <small>
                  @for (t of tokenDots(p.tokens); track $index) { <span class="ht-tok"></span> }
                  {{ pluralize(p.tokens, 'Token', 'Token') }}
                </small></span>
              <span class="ht-n">{{ p.line.length }}<small> / {{ g.rules.goal }}</small></span>
            </div>
            @if (i !== g.turn || finished()) {
              <sb-ht-mini-line [cards]="p.line" [mark]="g.current?.stolenBy === i ? g.current!.card.id : ''" />
            }
          </div>
        }
      </section>
    }

    @if (dock(); as d) {
      <div class="dock" role="region" aria-label="Nächster Schritt">
        <div class="wrap">
          @if (vetoDock(); as v) {
            <div class="ht-dockcap">
              <span>{{ v.caption }}</span>
              @if (v.canClose) {
                <button class="link" type="button" (click)="closeVeto()">Ohne Warten weiter</button>
              }
            </div>
            @if (v.pick) {
              <button class="btn big" type="button" (click)="vetoing.set(null)">Abbrechen</button>
            } @else if (v.ask; as ask) {
              <div class="ht-dockrow">
                <button class="btn big" type="button" (click)="vetoing.set(ask.pi)">Einspruch <small class="ht-plus">−{{ game().rules.vetoCost }}</small></button>
                <button class="btn primary big" type="button" (click)="passVeto(ask.pi)">Kein Einspruch</button>
              </div>
            } @else {
              <button class="btn primary big" type="button" disabled>{{ v.wait }}</button>
            }
          } @else {
            <button class="btn primary big" type="button" [disabled]="!canAct() || !d.act" (click)="run(d.act)">{{ canAct() ? d.label : active().name + ' ist dran' }}</button>
          }
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
  private readonly films = inject(FilmDecks);
  private readonly sheets = inject(SheetService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly pluralize = pluralize;

  protected readonly game = this.ctx.typed<hitster.HitsterGame>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly film = computed(() => this.game().type === 'film');
  protected readonly active = computed(() => hitster.active(this.game()));
  protected readonly winners = computed(() => hitster.reached(this.game()));
  protected readonly chosen = computed(() => {
    const c = this.game().current;
    return c && (c.phase === 'placed' || c.phase === 'veto') ? c.slot : null;
  });

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

  /** Wer gerade einen Einspruch ansetzt (Index in `players`); die Plätze im Zeitstrahl zeigen dann diese Farbe. */
  protected readonly vetoing = signal<number | null>(null);
  protected readonly vetoColor = computed(() => {
    const pi = this.vetoing();
    return pi === null ? null : `var(--p${this.game().players[pi]?.color ?? 0})`;
  });
  /** Platz im Zeitstrahl → Spieler, der dort Einspruch eingelegt hat. */
  protected readonly vetoAt = computed(() => new Map(Object.entries(this.game().current?.vetoes ?? {}).map(([pi, slot]) => [slot, +pi] as [number, number])));

  protected readonly subtitle = computed(() => {
    const g = this.game();
    return g.started ? `Ziel ${g.rules.goal} Karten · ${g.deck.length} im Stapel` : g.source?.name || (g.type === 'film' ? 'Liste wählen' : 'Playlist wählen');
  });

  protected readonly verdict = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!c || c.phase !== 'revealed') return '';
    if (c.ok) return 'Richtig gelegt!';
    return c.stolenBy !== undefined ? `Falsch gelegt. ${g.players[c.stolenBy]!.name} gewinnt die Karte per Einspruch.` : 'Falsch gelegt, die Karte ist raus.';
  });

  protected readonly rows = computed<Row[]>(() => {
    const g = this.game();
    const line = this.active().line;
    const c = g.current;
    const placing = !!c && c.phase !== 'revealed';
    const out: Row[] = [];
    for (let i = 0; i <= line.length; i++) {
      if (placing) out.push({ kind: 'slot', key: 's' + i, i });
      else if (c?.phase === 'revealed' && !c.ok && c.slot === i && c.stolenBy === undefined) out.push({ kind: 'miss', key: 'm' + i, card: c.card });
      const card = line[i];
      if (card) out.push({ kind: 'card', key: card.id, card, fresh: c?.phase === 'revealed' && !!c.ok && c.card.id === card.id });
    }
    return out;
  });

  /** Die Einspruchsrunde: jeder andere Spieler mit seinem Stand (Einspruch, verzichtet, zu arm, überlegt noch). `null` außerhalb der Runde. */
  protected readonly vetoPanel = computed(() => {
    const g = this.game();
    const c = g.current;
    if (this.finished() || !c || c.phase !== 'veto') return null;
    const rows = g.players
      .map((p, pi) => ({
        pi,
        name: p.name,
        color: p.color,
        mine: !g.tbl || g.tblSeat == null || p.color === g.tblSeat,
        state: (c.vetoes?.[pi] !== undefined ? 'veto' : c.passed?.[pi] ? 'pass' : p.tokens < g.rules.vetoCost ? 'poor' : 'pending') as 'veto' | 'pass' | 'poor' | 'pending',
      }))
      .filter(r => r.pi !== g.turn);
    return { rows, pending: rows.filter(r => r.state === 'pending') };
  });

  /** Stand je Spieler in der Einspruchsrunde, für die Anzeige im Spielstand. */
  protected readonly vetoState = computed(() => new Map((this.vetoPanel()?.rows ?? []).map(r => [r.pi, r.state] as [number, 'veto' | 'pass' | 'poor' | 'pending'])));

  /** Die untere Leiste in der Einspruchsrunde: Wer ist gerade dran (an diesem Gerät), oder worauf wird gewartet? `null` außerhalb der Runde. */
  protected readonly vetoDock = computed(() => {
    const vp = this.vetoPanel();
    if (!vp) return null;
    const g = this.game();
    const picking = this.vetoing();
    const mine = vp.pending.find(r => r.mine);
    const canClose = this.canAct() && vp.pending.length > 0;
    if (picking !== null) return { pick: true, ask: null, wait: '', canClose, caption: `${g.players[picking]!.name}: tippe im Zeitstrahl auf den Platz` };
    if (mine) return { pick: false, ask: mine, wait: '', canClose, caption: `${mine.name}: Einspruch gegen den Platz von ${this.active().name}?` };
    const names = vp.pending.map(r => r.name).join(', ');
    return { pick: false, ask: null, wait: names ? 'Warte auf Einspruch: ' + names : 'Wird aufgelöst …', canClose, caption: '' };
  });

  protected readonly dock = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!g.started || this.finished()) return null;
    if (!c) return g.deck.length ? { label: 'Karte ziehen', act: 'draw' } : { label: 'Der Stapel ist leer: Spiel auswerten', act: 'finish' };
    if (c.phase === 'listen') return { label: 'Wähle einen Platz im Zeitstrahl', act: '' };
    if (c.phase === 'placed') return { label: 'Platz bestätigen', act: 'confirm' };
    if (c.phase === 'veto') {
      const waiting = this.vetoPanel()?.pending.map(r => r.name) ?? [];
      return { label: waiting.length ? 'Warte auf Einspruch: ' + waiting.join(', ') : 'Wird aufgelöst …', act: '' };
    }
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

  /** Neue Karte oder neuer Spieler: dann fährt die Karte oben neu herein. */
  protected readonly turnKey = computed(() => this.game().turn + ':' + (this.game().current?.card.id ?? '-'));

  /** Ändert sich, wenn im Zeitstrahl etwas Neues sehenswert ist: gewählter Platz, Einspruch, aufgelöste Karte. */
  private readonly focusKey = computed(() => {
    const c = this.game().current;
    return c ? `${c.card.id}:${c.phase}:${c.slot}:${Object.keys(c.vetoes ?? {}).length}` : 'turn' + this.game().turn;
  });

  constructor() {
    // Gastgeber (oder lokales Spiel) lädt den Stapel von selbst, sobald alles da ist
    effect(() => {
      const g = this.game();
      if (g.started || !g.source || (g.type !== 'film' && !this.auth.loggedIn()) || this.waitsForHost() || this.autoTried) return;
      this.autoTried = true;
      untracked(() => void this.prepare());
    });
    // Jede neue Karte startet auf Geräten, die abspielen sollen
    effect(() => {
      const c = this.game().current;
      if (c && c.phase === 'listen' && this.game().type !== 'film') untracked(() => void this.player.play(c.card.id));
    });
    // Einspruch ansetzen geht nur, solange der Spieler noch entscheiden muss
    effect(() => {
      const pi = this.vetoing();
      if (pi !== null && !this.vetoPanel()?.pending.some(r => r.pi === pi)) untracked(() => this.vetoing.set(null));
    });
    // Zeitstrahl zur interessanten Stelle scrollen
    effect(() => {
      this.focusKey();
      untracked(() => setTimeout(() => this.scrollToFocus(), 60));
    });
    inject(DestroyRef).onDestroy(() => {
      void this.player.pause();
      this.player.reset();
    });
  }

  private scrollToFocus(): void {
    const root = this.host.nativeElement;
    const el = root.querySelector<HTMLElement>('.ht-rail .ht-slot.on, .ht-rail .htc.new, .ht-rail .htc.miss');
    const track = root.querySelector<HTMLElement>('.ht-track');
    if (el && track) {
      // Nur den Zeitstrahl bewegen, nicht die ganze Seite
      const t = track.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const left = track.scrollLeft + (r.left - t.left) - track.clientWidth / 2 + r.width / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } else if (track) track.scrollLeft = (track.scrollWidth - track.clientWidth) / 2;
  }

  protected tokenDots = (n: number): number[] => Array.from({ length: Math.min(n, 8) });

  protected login(): void {
    void this.auth.login('/spiel/' + this.game().id);
  }

  protected poster(card: hitster.HitsterCard): string | null {
    const url = hitster.coverUrl(card);
    return url ? `url("${url}")` : null;
  }

  /** Film-Zeitstrahl: Karten aus der gewählten Liste (mitgeliefert oder TMDB) holen. */
  private async prepareFilms(source: hitster.DeckRef): Promise<void> {
    this.prepError.set('');
    this.prep.set({ kind: 'loading', text: 'Filmliste wird geladen …', done: 0, total: 0 });
    try {
      const cards = await this.films.load(source.id);
      const error = this.ctx.update<hitster.HitsterGame, string | null>(g => (g.started ? null : hitster.start(g, cards)));
      if (error) this.prepError.set(error);
      else this.ctx.notify(`Stapel bereit: ${cards.length} Filme`);
    } catch (e) {
      this.prepError.set(this.films.errorText(e));
    } finally {
      this.prep.set({ kind: 'idle' });
    }
  }

  protected async prepare(): Promise<void> {
    const source = this.game().source;
    if (!source || this.prep().kind === 'loading') return;
    if (this.film()) return this.prepareFilms(source);
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
    else if (act === 'confirm') this.confirm();
    else if (act === 'next') this.next();
    else if (act === 'finish') this.ctx.finish();
  }

  protected draw(): void {
    this.player.reset();
    if (this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.draw(g)) === null) this.ctx.notify('Der Stapel ist leer');
  }

  /** Im Zeitstrahl kann man legen (Spieler am Zug, bis er bestätigt hat) oder in der Einspruchsrunde den Einspruchsplatz wählen. */
  protected slotEnabled(slot: number): boolean {
    const c = this.game().current;
    if (!c || this.finished()) return false;
    if (c.phase === 'veto') return this.vetoing() !== null && slot !== c.slot && !Object.values(c.vetoes ?? {}).includes(slot);
    return (c.phase === 'listen' || c.phase === 'placed') && this.canAct();
  }

  protected onSlot(slot: number): void {
    if (!this.slotEnabled(slot)) return;
    const pi = this.vetoing();
    if (pi === null) {
      this.ctx.update<hitster.HitsterGame>(g => void hitster.place(g, slot));
      return;
    }
    const error = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.veto(g, pi, slot));
    this.vetoing.set(null);
    if (error) this.ctx.notify(error);
    else this.announce(`${this.game().players[pi]!.name} legt Einspruch ein`);
  }

  /** Meldet das Ergebnis, wenn die Karte durch diese Aktion aufgelöst wurde, sonst die übergebene Meldung. */
  private announce(message: string): void {
    const g = this.game();
    this.ctx.notify(g.current?.phase === 'revealed' ? hitster.revealMessage(g) : message, true);
  }

  /** Der Spieler am Zug bestätigt den Platz. Danach können die anderen widersprechen; gibt es niemanden, wird gleich aufgelöst. */
  protected confirm(): void {
    const r = this.ctx.update<hitster.HitsterGame, ReturnType<typeof hitster.confirm>>(g => hitster.confirm(g));
    if (r?.resolved) this.ctx.notify(hitster.revealMessage(this.game()), true);
  }

  protected passVeto(pi: number): void {
    const error = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.pass(g, pi));
    if (error) this.ctx.notify(error);
    else this.announce(`${this.game().players[pi]!.name}: kein Einspruch`);
  }

  /** Ohne auf die Übrigen zu warten weiter; wer noch nicht entschieden hat, widerspricht nicht. */
  protected closeVeto(): void {
    const error = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.closeVeto(g));
    if (error) this.ctx.notify(error);
    else this.announce('Einspruchsrunde beendet');
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

  protected fixYear(): void {
    const c = this.game().current;
    if (c) this.sheets.open(YearFixSheet, { data: { id: c.card.id } });
  }
}
