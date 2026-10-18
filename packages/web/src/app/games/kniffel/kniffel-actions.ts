import { Injectable, inject, signal } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { PlayContext } from '../../features/play/play-context';
import { scrollToTop } from '../../shared/dom';

type Game = kniffel.KniffelGame;
const AUTO_SWITCH_MS = 1100;
const TUMBLE_MS = 900;

/** Alles, was ein Kniffel-Spieler am Blatt tun kann. Blatt und Sheets rufen diese Methoden auf. */
@Injectable({ providedIn: 'root' })
export class KniffelActions {
  private readonly ctx = inject(PlayContext);
  private readonly store = inject(Store);
  private readonly sheets = inject(SheetService);

  /** Plätze der Würfelablage, die gerade neu gewürfelt wurden (für die Animation), in Wurfreihenfolge. */
  readonly rolled = signal<number[]>([]);
  private rolledTimer: ReturnType<typeof setTimeout> | undefined;

  commit(pi: number, fieldId: string, value: number | null, opts: kniffel.CommitOptions): void {
    const epoch = this.ctx.epoch();
    const outcome = this.ctx.update<Game, kniffel.CommitOutcome>(g => kniffel.commit(g, pi, fieldId, value, opts));
    this.sheets.close();
    if (!outcome) return;
    if (outcome.allFilled) {
      this.ctx.finish();
      this.ctx.notify(outcome.message, true);
      return;
    }
    this.ctx.highlight(fieldId);
    this.ctx.notify(outcome.message, true);
    if (outcome.advancedTo !== null) this.followTurn(pi, epoch);
  }

  /** Nach dem Eintragen kurz warten und dann das Blatt des nächsten Spielers zeigen – wenn der Nutzer nichts anderes tut. */
  private followTurn(from: number, epoch: number): void {
    const id = this.ctx.gameId();
    setTimeout(() => {
      const g = this.ctx.game() as Game | undefined;
      if (!g || g.id !== id || this.ctx.epoch() !== epoch || g.status === 'finished' || g.view !== from) return;
      if ((g.tbl && g.tblSeat != null) || this.sheets.active()) return;
      this.ctx.update<Game>(d => void (d.view = d.turn));
      scrollToTop(true);
    }, AUTO_SWITCH_MS);
  }

  show(playerIndex: number): void {
    this.ctx.interrupt();
    this.ctx.update<Game>(g => void (g.view = playerIndex));
  }

  showTurn(): void {
    this.ctx.interrupt();
    this.ctx.update<Game>(g => void (g.view = g.turn));
    scrollToTop(true);
  }

  roll(): void {
    const rolled = this.ctx.update<Game, number[]>(g => kniffel.roll(g));
    if (!rolled?.length) return;
    this.rolled.set(rolled);
    clearTimeout(this.rolledTimer);
    this.rolledTimer = setTimeout(() => this.rolled.set([]), TUMBLE_MS);
  }

  setDie(face: number): void {
    this.ctx.update<Game>(g => kniffel.setDie(g, face));
  }

  removeDie(index: number): void {
    this.ctx.update<Game>(g => kniffel.removeDie(g, index));
  }

  clearDice(): void {
    this.ctx.update<Game>(g => kniffel.clearDice(g));
  }

  toggleFirstRoll(): void {
    this.ctx.update<Game>(g => void (g.first = !g.first));
  }

  /** Zähler für Extra-Kniffel / erste Hand des gerade gezeigten Spielers. */
  stepCounter(kind: 'xk' | 'fh', delta: number): void {
    const g = this.ctx.game() as Game | undefined;
    if (!g) return;
    const player = g.players[g.view]!;
    const changed = this.ctx.update<Game, number | null>(d => kniffel.stepCounter(d, d.view, kind, delta));
    if (changed == null) return;
    const bonus = kniffel.extraValue(g);
    const text =
      kind === 'xk' ? (delta > 0 ? `Extra-Kniffel +${bonus} für ${player.name}` : 'Extra-Kniffel entfernt') : delta > 0 ? `+5 erste Hand für ${player.name}` : 'Erste Hand entfernt';
    this.ctx.notify(text, true);
  }

  setInput(input: kniffel.KniffelInput): void {
    this.ctx.update<Game>(g => void (g.input = input));
    this.store.setGameOptions<kniffel.KniffelOptions>('kniffel', { input });
  }
}
