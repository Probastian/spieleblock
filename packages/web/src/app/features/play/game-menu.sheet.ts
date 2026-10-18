import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SyncService } from '../../core/state/sync.service';
import { Store } from '../../core/state/store.service';
import { TableService } from '../../core/table/table.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { WakeLockService } from '../../core/ui/wake-lock.service';
import { doubleTap } from '../../core/util/double-tap';
import { LazyComponent } from '../../shared/ui/lazy.component';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { TableSheet } from '../table/table.sheet';
import { PlayContext } from './play-context';

/** Das Spielmenü, in allen Spielen gleich. Spiele ergänzen eigene Einträge über `GameUi.menuExtras`. */
@Component({
  selector: 'sb-game-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, LazyComponent],
  template: `
    <sb-sheet-head [eyebrow]="label()" title="Menü" />
    <div class="menu">
      <button class="mi" type="button" [disabled]="!undoText()" (click)="ctx.undo()">
        <span><span class="mi-t">Rückgängig</span><span class="mi-s">{{ undoText() ?? 'Noch nichts eingetragen' }}</span></span>
      </button>

      @if (ctx.ui()?.menuExtras; as extras) {
        <sb-lazy [loader]="extras" />
      }

      <div class="mi">
        <span><span class="mi-t">Bildschirm wach halten</span><span class="mi-s">Das Display bleibt während des Spiels an</span></span>
        <button class="switch" type="button" role="switch" [attr.aria-checked]="wakeOn()" aria-label="Bildschirm wach halten" (click)="wake.toggle()"><i></i></button>
      </div>

      @if (finished()) {
        <button class="mi" type="button" (click)="ctx.showResult()">
          <span><span class="mi-t">Ergebnis anzeigen</span><span class="mi-s">Rangliste des Spiels</span></span>
        </button>
      } @else {
        <button class="mi" type="button" [class.confirm]="finishTap.armed()" (click)="finish()">
          <span><span class="mi-t">Jetzt auswerten</span><span class="mi-s">{{ finishTap.armed() ? warning() : 'Spiel beenden und Rangliste zeigen' }}</span></span>
        </button>
      }

      @if (sync.connected()) {
        <button class="mi" type="button" (click)="sheets.open(tableSheet)">
          <span>
            <span class="mi-t">{{ ctx.game()?.tbl ? 'Live-Tisch ' + ctx.game()!.tbl : 'Live-Tisch' }}</span>
            <span class="mi-s">{{ ctx.game()?.tbl ? 'Code, Plätze und Verlassen' : 'Mit anderen auf eigenen Handys mitspielen' }}</span>
          </span>
        </button>
      }

      <button class="mi danger" type="button" [class.confirm]="deleteTap.armed()" (click)="remove()">
        <span><span class="mi-t">Spiel löschen</span><span class="mi-s">{{ deleteTap.armed() ? 'Nochmal tippen zum Löschen' : 'Verschwindet aus Hauptmenü und Verlauf' }}</span></span>
      </button>
    </div>
  `,
})
export class GameMenuSheet {
  protected readonly ctx = inject(PlayContext);
  protected readonly sync = inject(SyncService);
  protected readonly sheets = inject(SheetService);
  protected readonly wake = inject(WakeLockService);
  private readonly store = inject(Store);
  private readonly table = inject(TableService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly tableSheet = TableSheet;
  protected readonly finishTap = doubleTap();
  protected readonly deleteTap = doubleTap();

  protected readonly label = computed(() => {
    const g = this.ctx.game();
    return g ? (this.ctx.engine()?.label(g) ?? '') : '';
  });
  protected readonly undoText = computed(() => {
    const g = this.ctx.game();
    return g ? (this.ctx.engine()?.describeUndo(g) ?? null) : null;
  });
  protected readonly finished = computed(() => this.ctx.game()?.status === 'finished');
  protected readonly wakeOn = computed(() => this.store.meta().settings.wake);
  protected readonly warning = computed(() => {
    const g = this.ctx.game();
    return g ? (this.ctx.engine()?.finishWarning(g) ?? '') : '';
  });

  protected finish(): void {
    const g = this.ctx.game();
    const engine = this.ctx.engine();
    if (!g || !engine) return;
    const blocked = engine.cannotFinish(g);
    if (blocked) return this.toast.show(blocked);
    if (engine.finishWarning(g) && !this.finishTap.tap()) return;
    this.ctx.finish();
  }

  protected remove(): void {
    const g = this.ctx.game();
    if (!g || !this.deleteTap.tap()) return;
    if (g.tbl) void this.table.end(g.id);
    this.store.updateGame(g.id, d => void (d.del = true));
    this.toast.show('Spiel gelöscht');
    this.sheets.close();
    void this.router.navigate(['/spiele']);
  }
}
