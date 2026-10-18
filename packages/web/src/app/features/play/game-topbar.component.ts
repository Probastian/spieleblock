import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { shortName } from '../../core/util/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PlayContext } from './play-context';
import { GameMenuSheet } from './game-menu.sheet';
import { SheetService } from '../../core/ui/sheet.service';
import { TableSheet } from '../table/table.sheet';

/** Kopfleiste jedes Spielblatts: zurück, Titel, eigene Knöpfe, Live-Tisch-Anzeige, Menü. Darunter (Standard-Slot) z. B. die Spielerleiste. */
@Component({
  selector: 'sb-game-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header class="top">
      <div class="wrap topbar">
        <button class="iconbtn" type="button" (click)="ctx.home()" aria-label="Zum Hauptmenü"><svg sb-icon name="chevL"></svg></button>
        <div class="brand">
          <div class="t">{{ title() }}</div>
          <div class="sub"><ng-content select="[subtitle]" />{{ subtitle() }}</div>
        </div>
        <ng-content select="[actions]" />
        @if (tableLabel(); as label) {
          <button class="livepill" type="button" (click)="sheets.open(tableSheet)" [attr.aria-label]="'Live-Tisch ' + ctx.game()!.tbl"><i></i><span>{{ label }}</span></button>
        }
        <button class="iconbtn" type="button" (click)="sheets.open(menuSheet)" aria-label="Menü"><svg sb-icon name="dots"></svg></button>
      </div>
      <ng-content />
    </header>
  `,
})
export class GameTopbarComponent {
  protected readonly ctx = inject(PlayContext);
  protected readonly sheets = inject(SheetService);
  protected readonly menuSheet = GameMenuSheet;
  protected readonly tableSheet = TableSheet;

  readonly title = input.required<string>();
  readonly subtitle = input('');

  protected readonly tableLabel = computed(() => {
    const g = this.ctx.game();
    if (!g?.tbl) return null;
    const seat = g.tblSeat == null ? -1 : g.players.findIndex(p => p.color === g.tblSeat);
    return seat >= 0 ? shortName(g.players[seat]!.name) : 'Live';
  });
}
