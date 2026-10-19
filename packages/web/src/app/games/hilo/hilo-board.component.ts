import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { hilo, pluralize } from '@spieleblock/games';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { canActAs, mineIndex } from '../party/seat';
import { categoryOf, formatValue, itemsOf, loadHiloData } from './hilo-data';

type Game = hilo.HiloGame;

/** Das Blatt für „Mehr oder weniger“: zwei Objekte vergleichen, tippen, auflösen. */
@Component({
  selector: 'sb-hilo-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameTopbarComponent, AvatarComponent],
  template: `
    @let g = game();
    <sb-game-topbar title="Mehr oder weniger" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!!dock()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (over()) {
        <div class="notice"><span>{{ overText() }}</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      }

      @if (!g.started) {
        <section class="pt-now good">
          <div class="pt-k"><b>Das Spiel wird vorbereitet</b></div>
          @if (error()) {
            <p class="pt-err" role="alert">{{ error() }}</p>
            <div class="pt-ctrls"><button class="btn primary" type="button" (click)="prepare()">Nochmal versuchen</button></div>
          } @else if (waitsForHost()) {
            <p class="pt-deal">Der Gastgeber wählt die Einträge aus. Sobald sie da sind, geht es los.</p>
            <div class="pt-ctrls"><button class="btn" type="button" (click)="prepare()">Selbst starten</button></div>
          } @else {
            <p class="pt-deal">Einen Moment, die Einträge werden gemischt …</p>
          }
        </section>
      } @else if (ref(); as a) {
        @let b = next()!;
        <section class="pt-now" [class.good]="g.phase === 'reveal' && verdictOfMine() === true" [class.bad]="g.phase === 'reveal' && verdictOfMine() === false">
          <div class="pt-k"><b>{{ g.cat!.name }}</b><span>{{ g.cat!.metric }}</span></div>
          <div class="hl-pair">
            <div class="hl-card" aria-label="Vergleichsobjekt">
              <span class="k">Bekannt</span>
              <span class="nm">{{ a.name }}</span>
              <span class="ct">{{ a.note ?? '' }}</span>
              <span class="val">{{ fmt(a.value) }}<small>{{ g.cat!.unit }}</small></span>
            </div>
            <div class="hl-card q" [class.win]="g.phase === 'reveal'" aria-label="Gesuchtes Objekt">
              <span class="k">Gesucht</span>
              <span class="nm">{{ b.name }}</span>
              <span class="ct">{{ b.note ?? '' }}</span>
              @if (g.phase === 'reveal') {
                <span class="val pt-pop">{{ fmt(b.value) }}<small>{{ g.cat!.unit }}</small></span>
              } @else {
                <span class="val">?</span>
              }
            </div>
          </div>

          @if (g.phase === 'guess') {
            <p class="hl-q">Hat <b>{{ b.name }}</b> mehr oder weniger {{ g.cat!.metric }} als <b>{{ a.name }}</b>?</p>
          } @else {
            <p class="hl-q"><b>{{ b.name }}</b> hat {{ b.value === a.value ? 'genau so viel' : b.value > a.value ? 'mehr' : 'weniger' }} {{ g.cat!.metric }} als <b>{{ a.name }}</b>.</p>
          }

          <div class="pt-rows">
            @for (i of rowOrder(); track i) {
              @let p = g.players[i]!;
              <div class="pt-row hl-row" [class.me]="i === me()" [class.done]="p.lives === 0" [style.--pc]="'var(--p' + p.color + ')'">
                <span [sbAvatar]="p"></span>
                <span class="pt-rn">
                  <b>{{ p.name }}@if (i === me()) { <em class="me">du</em> }</b>
                  <small>
                    <span class="pt-hearts" [attr.aria-label]="pluralize(p.lives, 'Leben', 'Leben')">
                      @for (h of heartSlots(); track $index) {
                        <span [class.gone]="$index >= p.lives">♥</span>
                      }
                    </span>
                    · {{ p.score }} richtig · Serie {{ p.streak }}
                  </small>
                </span>
                <span class="hl-ans">
                  @if (p.lives === 0) {
                    <span class="pt-tag wait">raus</span>
                  } @else if (g.phase === 'reveal') {
                    @if (g.verdict[i] !== undefined) {
                      <span class="pt-tag" [class.ok]="g.verdict[i]" [class.no]="!g.verdict[i]">{{ g.verdict[i] ? 'richtig' : 'falsch' }}</span>
                    }
                  } @else if (!expected().includes(i)) {
                    <span class="pt-tag wait">wartet</span>
                  } @else if (g.answers[i] !== undefined) {
                    <span class="pt-tag ok">{{ mine(i) ? (g.answers[i] === 'more' ? 'Mehr' : 'Weniger') : 'getippt' }}</span>
                    @if (mine(i)) {
                      <button class="link" type="button" (click)="answer(i, g.answers[i] === 'more' ? 'less' : 'more')">ändern</button>
                    }
                  } @else if (mine(i)) {
                    <button class="btn" type="button" (click)="answer(i, 'more')">Mehr</button>
                    <button class="btn" type="button" (click)="answer(i, 'less')">Weniger</button>
                  } @else {
                    <span class="pt-tag wait">überlegt …</span>
                  }
                </span>
              </div>
            }
          </div>

          @if (g.phase === 'guess' && anyAnswer()) {
            <div><button class="link" type="button" (click)="closeGuessing()">Ohne Warten auflösen</button></div>
          }
        </section>
      }
    </main>

    @if (dock(); as d) {
      <div class="dock" role="region" aria-label="Nächster Schritt">
        <div class="wrap">
          <button class="btn primary big" type="button" (click)="run(d.act)">{{ d.label }}</button>
        </div>
      </div>
    }
  `,
})
export class HiloBoard {
  protected readonly ctx = inject(PlayContext);
  protected readonly pluralize = pluralize;
  protected readonly fmt = formatValue;

