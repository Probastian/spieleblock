import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { engineOf, finishGame, type BaseGame } from '@spieleblock/games';
import { uiOf } from '../../games/registry';
import { Store } from '../../core/state/store.service';
import { TableService } from '../../core/table/table.service';
import { ConfettiService } from '../../core/ui/confetti.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { scrollToTop } from '../../shared/dom';

/**
 * Das gerade geöffnete Spiel und alles, was Spielblätter und ihre Sheets gemeinsam brauchen.
 * Die Spielseite setzt `gameId`; Blätter und Sheets holen sich hier das Spiel und die gemeinsamen Aktionen.
 */
@Injectable({ providedIn: 'root' })
export class PlayContext {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly sheets = inject(SheetService);
  private readonly confetti = inject(ConfettiService);
  private readonly table = inject(TableService);

  readonly gameId = signal('');
  /** Beendetes Spiel wird wie ein laufendes angezeigt (Blätter ansehen) statt als Ergebnis. */
  readonly review = signal(false);
  /** Feld, das kurz aufleuchten soll. `n` zählt hoch, damit dasselbe Feld mehrmals blinken kann. */
  readonly flash = signal<{ id: string; n: number; scroll: boolean } | null>(null);
  /** Zählt hoch, wenn der Nutzer etwas tut, das verzögerte Automatik (z. B. Spielerwechsel) abbrechen soll. */
  readonly epoch = signal(0);

  readonly game = computed(() => this.store.game(this.gameId()));
  readonly engine = computed(() => {
    const g = this.game();
    return g ? engineOf(g.type) : undefined;
  });
  readonly ui = computed(() => {
    const g = this.game();
    return g ? uiOf(g.type) : undefined;
  });

  /** Das Spiel in der Form seiner Spielart. Nur verwenden, wo die Art feststeht (im eigenen Blatt). */
  typed<T extends BaseGame>(): Signal<T> {
    return computed(() => this.game() as T);
  }

  open(id: string): void {
    if (this.gameId() === id) return;
    this.gameId.set(id);
    this.review.set(false);
    this.flash.set(null);
    this.interrupt();
  }

  update<T extends BaseGame, R = void>(fn: (draft: T) => R): R | undefined {
    return this.store.updateGame<T, R>(this.gameId(), fn);
  }

  notify(message: string, undoable = false): void {
    this.toasts.show(message, undoable ? () => this.undo() : undefined);
  }

  highlight(fieldId: string, scroll = false): void {
    this.flash.set({ id: fieldId, n: (this.flash()?.n ?? 0) + 1, scroll });
  }

  interrupt(): void {
    this.epoch.update(n => n + 1);
  }

  undo(): void {
    this.toasts.dismiss();
    this.interrupt();
    const engine = this.engine();
    if (!engine) return;
    const outcome = this.update<BaseGame, ReturnType<typeof engine.undo>>(g => engine.undo(g));
    if (!outcome) {
      this.toasts.show('Nichts zum Rückgängigmachen');
      return;
    }
    this.review.set(false);
    this.sheets.close();
    if (outcome.fieldId) this.highlight(outcome.fieldId, true);
    this.toasts.show('Rückgängig gemacht');
  }

  /** Spiel auswerten: Rangliste, Rekord, Konfetti. */
  finish(): void {
    this.sheets.close();
    this.update(g => finishGame(g, this.store.finishedGames(), engineOf));
    this.review.set(false);
    this.confetti.fire();
    scrollToTop();
  }

  showResult(): void {
    this.sheets.close();
    this.review.set(false);
    scrollToTop();
  }

  async rematch(): Promise<void> {
    const old = this.game();
    const engine = this.engine();
    if (!old || !engine) return;
    const next = engine.rematch(old, p => this.store.currentName(p));
    if (old.tbl) this.table.handOver(old.id, next);
    this.store.updateGame(old.id, g => void (g.undo = []));
    this.store.addGame(next);
    this.toasts.show(`Revanche! ${next.players[0]!.name} beginnt`);
    await this.router.navigate(['/spiel', next.id]);
  }

  home(): void {
    this.sheets.close();
    void this.router.navigate(['/spiele']);
  }
}
