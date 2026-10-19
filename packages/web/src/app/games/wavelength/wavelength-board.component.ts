import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { engineOf, wavelength } from '@spieleblock/games';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { inputValue } from '../../shared/dom';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { mineIndex } from '../party/seat';
import { PartyStandings } from '../party/standings.component';
import { DialMarker, WaveDial } from './wave-dial.component';

type Game = wavelength.WavelengthGame;

/** Das Blatt für Wavelength: Hinweis geben, Regler einstellen, aufdecken. */
@Component({
  selector: 'sb-wavelength-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameTopbarComponent, AvatarComponent, PartyStandings, WaveDial],
  template: `
    @let g = game();
    @let c = g.current;
    <sb-game-topbar title="Wavelength" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!!dock()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (allPlayed()) {
        <div class="notice"><span>Alle Durchgänge sind gespielt.</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      }

      @if (!c) {
        <section class="pt-now">
          <div class="pt-k"><b>Bereit?</b></div>
          <p class="pt-deal">Zwischen zwei Gegensätzen liegt ein geheimes Ziel. Einer gibt einen Hinweis, die anderen stellen den Regler ein. {{ g.rules.team ? 'Diesmal berät ihr euch gemeinsam.' : 'Jeder stellt seinen eigenen Regler ein.' }}</p>
        </section>
      } @else {
        <section class="pt-now" [class.alt]="c.phase === 'clue'" [class.good]="c.phase === 'reveal'">
          <div class="pt-k" [style.--pc]="'var(--p' + g.players[c.giver]!.color + ')'">
            <span [sbAvatar]="g.players[c.giver]!"></span>
            <b>{{ g.players[c.giver]!.name }}</b>
            <span>{{ c.phase === 'clue' ? 'gibt den Hinweis' : c.phase === 'guess' ? 'hat den Hinweis gegeben' : 'Auflösung' }}</span>
          </div>

          @if (c.clue && c.phase !== 'clue') {
            <div class="wl-clue">„{{ c.clue }}“</div>
          }

          <sb-wave-dial
            [target]="targetShown() ? c.target : null"
            [markers]="markers()"
            [value]="dialValue()"
            [editable]="editable()"
            (valueChange)="move($event)"
          />
          <div class="wl-poles"><span>{{ c.left }}</span><span>{{ c.right }}</span></div>

          @switch (c.phase) {
            @case ('clue') {
              @if (isGiver()) {
                <p class="pt-deal">Nur du darfst das Ziel sehen. Denk dir einen Hinweis aus, der zeigt, wo zwischen „{{ c.left }}“ und „{{ c.right }}“ das Ziel liegt.</p>
                <div class="pt-ctrls">
                  <button class="btn sm" type="button" [attr.aria-pressed]="seeTarget()" (click)="seeTarget.set(!seeTarget())">{{ seeTarget() ? 'Ziel verbergen' : 'Ziel ansehen' }}</button>
                </div>
                <input class="pin" type="text" maxlength="80" placeholder="Hinweis eintippen (oder laut sagen)" aria-label="Hinweis" [value]="clue()" (input)="clue.set(inputValue($event))" />
              } @else {
                <p class="pt-deal"><b>{{ g.players[c.giver]!.name }}</b> überlegt sich einen Hinweis. Schau nicht auf fremde Handys.</p>
              }
            }
            @case ('guess') {
              @if (g.rules.team) {
                <p class="pt-deal">{{ c.teamLocked ? 'Der Regler ist festgemacht.' : 'Beratet euch und zieht den Regler dorthin, wo ihr das Ziel vermutet.' }}</p>
              } @else if (guesser() === null) {
                <p class="pt-deal">{{ isGiver() ? 'Die anderen stellen ihren Regler ein.' : 'Warte auf die anderen.' }}</p>
              } @else if (!g.tbl || me() === null) {
                <p class="pt-deal"><b>{{ g.players[guesser()!].name }}</b>: Gib dir das Handy, stell deinen Regler ein und mach ihn fest. Die anderen schauen weg.</p>
              } @else {
                <p class="pt-deal">{{ locked() ? 'Festgemacht. Wir warten auf die anderen.' : 'Zieh den Regler dorthin, wo du das Ziel vermutest.' }}</p>
              }
              @if (!g.rules.team) {
                <div class="pt-chips" aria-label="Wer ist fertig?">
                  @for (i of guessers(); track i) {
                    <span class="pt-tag" [class.ok]="c.locked.includes(i)" [class.wait]="!c.locked.includes(i)" [style.--pc]="'var(--p' + g.players[i]!.color + ')'"><i></i>{{ g.players[i]!.name }}</span>
                  }
                </div>
              }
              @if (isGiver() || (c.locked.length || c.teamLocked) && !c.teamLocked) {
                <div><button class="link" type="button" (click)="revealNow()">Ohne Warten aufdecken</button></div>
              }
            }
            @case ('reveal') {
              <div class="pt-rows">
                @for (i of rowOrder(); track i) {
                  <div class="pt-row" [style.--pc]="'var(--p' + g.players[i]!.color + ')'">
                    <span [sbAvatar]="g.players[i]!"></span>
                    <span class="pt-rn">
                      <b>{{ g.players[i]!.name }}</b>
                      <small>{{ rowNote(i) }}</small>
                    </span>
                    <span class="stand-t mono">+{{ c.gain![i] }}</span>
                  </div>
                }
              </div>
            }
          }
        </section>
      }

      <sb-pt-standings [rows]="rows()" [me]="me()" [gain]="gain()" [lead]="g.history.length > 0" />
    </main>

    @if (dock(); as d) {
      <div class="dock" role="region" aria-label="Nächster Schritt">
        <div class="wrap">
          <button class="btn primary big" type="button" [disabled]="d.off" (click)="run(d.act)">{{ d.label }}</button>
        </div>
      </div>
    }
  `,
})
export class WavelengthBoard {
  protected readonly ctx = inject(PlayContext);
  protected readonly inputValue = inputValue;

