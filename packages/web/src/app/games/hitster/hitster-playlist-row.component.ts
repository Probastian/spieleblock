import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';

export interface PlaylistRow {
  id: string;
  name: string;
  /** Zweite Zeile, z. B. „probastian · 35 Songs“. */
  sub: string;
  image: string | null;
}

/**
 * Eine Playlist als Zeile, überall gleich: Titelbild bündig links, Name und Angaben daneben, rechts Haken (gewählt)
 * oder Kreuz (entfernen). Dieselbe Zeile gilt für die gewählte, die zuletzt verwendeten, meine und gefundene Playlists.
 */
@Component({
  selector: 'sb-ht-plrow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  host: { class: 'ht-prow', role: 'listitem', '[class.sel]': 'selected()', '[class.busy]': 'busy()' },
  template: `
    <button class="ht-prow-main" type="button" [disabled]="busy()" [attr.aria-pressed]="selected()" (click)="pick.emit()">
      <span class="ht-prow-img" [class.noimg]="!item().image" [style.background-image]="bg()" aria-hidden="true"></span>
      <span class="ht-prow-t"><b>{{ item().name }}</b><small>{{ item().sub }}</small></span>
      @if (selected()) {
        <span class="ht-prow-ck" aria-label="Ausgewählt">✓</span>
      }
    </button>
    @if (removable()) {
      <button class="ht-prow-x" type="button" [attr.aria-label]="'„' + item().name + '“ entfernen'" (click)="remove.emit()">×</button>
    }
  `,
})
export class HitsterPlaylistRow {
  readonly item = input.required<PlaylistRow>();
  readonly selected = input(false);
  readonly removable = input(false);
  readonly busy = input(false);
  readonly pick = output<void>();
  readonly remove = output<void>();

  protected readonly bg = computed(() => (this.item().image ? `url("${this.item().image}")` : null));
}
