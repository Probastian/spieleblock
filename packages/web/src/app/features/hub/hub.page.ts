import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppInfo } from '../../core/api/app-info.service';
import { SyncService } from '../../core/state/sync.service';
import { SheetService } from '../../core/ui/sheet.service';
import { formatToday } from '../../core/util/format';
import { IconComponent, type IconName } from '../../shared/ui/icon.component';
import { GamesTab } from './games.tab';
import { HistoryTab } from './history.tab';
import { PlayersTab } from './players.tab';
import { StorageSheet } from './storage.sheet';
import { UpdateSheet } from './update.sheet';

const VERSION_TAPS = 5;
const VERSION_TAP_WINDOW_MS = 2500;

export type HubTab = 'spiele' | 'spieler' | 'verlauf';

/** Hauptmenü mit den Reitern Spiele, Spieler und Verlauf. Der Reiter steht in der Adresse. */
@Component({
  selector: 'sb-hub-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, GamesTab, PlayersTab, HistoryTab],
  template: `
    <main class="wrap hub">
      <header class="hub-head">
        <div>
          <div class="eyebrow">{{ today }}</div>
          <h1>Spieleblock</h1>
        </div>
        <button class="syncchip" [class]="'syncchip s-' + sync.state()" type="button" (click)="sheets.open(storageSheet)" aria-label="Speicher und Backup">
          <i class="sdot"></i><span>{{ sync.label() }}</span>
        </button>
      </header>
      @switch (tab()) {
        @case ('spiele') { <sb-games-tab /> }
        @case ('spieler') { <sb-players-tab /> }
        @case ('verlauf') { <sb-history-tab /> }
      }
      @if (info.version(); as v) {
        <footer class="hub-version" (click)="tapVersion()">Spieleblock {{ v }}</footer>
      }
    </main>
    <nav class="tabbar" aria-label="Hauptmenü">
      <div class="wrap">
        @for (t of tabs; track t.key) {
          <a class="tab" [routerLink]="['/', t.key]" [attr.aria-current]="tab() === t.key ? 'page' : null"><svg sb-icon [name]="t.icon"></svg><span>{{ t.label }}</span></a>
        }
      </div>
    </nav>
  `,
})
export class HubPage {
  /** Aus den Routendaten. */
  readonly tab = input<HubTab>('spiele');

  protected readonly info = inject(AppInfo);
  protected readonly sync = inject(SyncService);
  protected readonly sheets = inject(SheetService);
  protected readonly storageSheet = StorageSheet;
  protected readonly today = formatToday();

  /** Verstecktes Wartungsmenü: fünfmal schnell auf die Version tippen. */
  private taps: number[] = [];
  protected tapVersion(): void {
    const now = Date.now();
    this.taps = [...this.taps.filter(t => now - t < VERSION_TAP_WINDOW_MS), now];
    if (this.taps.length < VERSION_TAPS) return;
    this.taps = [];
    this.sheets.open(UpdateSheet);
  }

  constructor() {
    void this.info.load();
  }

  protected readonly tabs: { key: HubTab; label: string; icon: IconName }[] = [
    { key: 'spiele', label: 'Spiele', icon: 'tabGames' },
    { key: 'spieler', label: 'Spieler', icon: 'tabPeople' },
    { key: 'verlauf', label: 'Verlauf', icon: 'tabHist' },
  ];
}