  protected readonly game = this.ctx.typed<Game>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly allPlayed = computed(() => !this.finished() && wavelength.allPlayed(this.game()));
  protected readonly me = computed(() => mineIndex(this.game()));
  protected readonly rows = computed(() => engineOf('wavelength')!.result(this.game()));
  protected readonly gain = computed(() => (this.game().current?.phase === 'reveal' ? (this.game().current?.gain ?? null) : null));

  protected readonly seeTarget = signal(false);
  protected readonly clue = signal('');

  protected readonly subtitle = computed(() => engineOf('wavelength')!.progress(this.game()));

  /** Gibt dieses Gerät den Hinweis? Lokal und ohne Platz: ja. */
  protected readonly isGiver = computed(() => {
    const c = this.game().current;
    const m = this.me();
    return !!c && (m === null || m === c.giver);
  });

  protected readonly guessers = computed(() => wavelength.guessers(this.game()));

  /** Wer an diesem Gerät gerade den Regler bedient (am Live-Tisch der eigene Platz, lokal der nächste, der noch nicht fertig ist). */
  protected readonly guesser = computed<number | null>(() => {
    const g = this.game();
    const c = g.current;
    if (!c || c.phase !== 'guess' || g.rules.team) return null;
    const m = this.me();
    if (m !== null) return m === c.giver ? null : m;
    return this.guessers().find(i => !c.locked.includes(i)) ?? null;
  });

