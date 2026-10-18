import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { pluralize } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SHEET_DATA, SheetService } from '../../core/ui/sheet.service';
import { ToastService } from '../../core/ui/toast.service';
import { doubleTap } from '../../core/util/double-tap';
import { PLAYER_COLORS } from '../../core/state/models';
import { inputValue } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

/** Einzelner Spieler: Name, Farbe, Bilanz, archivieren. */
@Component({
  selector: 'sb-player-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    @if (player(); as p) {
      <sb-sheet-head eyebrow="Spieler" [title]="p.name" />
      <form autocomplete="off" (submit)="rename($event)">
        <label class="lbl" for="plname">Name</label>
        <div class="numrow sm" style="margin-top: 6px">
          <input id="plname" class="pin" type="text" maxlength="16" enterkeyhint="done" aria-label="Name" [value]="draft()" (input)="draft.set(inputValue($event))" />
          <button class="btn primary" type="submit">Speichern</button>
        </div>
      </form>

      <p class="lbl" style="margin-top: 16px">Farbe</p>
      <div class="swatches">
        @for (c of colors; track c) {
          <button class="sw" type="button" [style.--pc]="'var(--p' + c + ')'" [attr.aria-pressed]="p.color === c" [attr.aria-label]="'Farbe ' + (c + 1)" (click)="store.updatePlayer(p.id, { color: c })"></button>
        }
      </div>

      <p class="lbl">Bilanz{{ summary() }}</p>
      @for (k of keys(); track k.label) {
        <div class="statrow">
          <b>{{ k.label }}</b>
          <span>{{ k.text }}</span>
          @if (k.best !== null) {
            <span class="mono" title="Bestwert">{{ k.best }}</span>
          }
        </div>
      } @empty {
        <p class="note" style="margin: 6px 0 0">Noch keine abgeschlossenen Spiele.</p>
      }

      <div class="menu" style="margin-top: 18px">
        <button class="mi danger" type="button" [class.confirm]="archiveTap.armed()" (click)="archive()">
          <span><span class="mi-t">Spieler archivieren</span><span class="mi-s">{{ archiveTap.armed() ? 'Nochmal tippen zum Archivieren' : 'Verschwindet aus der Auswahl, bleibt in alten Spielen erhalten' }}</span></span>
        </button>
      </div>
    }
  `,
})
export class PlayerSheet {
  protected readonly store = inject(Store);
  private readonly sheets = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly id = inject(SHEET_DATA) as string;

  protected readonly colors = Array.from({ length: PLAYER_COLORS }, (_, i) => i);
  protected readonly archiveTap = doubleTap();
  protected readonly inputValue = inputValue;
  protected readonly player = computed(() => this.store.playerById(this.id));
  protected readonly draft = signal(this.store.playerById(this.id)?.name ?? '');

  private readonly stats = computed(() => this.store.stats()[this.id]);
  protected readonly summary = computed(() => {
    const s = this.stats();
    return s?.games ? ` · ${pluralize(s.games, 'Spiel', 'Spiele')}, ${pluralize(s.wins, 'Sieg', 'Siege')}` : '';
  });
  protected readonly keys = computed(() =>
    Object.values(this.stats()?.keys ?? {}).map(k => ({ label: k.label, text: `${pluralize(k.games, 'Spiel', 'Spiele')} · ${pluralize(k.wins, 'Sieg', 'Siege')}`, best: k.best })),
  );

  protected rename(e: Event): void {
    e.preventDefault();
    const name = this.draft().trim();
    if (!name) return void this.toast.show('Name eingeben');
    this.store.updatePlayer(this.id, { name: name.slice(0, 16) });
    this.toast.show('Name gespeichert');
  }

  protected archive(): void {
    if (!this.archiveTap.tap()) return;
    const name = this.player()?.name ?? 'Spieler';
    this.store.updatePlayer(this.id, { arch: true });
    this.sheets.close();
    this.toast.show(`${name} archiviert`);
  }
}