  protected readonly game = this.ctx.typed<Game>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly over = computed(() => !this.finished() && hilo.isOver(this.game()));
  protected readonly me = computed(() => mineIndex(this.game()));
  protected readonly ref = computed(() => hilo.reference(this.game()));
  protected readonly next = computed(() => hilo.challenger(this.game()));
  protected readonly expected = computed(() => hilo.expected(this.game()));
  protected readonly anyAnswer = computed(() => Object.keys(this.game().answers).length > 0);
  protected readonly error = signal('');
  protected readonly waitsForHost = computed(() => !!this.game().tbl && !this.game().tblHost);

  protected readonly subtitle = computed(() => {
    const g = this.game();
    return g.started ? `${g.cat!.name} · Frage ${g.pos} von ${g.items.length - 1}` : 'Wird vorbereitet';
  });

  protected readonly heartSlots = computed(() => Array.from({ length: this.game().rules.lives }));

  /** Eigener Platz zuerst, die anderen in Reihenfolge. */
  protected readonly rowOrder = computed(() => {
    const g = this.game();
    const m = this.me();
    const all = g.players.map((_, i) => i);
    return m === null ? all : [m, ...all.filter(i => i !== m)];
  });

  /** War der Tipp dieses Geräts richtig? Lokal: war der erste erwartete Tipp richtig? */
  protected readonly verdictOfMine = computed(() => {
    const g = this.game();
    if (g.phase !== 'reveal') return null;
    const m = this.me();
    if (m !== null) return g.verdict[m] ?? null;
    const first = this.expected()[0];
    return g.players.length === 1 && first !== undefined ? (g.verdict[first] ?? null) : null;
  });

  protected readonly overText = computed(() => {
    const g = this.game();
    const alive = hilo.alive(g);
    if (!alive.length) return 'Alle Leben sind weg.';
    if (g.players.length > 1 && alive.length === 1) return `${g.players[alive[0]!]!.name} bleibt als Letzter übrig.`;
    return 'Alle Einträge sind durch.';
  });

  protected readonly dock = computed(() => {
    const g = this.game();
    if (this.finished() || !g.started) return null;
    if (g.phase === 'reveal') return this.over() ? { label: 'Spiel auswerten', act: 'finish' } : { label: 'Weiter', act: 'next' };
    return null;
  });

  private autoTried = false;

  constructor() {
    // Gastgeber (oder lokales Spiel) wählt die Einträge von selbst
    effect(() => {
      const g = this.game();
      if (g.started || this.waitsForHost() || this.autoTried) return;
      this.autoTried = true;
      untracked(() => void this.prepare());
    });
  }

  protected mine(i: number): boolean {
    return canActAs(this.game(), i);
  }

  protected async prepare(): Promise<void> {
    this.error.set('');
    try {
      const cats = await loadHiloData();
      const want = this.game().rules.category;
      const cat = cats.find(c => c.id === want) ?? cats[0];
      if (!cat) return void this.error.set('Keine Themen gefunden.');
      const error = this.ctx.update<Game, string | null>(g => (g.started ? null : hilo.start(g, categoryOf(cat), itemsOf(cat))));
      if (error) this.error.set(error);
    } catch {
      this.error.set('Die Einträge konnten nicht geladen werden.');
    }
  }

  protected answer(i: number, guess: hilo.HiloGuess): void {
    const error = this.ctx.update<Game, string | null>(g => hilo.answer(g, i, guess));
    if (error) this.ctx.notify(error);
  }

  protected closeGuessing(): void {
    const error = this.ctx.update<Game, string | null>(g => hilo.closeGuessing(g));
    if (error) this.ctx.notify(error);
  }

  protected run(act: string): void {
    if (act === 'next') {
      const error = this.ctx.update<Game, string | null>(g => hilo.next(g));
      if (error) this.ctx.notify(error);
    } else if (act === 'finish') this.ctx.finish();
  }
}