  protected readonly locked = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!c) return false;
    if (g.rules.team) return c.teamLocked;
    const i = this.guesser();
    return i !== null && c.locked.includes(i);
  });

  protected readonly editable = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!c || c.phase !== 'guess' || this.finished()) return false;
    return g.rules.team ? !c.teamLocked : this.guesser() !== null && !this.locked();
  });

  protected readonly dialValue = computed(() => {
    const g = this.game();
    const c = g.current;
    if (!c) return null;
    if (c.phase === 'clue') return null;
    if (c.phase === 'reveal') return null;
    if (g.rules.team) return c.team ?? 50;
    const i = this.guesser();
    return i === null ? null : (c.guesses[i] ?? 50);
  });

  protected readonly targetShown = computed(() => {
    const c = this.game().current;
    if (!c) return false;
    if (c.phase === 'reveal') return true;
    return c.phase === 'clue' && this.isGiver() && this.seeTarget();
  });

  /** Beim Aufdecken alle Regler; sonst keine (die Wahl der anderen bleibt geheim). */
  protected readonly markers = computed<DialMarker[]>(() => {
    const g = this.game();
    const c = g.current;
    if (!c || c.phase !== 'reveal') return [];
    if (g.rules.team) return c.team === null ? [] : [{ pos: c.team, color: 7, label: '★' }];
    return this.guessers().filter(i => c.guesses[i] !== undefined).map(i => ({ pos: c.guesses[i]!, color: g.players[i]!.color, label: g.players[i]!.name.slice(0, 1).toUpperCase() }));
  });

  protected readonly rowOrder = computed(() => {
    const g = this.game();
    const c = g.current;
    return c ? [c.giver, ...this.guessers()] : [];
  });

  protected readonly dock = computed(() => {
    const g = this.game();
    const c = g.current;
    if (this.finished()) return null;
    if (!c) return { label: 'Runde 1 starten', act: 'start', off: false };
    if (c.phase === 'clue') return { label: 'Hinweis gegeben', act: 'clue', off: !this.isGiver() };
    if (c.phase === 'guess') {
      if (g.rules.team) return { label: c.teamLocked ? 'Wird aufgedeckt …' : 'Festmachen und aufdecken', act: 'lock', off: c.teamLocked };
      const i = this.guesser();
      if (i === null) return { label: this.isGiver() ? 'Die anderen raten …' : 'Warte auf die anderen', act: '', off: true };
      return { label: g.tbl && this.me() !== null ? 'Festmachen' : `Festmachen (${g.players[i]!.name})`, act: 'lock', off: this.locked() };
    }
    return this.allPlayed() ? { label: 'Spiel auswerten', act: 'finish', off: false } : { label: `Runde ${c.n + 1} starten`, act: 'start', off: false };
  });

  constructor() {
    // Neue Runde oder neuer Rater: Ziel wieder verdecken, Hinweisfeld leeren
    effect(() => {
      const key = (this.game().current?.n ?? 0) + ':' + (this.game().current?.phase ?? '');
      void key;
      untracked(() => {
        this.seeTarget.set(false);
        if (this.game().current?.phase === 'clue') this.clue.set('');
      });
    });
  }

  protected rowNote(i: number): string {
    const g = this.game();
    const c = g.current!;
    if (i === c.giver) return g.rules.team ? 'gab den Hinweis' : 'Hinweisgeber, Durchschnitt der anderen';
    if (g.rules.team) return c.team === null ? 'kein Regler' : `Regler bei ${c.team} %, Ziel bei ${c.target} %`;
    const pos = c.guesses[i];
    return pos === undefined ? 'kein Regler' : `${Math.abs(pos - c.target) <= 0 ? 'Volltreffer' : 'daneben um ' + Math.abs(pos - c.target) + ' %'}`;
  }

  protected move(pos: number): void {
    const who = this.game().rules.team ? null : this.guesser();
    this.ctx.update<Game>(g => void wavelength.setGuess(g, who, pos));
  }

  protected run(act: string): void {
    if (act === 'start') this.fail(this.ctx.update<Game, string | null>(g => wavelength.startRound(g)));
    else if (act === 'clue') {
      const text = this.clue();
      this.fail(this.ctx.update<Game, string | null>(g => wavelength.giveClue(g, text)));
    } else if (act === 'lock') {
      const who = this.game().rules.team ? null : this.guesser();
      this.fail(this.ctx.update<Game, string | null>(g => wavelength.lock(g, who)));
    } else if (act === 'finish') this.ctx.finish();
  }

  protected revealNow(): void {
    this.fail(this.ctx.update<Game, string | null>(g => wavelength.reveal(g)));
  }

  private fail(error: string | null | undefined): void {
    if (error) this.ctx.notify(error);
  }
}
