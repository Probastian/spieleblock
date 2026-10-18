import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SyncService } from '../../core/state/sync.service';
import { TableService } from '../../core/table/table.service';
import { doubleTap } from '../../core/util/double-tap';
import { SheetService } from '../../core/ui/sheet.service';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { PlayContext } from '../play/play-context';

/** Live-Tisch: starten, Code zeigen, Platz wählen, verlassen oder beenden. */
@Component({
  selector: 'sb-table-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, AvatarComponent],
  template: `
    @let g = ctx.game();
    @if (g) {
      @if (!sync.connected()) {
        <sb-sheet-head eyebrow="Mehrspieler" title="Live-Tisch" />
        <p class="wz-sum">Der Server ist gerade nicht erreichbar. Sobald die Verbindung steht, ist der Live-Tisch verfügbar.</p>
      } @else if (!g.tbl) {
        <sb-sheet-head eyebrow="Mehrspieler" title="Live-Tisch" />
        <div class="tbl-info">
          <p>
            Jeder öffnet den Block auf seinem Handy, tippt unter „Spiele“ auf <b>Live-Tisch beitreten</b>, gibt den Code ein und wählt seinen Namen. Alle sehen den Stand sofort und tragen für sich ein.
          </p>
        </div>
        <button class="btn primary big" type="button" style="margin-top: 14px" (click)="start()">Live-Tisch starten</button>
      } @else {
        <sb-sheet-head [eyebrow]="'Live-Tisch' + (g.tblHost ? ' · du bist Gastgeber' : '')" title="Mit anderen spielen" />
        <div class="tbl-code" [attr.aria-label]="'Code ' + g.tbl">{{ g.tbl }}</div>
        <p class="tbl-how">Mitspieler: Spieleblock öffnen, <b>Spiele</b>, <b>Live-Tisch beitreten</b>, Code eingeben, Namen wählen.</p>
        <h3 class="tbl-h">Wer bist du?</h3>
        <div class="tseats">
          @for (p of g.players; track p.color) {
            @let owner = seats()[p.color];
            <div class="tseat" [class.mine]="owner && owner === sync.uid()" [style.--pc]="'var(--p' + p.color + ')'">
              <span [sbAvatar]="p"></span>
              <span class="tn"
                ><b>{{ p.name }}</b
                ><small>{{ owner === sync.uid() ? 'Das bist du' : owner ? 'Belegt' : 'Frei' }}</small></span
              >
              @if (owner && owner === sync.uid()) {
                <button class="btn sm" type="button" (click)="table.releaseSeat(g.id)">Freigeben</button>
              } @else if (!owner) {
                <button class="btn sm" type="button" (click)="table.claimSeat(g.id, p.color)">Das bin ich</button>
              }
            </div>
          }
        </div>
        <div class="tbl-btns">
          <button class="btn" type="button" (click)="table.copyCode(g.tbl)">Code kopieren</button>
          <button class="btn" type="button" [class.danger]="g.tblHost" (click)="end()">
            {{ g.tblHost ? (endTap.armed() ? 'Nochmal tippen zum Beenden' : 'Live-Tisch beenden') : 'Tisch verlassen' }}
          </button>
        </div>
        <p class="note">{{ g.tblHost ? 'Beenden löscht den Tisch für alle. Jeder behält seine lokale Kopie des Spiels.' : 'Beim Verlassen bleibt deine lokale Kopie erhalten, aber ohne Live-Abgleich.' }}</p>
      }
    }
  `,
})
export class TableSheet {
  protected readonly ctx = inject(PlayContext);
  protected readonly sync = inject(SyncService);
  protected readonly table = inject(TableService);
  private readonly sheets = inject(SheetService);
  protected readonly endTap = doubleTap();

  protected readonly seats = computed(() => this.table.seats()[this.ctx.game()?.tbl ?? ''] ?? {});

  protected async start(): Promise<void> {
    const g = this.ctx.game();
    if (g) await this.table.start(g.id);
  }

  protected async end(): Promise<void> {
    const g = this.ctx.game();
    if (!g?.tbl) return;
    if (g.tblHost && !this.endTap.tap()) return;
    await this.table.end(g.id);
    this.sheets.close();
  }
}
