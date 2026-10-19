import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { engineOf, type BaseGame } from '@spieleblock/games';
import { normalizeTableCode } from '@spieleblock/shared';
import { Store } from '../../core/state/store.service';
import { SyncService } from '../../core/state/sync.service';
import { TableService } from '../../core/table/table.service';
import { timeAgo } from '../../core/util/format';
import { GAME_UIS } from '../../games/registry';
import { inputValue } from '../../shared/dom';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { GameTileComponent } from '../../shared/ui/game-tile.component';
import { IconComponent } from '../../shared/ui/icon.component';

const LS_EXPERIMENTAL = 'sb.experimental';

function readOpen(): boolean {
  try {
    return localStorage.getItem(LS_EXPERIMENTAL) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'sb-games-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [NgTemplateOutlet, RouterLink, AvatarComponent, GameTileComponent, IconComponent],
  template: `
    @if (loading()) {
      <div class="blank"><b>Lade deine Daten …</b>Spieler und Spiele werden vom Server geholt.</div>
    }

    @if (running().length) {
      <section class="sec">
        <h2 class="lbl">Läuft gerade <span class="count">{{ running().length }}</span></h2>
        <div class="stack">
          @for (r of running(); track r.game.id) {
            <a class="run" [routerLink]="['/spiel', r.game.id]">
              <span class="avs">
                @for (p of r.game.players.slice(0, 4); track $index) {
                  <span [sbAvatar]="p" small></span>
                }
              </span>
              <span class="run-t">
                <b>{{ r.label }} · {{ r.progress }}@if (r.game.tbl) { <span class="livetag">Live</span> }</b>
                <span>{{ r.leaders }}</span>
                <small>Zuletzt {{ r.ago }}</small>
              </span>
              <span class="pill">Weiter</span>
            </a>
          }
        </div>
      </section>
    }

    @if (sync.connected()) {
      <section class="sec">
        <h2 class="lbl">Live-Tisch beitreten</h2>
        <form class="addrow" autocomplete="off" (submit)="join($event)">
          <input class="pin code" type="text" placeholder="Code, z. B. K7P4X" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Code des Live-Tischs"
            [value]="code()" (input)="code.set(normalize(inputValue($event)))" />
          <button class="btn primary" type="submit">Beitreten</button>
        </form>
      </section>
    }

    <section class="sec">
      <h2 class="lbl">Neues Spiel</h2>
      <div class="stack">
        @for (ui of mainUis; track ui.id) {
          <ng-container *ngTemplateOutlet="card; context: { $implicit: ui }" />
        }
      </div>
    </section>

    @if (experimentalUis.length) {
      <section class="sec">
        <button class="xp-toggle" type="button" [attr.aria-expanded]="experimentalOpen()" aria-controls="xp-list" (click)="toggleExperimental()">
          <span class="lbl">Experimental <span class="count">{{ experimentalUis.length }}</span></span>
          <span class="xp-hint">{{ experimentalOpen() ? 'Einklappen' : 'Neue Spiele zum Ausprobieren' }}</span>
          <svg sb-icon [name]="experimentalOpen() ? 'chevU' : 'chevD'" [size]="20"></svg>
        </button>
        @if (experimentalOpen()) {
          <div class="stack" id="xp-list">
            @for (ui of experimentalUis; track ui.id) {
              <ng-container *ngTemplateOutlet="card; context: { $implicit: ui }" />
            }
          </div>
        }
      </section>
    }

    <ng-template #card let-ui>
      <a class="gcard" [routerLink]="['/neu', ui.id]">
        <span [sbGameTile]="ui"></span>
        <span>
          <span class="gname">{{ ui.name }}</span>
          <span class="gblurb">{{ ui.blurb }}</span>
          <span class="gtags">@for (t of ui.tags; track t) { <span>{{ t }}</span> }</span>
        </span>
        <span class="chev"><svg sb-icon name="chevR"></svg></span>
      </a>
    </ng-template>
  `,
})
export class GamesTab {
  private readonly store = inject(Store);
  private readonly table = inject(TableService);
  private readonly router = inject(Router);
  protected readonly sync = inject(SyncService);

  protected readonly mainUis = GAME_UIS.filter(ui => !ui.experimental);
  protected readonly experimentalUis = GAME_UIS.filter(ui => ui.experimental);
  /** Aufgeklappt bleibt pro Gerät erhalten. */
  protected readonly experimentalOpen = signal(readOpen());
  protected readonly code = signal('');
  protected readonly inputValue = inputValue;
  protected readonly normalize = normalizeTableCode;

  protected readonly loading = computed(() => !this.sync.ready() && !this.store.players().length && !this.store.allGames().length);

  protected readonly running = computed(() =>
    this.store.activeGames().map((game: BaseGame) => {
      const engine = engineOf(game.type)!;
      return {
        game,
        label: engine.label(game),
        progress: engine.progress(game),
        leaders: engine.result(game).slice(0, 3).map(r => `${r.name} ${r.total}`).join(' · '),
        ago: timeAgo(game.u),
      };
    }),
  );

  protected toggleExperimental(): void {
    const open = !this.experimentalOpen();
    this.experimentalOpen.set(open);
    try {
      localStorage.setItem(LS_EXPERIMENTAL, open ? '1' : '0');
    } catch {
      /* ohne Speicher bleibt es bei dieser Sitzung */
    }
  }

  protected async join(e: Event): Promise<void> {
    e.preventDefault();
    const id = await this.table.join(this.code());
    if (id) {
      this.code.set('');
      await this.router.navigate(['/spiel', id], { state: { openTable: true } });
    }
  }
}
