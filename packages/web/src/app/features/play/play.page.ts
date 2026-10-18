import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { WakeLockService } from '../../core/ui/wake-lock.service';
import { LazyComponent } from '../../shared/ui/lazy.component';
import { TableSheet } from '../table/table.sheet';
import { EndScreenComponent } from './end-screen.component';
import { PlayContext } from './play-context';

/** Seite eines Spiels: zeigt das Spielblatt der jeweiligen Art oder, nach dem Ende, das Ergebnis. */
@Component({
  selector: 'sb-play-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LazyComponent, EndScreenComponent],
  template: `
    @if (ctx.game(); as g) {
      @if (g.status === 'finished' && !ctx.review()) {
        <sb-end-screen />
      } @else {
        <sb-lazy [loader]="ctx.ui()!.board" />
      }
    }
  `,
})
export class PlayPage implements OnDestroy {
  /** Aus der Adresse: /spiel/:id */
  readonly id = input.required<string>();

  protected readonly ctx = inject(PlayContext);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly wake = inject(WakeLockService);
  private readonly sheets = inject(SheetService);

  constructor() {
    this.wake.inGame.set(true);

    effect(() => {
      const id = this.id();
      untracked(() => this.ctx.open(id));
    });

    // Spiel gelöscht oder gibt es nicht (mehr): zurück zum Hauptmenü
    effect(() => {
      const g = this.store.game(this.id());
      if (!g || g.del || !this.ctx.engine()) void this.router.navigate(['/spiele'], { replaceUrl: true });
    });

    // Nach dem Beitritt zu einem Live-Tisch gleich die Platzwahl zeigen
    const navState = this.router.currentNavigation()?.extras.state as { openTable?: boolean } | undefined;
    if (navState?.openTable) setTimeout(() => this.sheets.open(TableSheet));
  }

  /** Beim Verlassen: leere Spiele verwerfen, vom beendeten den Rückgängig-Verlauf abräumen. */
  ngOnDestroy(): void {
    this.wake.inGame.set(false);
    this.sheets.close();
    const id = this.id();
    const g = this.store.game(id);
    const engine = this.ctx.engine();
    if (!g || g.del || !engine) return;
    if (g.status === 'finished') {
      if (g.undo?.length) this.store.updateGame(id, d => void (d.undo = []));
    } else if (!g.tbl && engine.isEmpty(g)) this.store.updateGame(id, d => void (d.del = true));
  }
}
