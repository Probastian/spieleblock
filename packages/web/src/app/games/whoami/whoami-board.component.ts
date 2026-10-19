import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { engineOf, pluralize, whoami } from '@spieleblock/games';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { mineIndex } from '../party/seat';
import { PartyStandings } from '../party/standings.component';

type Game = whoami.WhoamiGame;

/** Das Blatt für „Wer bin ich?“: am Tisch mit Figuren, oder als Stirnraten mit Zeitlimit. */
@Component({
  selector: 'sb-whoami-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameTopbarComponent, AvatarComponent, PartyStandings],
  template: `
    @let g = game();
    <sb-game-topbar [title]="forehead() ? 'Stirnraten' : 'Wer bin ich?'" [subtitle]="subtitle()" />
    <main class="wrap main" [class.has-dock2]="!!dock()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (allPlayed()) {
        <div class="notice"><span>{{ forehead() ? 'Alle Züge sind gespielt.' : 'Alle ' + g.rules.rounds + ' Runden sind gespielt.' }}</span><button class="btn sm" type="button" (click)="ctx.finish()">Auswerten</button></div>
      }

      @if (!forehead()) {
        <!-- ===== Am Tisch ===== -->
        @let f = g.figure;
        @if (!f) {
          <section class="pt-now alt">
            <div class="pt-k"><b>Bereit?</b></div>
            <p class="pt-deal">Jeder bekommt eine Figur, die er nicht sehen darf. Die anderen sehen sie. Findet per Ja/Nein-Fragen heraus, wer ihr seid.{{ g.tbl ? '' : ' Tipp: Am Live-Tisch zeigt dein Handy alle Figuren außer deiner.' }}</p>
          </section>
        } @else {
          <section class="pt-now alt">
            <div class="pt-k"><b>{{ f.over ? 'Aufgelöst' : 'Wer bist du?' }}</b><span>Runde {{ f.n }}</span></div>
            @if (!f.over) {
              <p class="pt-deal">Reihum eine Frage, die mit „Ja“ oder „Nein“ beantwortet wird. Wer „Ja“ hört, fragt weiter. Wer es weiß, tippt auf „Ich weiß es!“.</p>
            }
            <div class="pt-rows">
              @for (i of seats(); track i) {
                @let p = g.players[i]!;
                @let place = f.solved.indexOf(i);
                <div class="pt-row pt-stack" [class.me]="i === me()" [class.done]="place >= 0" [style.--pc]="'var(--p' + p.color + ')'">
                  <span [sbAvatar]="p"></span>
                  <span class="pt-rn">
                    <b>{{ p.name }}@if (i === me()) { <em class="me">du</em> }</b>
                    @if (figureVisible(i)) {
                      <span class="pt-fig">{{ f.figures[i] }}</span>
                    } @else if (i === me()) {
                      <small>Deine Figur ist geheim</small>
                    } @else {
                      <small>Figur verdeckt</small>
                    }
                  </span>
                  <span class="pt-ra">
                    @if (place >= 0) {
                      <span class="pt-tag ok">{{ place + 1 }}. fertig</span>
                      @if (!f.over && acts(i)) {
                        <button class="link" type="button" (click)="unsolve(i)">Doch nicht</button>
                      }
                    } @else if (f.over) {
                      <span class="pt-tag wait">nicht erraten</span>
                    } @else {
                      @if (local() && i !== me()) {
                        <button class="btn sm" type="button" [attr.aria-pressed]="peeking().has(i)" (click)="togglePeek(i)">{{ peeking().has(i) ? 'Verdecken' : 'Figur zeigen' }}</button>
                      }
                      @if (acts(i)) {
                        <button class="btn sm" type="button" (click)="solve(i)">Ich weiß es!</button>
                      }
                    }
                  </span>
                </div>
              }
            </div>
            @if (local() && !f.over) {
              <p class="pt-deal">Mit einem Handy: „Figur zeigen“ nur, wenn der Besitzer wegschaut.</p>
            }
          </section>
        }
      } @else {
        <!-- ===== Stirnraten ===== -->
        @let t = g.hu;
        @if (countdown() !== null) {
          <section class="pt-now alt" aria-live="assertive">
            <div class="pt-k" [style.--pc]="'var(--p' + g.players[g.turn]!.color + ')'"><span [sbAvatar]="g.players[g.turn]!"></span><b>{{ g.players[g.turn]!.name }}</b><span>Handy an die Stirn!</span></div>
            <div class="fh-count pt-pop">{{ countdown() }}</div>
          </section>
        } @else if (!t) {
          <section class="pt-now alt">
            <div class="pt-k" [style.--pc]="'var(--p' + g.players[g.turn]!.color + ')'"><span [sbAvatar]="g.players[g.turn]!"></span><b>{{ g.players[g.turn]!.name }}</b><span>ist dran</span></div>
            <p class="pt-deal">{{ g.rules.seconds }} Sekunden. Halte das Handy so an die Stirn, dass die anderen den Begriff lesen können, du aber nicht. Nach unten neigen heißt „richtig“, nach oben „weiter“.</p>
            <div class="pt-ctrls">
              <button class="btn" type="button" [attr.aria-pressed]="tilt()" (click)="toggleTilt()">{{ tilt() ? 'Neigen: an' : 'Neigen einschalten' }}</button>
              @if (tiltError()) {
                <span class="pt-err">{{ tiltError() }}</span>
              }
            </div>
          </section>
        } @else if (t.phase === 'run') {
          <section class="pt-now alt" aria-live="polite">
            <div class="fh-time" [class.low]="remaining() <= 10"><span>{{ remaining() }}<small> s</small></span><span><small>{{ g.players[g.turn]!.name }}:</small> {{ turnScore() }}</span></div>
            <div class="pt-bar"><i [style.width.%]="timePercent()"></i></div>
            <div class="fh-word" [class.ok]="flash() === 'ok'" [class.skip]="flash() === 'skip'">{{ t.words.length ? t.words[0] : '…' }}</div>
            @if (acting()) {
              <div class="fh-btns">
                <button class="btn" type="button" (click)="mark(false)">Weiter</button>
                <button class="btn primary" type="button" (click)="mark(true)">Richtig!</button>
              </div>
              <div class="pt-ctrls">
                <button class="link" type="button" [disabled]="!t.done.length" (click)="unmark()">Letzte Wertung zurück</button>
                <button class="link" type="button" (click)="stop()">Zug beenden</button>
              </div>
            }
          </section>
        } @else {
          <section class="pt-now good">
            <div class="pt-k"><b>{{ g.players[g.turn]!.name }}: {{ pluralize(turnScore(), 'Punkt', 'Punkte') }}</b></div>
            @if (t.done.length) {
              <div class="fh-done">
                @for (d of t.done; track $index) {
                  <div><span [class]="d.ok ? 'y' : 'n'">{{ d.ok ? '✓' : '✗' }}</span>{{ d.w }}</div>
                }
              </div>
            } @else {
              <p class="pt-deal">Kein Begriff gespielt.</p>
            }
          </section>
        }
      }

      <sb-pt-standings [rows]="rows()" [me]="me()" [lead]="g.history.length > 0" />
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
export class WhoamiBoard {
  protected readonly ctx = inject(PlayContext);
  protected readonly pluralize = pluralize;

  protected readonly game = this.ctx.typed<Game>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly forehead = computed(() => this.game().rules.mode === 'forehead');
  protected readonly me = computed(() => mineIndex(this.game()));
  protected readonly local = computed(() => this.me() === null);
  protected readonly allPlayed = computed(() => !this.finished() && whoami.allPlayed(this.game()));
  protected readonly rows = computed(() => engineOf('whoami')!.result(this.game()));
  protected readonly seats = computed(() => this.game().players.map((_, i) => i));

  protected readonly peeking = signal<ReadonlySet<number>>(new Set());

  // Stirnraten
  protected readonly now = signal(Date.now());
  protected readonly countdown = signal<number | null>(null);
  protected readonly flash = signal<'ok' | 'skip' | null>(null);
  protected readonly tilt = signal(false);
  protected readonly tiltError = signal('');

  /** Nur der Spieler am Zug (oder ein Gerät ohne Platz) wertet. */
  protected readonly acting = computed(() => {
    const m = this.me();
    return m === null || m === this.game().turn;
  });

  protected readonly remaining = computed(() => {
    const t = this.game().hu;
    return t?.phase === 'run' ? Math.max(0, Math.ceil((t.endsAt - this.now()) / 1000)) : 0;
  });
  protected readonly timePercent = computed(() => {
    const g = this.game();
    return g.hu ? Math.max(0, Math.min(100, ((g.hu.endsAt - this.now()) / (g.rules.seconds * 1000)) * 100)) : 0;
  });
  protected readonly turnScore = computed(() => whoami.turnScore(this.game().hu));

  protected readonly subtitle = computed(() => {
    const g = this.game();
    return engineOf('whoami')!.progress(g) + (g.rules.mode === 'forehead' ? ` · ${g.rules.seconds} s` : '');
  });

  protected readonly dock = computed(() => {
    const g = this.game();
    if (this.finished()) return null;
    if (g.rules.mode === 'table') {
      const f = g.figure;
      if (!f) return { label: 'Runde 1 starten', act: 'start', off: false };
      if (!f.over) return { label: 'Runde beenden', act: 'end', off: false };
      return this.allPlayed() ? { label: 'Spiel auswerten', act: 'finish', off: false } : { label: `Runde ${f.n + 1} starten`, act: 'start', off: false };
    }
    if (this.countdown() !== null) return null;
    if (!g.hu) return g.huDone >= g.players.length * g.rules.rounds ? { label: 'Spiel auswerten', act: 'finish', off: false } : { label: `Los, ${g.players[g.turn]!.name}!`, act: 'go', off: !this.acting() };
    if (g.hu.phase === 'over') {
      const last = g.huDone + 1 >= g.players.length * g.rules.rounds;
      return { label: last ? 'Zug abschließen' : `Weiter: ${g.players[(g.turn + 1) % g.players.length]!.name}`, act: 'next', off: !this.acting() };
    }
    return null;
  });

  private countdownTimer: ReturnType<typeof setTimeout> | undefined;
  private armed = false;

  constructor() {
    const destroy = inject(DestroyRef);
    // Uhr für den laufenden Zug
    const clock = setInterval(() => {
      if (this.game().hu?.phase === 'run') this.now.set(Date.now());
    }, 200);
    destroy.onDestroy(() => {
      clearInterval(clock);
      clearTimeout(this.countdownTimer);
      this.stopTilt();
    });

    // Zeit abgelaufen: der Spieler am Zug beendet den Zug
    effect(() => {
      const t = this.game().hu;
      if (t?.phase === 'run' && this.now() >= t.endsAt && this.acting()) untracked(() => this.ctx.update<Game>(g => void whoami.tick(g, Date.now())));
    });

    // Neigen nur während des eigenen Zugs auswerten
    effect(() => {
      const on = this.tilt() && this.game().hu?.phase === 'run' && this.acting();
      untracked(() => (on ? this.startTilt() : this.stopTilt()));
    });
  }

  protected figureVisible(i: number): boolean {
    const g = this.game();
    const f = g.figure;
    if (!f) return false;
    if (f.over || f.solved.includes(i)) return true;
    if (this.me() !== null) return i !== this.me();
    return this.peeking().has(i);
  }

  protected acts(i: number): boolean {
    const m = this.me();
    return m === null || m === i;
  }

  protected togglePeek(i: number): void {
    const next = new Set(this.peeking());
    if (!next.delete(i)) next.add(i);
    this.peeking.set(next);
  }

  protected run(act: string): void {
    if (act === 'start') {
      this.peeking.set(new Set());
      this.fail(this.ctx.update<Game, string | null>(g => whoami.startRound(g)));
    } else if (act === 'end') this.ctx.update<Game>(g => void whoami.endRound(g));
    else if (act === 'finish') this.ctx.finish();
    else if (act === 'go') this.go();
    else if (act === 'next') this.fail(this.ctx.update<Game, string | null>(g => whoami.nextTurn(g)));
  }

  protected solve(i: number): void {
    this.ctx.update<Game>(g => void whoami.solve(g, i));
  }

  protected unsolve(i: number): void {
    this.ctx.update<Game>(g => void whoami.unsolve(g, i));
  }

  // ------------------------------------------------------------- Stirnraten
  private go(): void {
    this.countdown.set(3);
    const step = () => {
      const n = this.countdown();
      if (n === null) return;
      if (n <= 1) {
        this.countdown.set(null);
        this.now.set(Date.now());
        this.armed = false;
        this.fail(this.ctx.update<Game, string | null>(g => whoami.startTurn(g, Date.now())));
        return;
      }
      this.countdown.set(n - 1);
      this.countdownTimer = setTimeout(step, 1000);
    };
    this.countdownTimer = setTimeout(step, 1000);
  }

  protected mark(ok: boolean): void {
    const error = this.ctx.update<Game, string | null>(g => whoami.mark(g, ok, Date.now()));
    if (error) return this.fail(error);
    this.flash.set(ok ? 'ok' : 'skip');
    try {
      navigator.vibrate?.(ok ? 40 : 15);
    } catch {
      /* kein Vibrationsmotor */
    }
    setTimeout(() => this.flash.set(null), 450);
  }

  protected unmark(): void {
    this.ctx.update<Game>(g => void whoami.unmark(g));
  }

  protected stop(): void {
    this.ctx.update<Game>(g => void whoami.stopTurn(g));
  }

  // ------------------------------------------------------------- Neigen
  protected async toggleTilt(): Promise<void> {
    this.tiltError.set('');
    if (this.tilt()) return this.tilt.set(false);
    const D = (globalThis as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!D) return void this.tiltError.set('Dieses Gerät meldet keine Neigung.');
    try {
      if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') {
        return void this.tiltError.set('Der Zugriff auf die Neigung wurde abgelehnt.');
      }
    } catch {
      return void this.tiltError.set('Der Zugriff auf die Neigung ist nicht möglich.');
    }
    this.tilt.set(true);
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta == null || e.gamma == null) return;
    // Senkrechte Komponente der Display-Normalen: +1 Display zeigt nach oben, −1 nach unten, 0 aufrecht
    const z = Math.cos((e.beta * Math.PI) / 180) * Math.cos((e.gamma * Math.PI) / 180);
    if (Math.abs(z) < 0.25) this.armed = true;
    else if (this.armed && z < -0.6) {
      this.armed = false;
      this.mark(true);
    } else if (this.armed && z > 0.6) {
      this.armed = false;
      this.mark(false);
    }
  };
  private listening = false;

  private startTilt(): void {
    if (this.listening) return;
    this.listening = true;
    this.armed = false;
    window.addEventListener('deviceorientation', this.onOrientation);
  }

  private stopTilt(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener('deviceorientation', this.onOrientation);
  }

  private fail(error: string | null | undefined): void {
    if (error) this.ctx.notify(error);
  }
}
