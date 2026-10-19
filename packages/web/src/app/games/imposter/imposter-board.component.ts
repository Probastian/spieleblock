import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { engineOf, imposter, pluralize } from '@spieleblock/games';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { PartyStandings } from '../party/standings.component';
import { mineIndex } from '../party/seat';

type Game = imposter.ImposterGame;

/** Das Blatt für Imposter: Rolle ansehen, Hinweise, Abstimmung, Auflösung. */
@Component({
  selector: 'sb-imposter-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameTopbarComponent, AvatarComponent, PartyStandings],
  template: `
    @let g = game();
    @let c = g.current;
    <sb-game-topbar title="Imposter" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!!dock()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (allPlayed()) {
        <div class="notice"><span>Alle {{ g.rules.rounds }} Runden sind gespielt.</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      }

      @if (!c) {
        <section class="pt-now cool">
          <div class="pt-k"><b>Bereit?</b></div>
          <p class="pt-deal">Gleich bekommen alle ein geheimes Wort, nur einer nicht. {{ g.players.length }} Spieler{{ g.rules.rounds ? ', ' + g.rules.rounds + ' Runden' : '' }}.{{ tableHint() }}</p>
        </section>
      } @else {
        @switch (c.phase) {
          @case ('reveal') {
            <section class="pt-now cool">
              @if (viewer(); as v) {
                <div class="pt-k" [style.--pc]="'var(--p' + g.players[v.i]!.color + ')'">
                  <span [sbAvatar]="g.players[v.i]!"></span><b>{{ g.players[v.i]!.name }}</b><span>{{ tabled() ? 'Deine Rolle' : 'ist dran' }}</span>
                </div>
                @if (!shown()) {
                  <div class="pt-secret">
                    <p class="pt-deal">{{ tabled() ? 'Schau, dass niemand mitliest.' : 'Gib das Handy an ' + g.players[v.i]!.name + '. Die anderen schauen weg.' }}</p>
                    <button class="btn primary big" type="button" (click)="shown.set(true)">Rolle ansehen</button>
                  </div>
                } @else {
                  <div class="pt-secret pt-pop">
                    @if (isImp(v.i)) {
                      <div class="pt-big">Du bist der Imposter!</div>
                      @if (g.rules.hint) {
                        <p class="pt-sub">Die Kategorie: <b>{{ c.category }}</b></p>
                      } @else {
                        <p class="pt-sub">Du kennst das Wort nicht. Finde es heraus, ohne aufzufallen.</p>
                      }
                      @if (c.imposters.length > 1) {
                        <p class="pt-sub">Es gibt {{ c.imposters.length }} Imposter. Ihr wisst nicht voneinander.</p>
                      }
                    } @else {
                      <p class="pt-sub">Das geheime Wort</p>
                      <div class="pt-big">{{ c.word }}</div>
                      <p class="pt-sub">Kategorie: {{ c.category }}</p>
                    }
                    <button class="btn primary big" type="button" (click)="seen(v.i)">{{ tabled() ? 'Verstanden' : 'Verstanden, weitergeben' }}</button>
                  </div>
                }
              } @else {
                <p class="pt-deal"><b>Rolle gesehen.</b> Wir warten noch auf {{ waitingNames() }}.</p>
              }
              <div class="pt-chips" aria-label="Wer hat seine Rolle gesehen?">
                @for (p of g.players; track $index) {
                  <span class="pt-tag" [class.ok]="c.seen.includes($index)" [class.wait]="!c.seen.includes($index)" [style.--pc]="'var(--p' + p.color + ')'"><i></i>{{ p.name }}</span>
                }
              </div>
              @if (c.seen.length && c.seen.length < g.players.length) {
                <div><button class="link" type="button" (click)="skipWaiting()">Ohne Warten weiter</button></div>
              }
            </section>
          }

          @case ('talk') {
            <section class="pt-now">
              <div class="pt-k" [style.--pc]="'var(--p' + g.players[c.starter]!.color + ')'">
                <span [sbAvatar]="g.players[c.starter]!"></span><b>{{ g.players[c.starter]!.name }}</b><span>beginnt</span>
              </div>
              <p class="pt-deal">Reihum nennt jeder einen Hinweis zum Wort. Nicht zu deutlich, sonst weiß der Imposter Bescheid. Nicht zu vage, sonst wirkt ihr verdächtig.</p>
              <div class="pt-order" aria-label="Reihenfolge">
                @for (i of order(); track i; let k = $index) {
                  <span class="pt-tag" [style.--pc]="'var(--p' + g.players[i]!.color + ')'"><b>{{ k + 1 }}</b>{{ g.players[i]!.name }}</span>
                }
              </div>
              @if (me() !== null) {
                <div class="pt-ctrls">
                  <button class="btn sm" type="button" (click)="peek.set(!peek())" [attr.aria-pressed]="peek()">{{ peek() ? 'Rolle verbergen' : 'Meine Rolle nochmal ansehen' }}</button>
                </div>
                @if (peek()) {
                  <div class="pt-secret">
                    @if (isImp(me()!)) {
                      <div class="pt-big">Du bist der Imposter!</div>
                      @if (g.rules.hint) {
                        <p class="pt-sub">Kategorie: {{ c.category }}</p>
                      }
                    } @else {
                      <div class="pt-big">{{ c.word }}</div>
                      <p class="pt-sub">Kategorie: {{ c.category }}</p>
                    }
                  </div>
                }
              }
            </section>
          }

          @case ('vote') {
            <section class="pt-now alt">
              <div class="pt-k"><b>Wer ist der Imposter?</b></div>
              @if (me() === null) {
                <p class="pt-deal">Besprecht es und tippt dann an, wen die Runde verdächtigt.</p>
                <div class="pt-rows">
                  @for (p of g.players; track $index; let i = $index) {
                    <button class="pt-row pick" type="button" [style.--pc]="'var(--p' + p.color + ')'" (click)="accuse(i)">
                      <span [sbAvatar]="p"></span><span class="pt-rn"><b>{{ p.name }}</b></span><span></span>
                    </button>
                  }
                </div>
              } @else {
                @if (c.votes[me()!] === undefined) {
                  <p class="pt-deal">Tippe auf den, den du verdächtigst. Das merkt niemand, bis alle gewählt haben.</p>
                } @else {
                  <p class="pt-deal"><b>Gewählt.</b> Du kannst deine Stimme noch ändern, bis alle fertig sind.</p>
                }
                <div class="pt-rows">
                  @for (p of g.players; track $index; let i = $index) {
                    @if (i !== me()) {
                      <button class="pt-row pick" type="button" [attr.aria-pressed]="c.votes[me()!] === i" [style.--pc]="'var(--p' + p.color + ')'" (click)="vote(i)">
                        <span [sbAvatar]="p"></span><span class="pt-rn"><b>{{ p.name }}</b></span><span>{{ c.votes[me()!] === i ? '✓' : '' }}</span>
                      </button>
                    }
                  }
                </div>
              }
              <div class="pt-chips" aria-label="Wer hat gewählt?">
                @for (p of g.players; track $index) {
                  <span class="pt-tag" [class.ok]="c.votes[$index] !== undefined" [class.wait]="c.votes[$index] === undefined" [style.--pc]="'var(--p' + p.color + ')'"><i></i>{{ p.name }}</span>
                }
              </div>
              @if (anyVote()) {
                <div><button class="link" type="button" (click)="closeVote()">Ohne Warten auswerten</button></div>
              }
            </section>
          }

          @case ('guess') {
            <section class="pt-now bad">
              <div class="pt-k" [style.--pc]="'var(--p' + g.players[c.accused!]!.color + ')'">
                <span [sbAvatar]="g.players[c.accused!]!"></span><b>{{ g.players[c.accused!]!.name }}</b><span>wurde erwischt!</span>
              </div>
              @if (me() === c.accused) {
                <p class="pt-deal">Du bist der Imposter. Rate laut das Wort. Die anderen sagen dir, ob es stimmt.</p>
              } @else {
                <p class="pt-deal">{{ g.players[c.accused!]!.name }} war der Imposter und darf jetzt das Wort raten. Es lautet <b>{{ c.word }}</b>. Stimmt der Tipp?</p>
                <div class="pt-ctrls">
                  <button class="btn" type="button" (click)="judge(true)">Richtig geraten</button>
                  <button class="btn" type="button" (click)="judge(false)">Falsch</button>
                </div>
              }
            </section>
          }

          @case ('result') {
            @let r = lastRound();
            <section class="pt-now" [class.good]="r?.caught && !r?.guessed" [class.bad]="!r?.caught || r?.guessed">
              <div class="pt-k"><b>{{ headline() }}</b></div>
              <p class="pt-deal">Das Wort war <b>{{ c.word }}</b> ({{ c.category }}). {{ impostersText() }}</p>
              @if (c.accused !== null) {
                <p class="pt-deal">Verdächtigt wurde {{ g.players[c.accused]!.name }}.{{ c.guessed === undefined ? '' : c.guessed ? ' Das Wort wurde erraten.' : ' Das Wort wurde nicht erraten.' }}</p>
              } @else {
                <p class="pt-deal">Bei der Abstimmung gab es einen Gleichstand, niemand wurde verdächtigt.</p>
              }
              @if (votesList().length) {
                <p class="pt-deal">{{ votesList().join(', ') }}</p>
              }
            </section>
          }
        }
      }

      <sb-pt-standings [rows]="rows()" [me]="me()" [gain]="gain()" [lead]="g.history.length > 0" />
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
export class ImposterBoard {
  protected readonly ctx = inject(PlayContext);

  protected readonly game = this.ctx.typed<Game>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly me = computed(() => mineIndex(this.game()));
  protected readonly tabled = computed(() => this.me() !== null);
  protected readonly allPlayed = computed(() => !this.finished() && imposter.allPlayed(this.game()));
  protected readonly rows = computed(() => engineOf('imposter')!.result(this.game()));

  /** Rolle sichtbar (nur lokal, nie geteilt). */
  protected readonly shown = signal(false);
  protected readonly peek = signal(false);

  protected readonly subtitle = computed(() => {
    const g = this.game();
    const c = g.current;
    const total = g.rules.rounds ? ` von ${g.rules.rounds}` : '';
    return c ? `Runde ${c.n}${total} · ${pluralize(c.imposters.length, 'Imposter', 'Imposter')}` : 'Noch nicht gestartet';
  });

  protected readonly tableHint = computed(() => (this.game().tbl ? '' : ' Tipp: Am Live-Tisch sieht jeder seine Rolle auf dem eigenen Handy.'));

  /** Wer gerade seine Rolle ansehen darf (am Live-Tisch der eigene Platz, lokal der Nächste, der sie noch nicht kennt). */
  protected readonly viewer = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!c || c.phase !== 'reveal') return null;
    const m = this.me();
    if (m !== null) return c.seen.includes(m) ? null : { i: m };
    const i = g.players.findIndex((_, k) => !c.seen.includes(k));
    return i >= 0 ? { i } : null;
  });

  protected readonly waitingNames = computed(() => {
    const g = this.game();
    const c = g.current;
    return c ? g.players.filter((_, i) => !c.seen.includes(i)).map(p => p.name).join(', ') : '';
  });

  /** Reihenfolge der Hinweise ab dem Beginner. */
  protected readonly order = computed(() => {
    const g = this.game();
    const s = g.current?.starter ?? 0;
    return g.players.map((_, k) => (s + k) % g.players.length);
  });

  protected readonly anyVote = computed(() => !!Object.keys(this.game().current?.votes ?? {}).length);
  protected readonly lastRound = computed(() => this.game().history[this.game().history.length - 1]);
  protected readonly gain = computed(() => (this.game().current?.phase === 'result' ? (this.game().current?.gain ?? null) : null));

  protected readonly headline = computed(() => {
    const r = this.lastRound();
    if (!r) return '';
    if (!r.caught) return r.accused === null ? 'Der Imposter ist durchgerutscht' : 'Falsch verdächtigt';
    return r.guessed ? 'Erwischt, aber das Wort erraten' : 'Imposter enttarnt!';
  });

  protected readonly impostersText = computed(() => {
    const g = this.game();
    const names = (g.current?.imposters ?? []).map(i => g.players[i]!.name);
    return names.length > 1 ? `Imposter waren ${names.join(' und ')}.` : `Imposter war ${names[0]}.`;
  });

  protected readonly votesList = computed(() => {
    const g = this.game();
    const v = g.current?.votes ?? {};
    return Object.keys(v).map(k => `${g.players[+k]!.name} → ${g.players[v[k]!]!.name}`);
  });

  protected readonly dock = computed(() => {
    const g = this.game();
    const c = g.current;
    if (this.finished()) return null;
    if (!c) return { label: 'Runde 1 starten', act: 'start' };
    if (c.phase === 'talk') return { label: 'Zur Abstimmung', act: 'vote' };
    if (c.phase === 'result') return this.allPlayed() ? { label: 'Spiel auswerten', act: 'finish' } : { label: `Runde ${c.n + 1} starten`, act: 'start' };
    return null;
  });

  constructor() {
    // Neue Rolle: wieder verdecken
    effect(() => {
      const key = this.viewer()?.i;
      const round = this.game().current?.n;
      void [key, round];
      untracked(() => {
        this.shown.set(false);
        this.peek.set(false);
      });
    });
  }

  protected isImp(i: number): boolean {
    return !!this.game().current?.imposters.includes(i);
  }

  protected run(act: string): void {
    if (act === 'start') this.fail(this.ctx.update<Game, string | null>(g => imposter.startRound(g)));
    else if (act === 'vote') this.fail(this.ctx.update<Game, string | null>(g => imposter.startVote(g)));
    else if (act === 'finish') this.ctx.finish();
  }

  protected seen(i: number): void {
    this.shown.set(false);
    this.ctx.update<Game>(g => imposter.see(g, i));
  }

  protected skipWaiting(): void {
    this.ctx.update<Game>(g => imposter.skipReveal(g));
  }

  protected vote(target: number): void {
    const m = this.me();
    if (m !== null) this.fail(this.ctx.update<Game, string | null>(g => imposter.vote(g, m, target)));
  }

  protected accuse(target: number): void {
    this.fail(this.ctx.update<Game, string | null>(g => imposter.accuse(g, target)));
  }

  protected closeVote(): void {
    this.fail(this.ctx.update<Game, string | null>(g => imposter.closeVote(g)));
  }

  protected judge(right: boolean): void {
    this.fail(this.ctx.update<Game, string | null>(g => imposter.judgeGuess(g, right)));
  }

  private fail(error: string | null | undefined): void {
    if (error) this.ctx.notify(error);
  }
}
