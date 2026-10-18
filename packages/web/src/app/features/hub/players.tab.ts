import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { pluralize } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { inputValue } from '../../shared/dom';
import { AvatarComponent } from '../../shared/ui/avatar.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PlayerSheet } from './player.sheet';

@Component({
  selector: 'sb-players-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  imports: [AvatarComponent, IconComponent],
  template: `
    <section class="sec">
      <h2 class="lbl">Neuer Spieler</h2>
      <form class="addrow" autocomplete="off" (submit)="add($event)">
        <input class="pin" type="text" placeholder="Name" maxlength="16" autocapitalize="words" enterkeyhint="done" aria-label="Name des neuen Spielers" [value]="name()" (input)="name.set(inputValue($event))" />
        <button class="btn primary" type="submit">Hinzufügen</button>
      </form>
    </section>

    <section class="sec">
      <h2 class="lbl">Deine Spieler <span class="count">{{ rows().length }}</span></h2>
      @if (rows().length) {
        <ul class="plist2">
          @for (r of rows(); track r.player.id) {
            <li>
              <button class="prow2" type="button" [style.--pc]="'var(--p' + r.player.color + ')'" (click)="open(r.player.id)">
                <span [sbAvatar]="r.player"></span>
                <span><b>{{ r.player.name }}</b><small>{{ r.sub }}</small></span>
                <span class="chev"><svg sb-icon name="chevR"></svg></span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <div class="blank"><b>Noch keine Spieler</b>Leg hier deine Mitspieler an. Sie bleiben gespeichert und stehen in jedem Spiel zur Auswahl.</div>
      }
    </section>

    @if (store.archivedPlayers().length; as count) {
      <section class="sec">
        <button class="link" type="button" style="justify-self: start" (click)="showArchived.set(!showArchived())">
          {{ showArchived() ? 'Archivierte ausblenden' : 'Archivierte Spieler (' + count + ')' }}
        </button>
        @if (showArchived()) {
          <ul class="plist2">
            @for (p of store.archivedPlayers(); track p.id) {
              <li>
                <button class="prow2" type="button" [style.--pc]="'var(--p' + p.color + ')'" (click)="restore(p.id)">
                  <span [sbAvatar]="p"></span>
                  <span><b>{{ p.name }}</b><small>Archiviert</small></span>
                  <span class="pill ghost">Zurückholen</span>
                </button>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class PlayersTab {
  protected readonly store = inject(Store);
  private readonly sheets = inject(SheetService);
  private readonly toast = inject(ToastService);

  protected readonly name = signal('');
  protected readonly showArchived = signal(false);
  protected readonly inputValue = inputValue;

  protected readonly rows = computed(() => {
    const stats = this.store.stats();
    return this.store.roster().map(player => {
      const s = stats[player.id];
      return { player, sub: s?.games ? `${pluralize(s.games, 'Spiel', 'Spiele')} · ${pluralize(s.wins, 'Sieg', 'Siege')}` : 'Noch kein Spiel' };
    });
  });

  protected add(e: Event): void {
    e.preventDefault();
    const r = this.store.addPlayer(this.name());
    if (!r) return this.toast.show('Bitte einen Namen eingeben');
    this.name.set('');
    this.toast.show(r.isNew ? `${r.player.name} hinzugefügt` : r.restored ? `${r.player.name} zurückgeholt` : `${r.player.name} gibt es schon`);
  }

  protected open(id: string): void {
    this.sheets.open(PlayerSheet, { data: id });
  }

  protected restore(id: string): void {
    this.store.updatePlayer(id, { arch: false });
    this.toast.show('Spieler zurückgeholt');
  }
}
