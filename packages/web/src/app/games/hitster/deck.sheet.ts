import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { hitster } from '@spieleblock/games';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import type { LoadedPlaylist } from '../../core/spotify/spotify-api.service';
import { SHEET_DATA } from '../../core/ui/sheet.service';
import { digitsOnly, inputValue } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

interface Line {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  src: 'spotify' | 'mb' | 'user' | null;
  unsure: boolean;
}

/** Alle Songs einer Playlist mit Jahr und Herkunft. Hier lassen sich falsche Jahre von Hand berichtigen. */
@Component({
  selector: 'sb-hitster-deck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Playlist" [title]="playlist()?.name || 'Songs'" />
    @if (error()) {
      <p class="ht-err" role="alert">{{ error() }}</p>
    } @else if (!playlist()) {
      <div class="blank"><b>Lade Songs …</b></div>
    } @else {
      <div class="chips" style="margin-top: 0">
        <button type="button" class="chip txt" [attr.aria-pressed]="!onlyCheck()" (click)="onlyCheck.set(false)">Alle {{ lines().length }}</button>
        <button type="button" class="chip txt" [attr.aria-pressed]="onlyCheck()" (click)="onlyCheck.set(true)">Zu prüfen {{ toCheck() }}</button>
      </div>
      <div class="ht-list">
        @for (l of shown(); track l.id) {
          <div class="ht-row">
            <span class="ht-main"><b>{{ l.title }}</b><small>{{ l.artist }}</small></span>
            @if (editing() === l.id) {
              <input class="pin ht-yin" type="text" inputmode="numeric" maxlength="4" aria-label="Jahr" [value]="draft()" (input)="draft.set(digits($event))" (keydown.enter)="save(l)" />
              <button class="btn sm" type="button" [disabled]="draft().length !== 4" (click)="save(l)">OK</button>
            } @else {
              @if (l.src === 'user') { <span class="ht-badge mine">Von dir</span> }
              @else if (l.unsure) { <span class="ht-badge warn">Prüfen</span> }
              @else if (!l.src || l.src === 'spotify') { <span class="ht-badge">Spotify</span> }
              @else { <span class="ht-badge">MusicBrainz</span> }
              <button class="ht-yr" type="button" style="background: none; border: 0; padding: 0" [attr.aria-label]="'Jahr ändern: ' + l.title" (click)="edit(l)">{{ l.year ?? '?' }}</button>
            }
          </div>
        } @empty {
          <div class="blank"><b>Nichts zu prüfen</b>Alle Jahre sind unauffällig.</div>
        }
      </div>
      @if (playlist()!.skipped) {
        <p class="note" style="margin: 8px 0 0">{{ playlist()!.skipped === 1 ? 'Ein Eintrag fehlt' : playlist()!.skipped + ' Einträge fehlen' }}: lokale Dateien, Podcasts oder in deinem Land gesperrte Songs.</p>
      }
      <p class="note" style="margin: 8px 0 0">Tippe auf ein Jahr, um es zu ändern. Deine Korrektur gilt für alle Spiele und Geräte.</p>
    }
  `,
})
export class DeckSheet {
  private readonly decks = inject(HitsterDecks);
  private readonly data = inject(SHEET_DATA) as { id: string };

  protected readonly playlist = signal<LoadedPlaylist | null>(null);
  protected readonly error = signal('');
  protected readonly onlyCheck = signal(false);
  protected readonly editing = signal('');
  protected readonly draft = signal('');

  protected readonly lines = computed<Line[]>(() => {
    const p = this.playlist();
    const years = this.decks.years();
    if (!p) return [];
    return p.tracks.map(t => {
      const e = years[t.id] ?? hitster.resolveYear(t.year, null);
      return { id: t.id, title: t.title, artist: t.artists.join(', '), year: e?.y ?? null, src: years[t.id] ? e!.src : e ? 'spotify' : null, unsure: !!e?.unsure && e.src !== 'user' };
    });
  });
  protected readonly toCheck = computed(() => this.lines().filter(l => this.needsCheck(l)).length);
  protected readonly shown = computed(() => {
    const all = this.lines();
    if (this.onlyCheck()) return all.filter(l => this.needsCheck(l));
    return [...all].sort((a, b) => Number(this.needsCheck(b)) - Number(this.needsCheck(a)));
  });

  constructor() {
    this.decks.load(this.data.id).then(
      p => this.playlist.set(p),
      e => this.error.set(this.decks.errorText(e)),
    );
  }

  private needsCheck(l: Line): boolean {
    return l.unsure || l.year === null;
  }

  protected edit(l: Line): void {
    this.editing.set(l.id);
    this.draft.set(l.year ? String(l.year) : '');
  }

  protected digits(e: Event): string {
    const v = digitsOnly(inputValue(e), 4);
    (e.target as HTMLInputElement).value = v;
    return v;
  }

  protected save(l: Line): void {
    const y = +this.draft();
    if (y >= hitster.MIN_YEAR && y <= hitster.maxYear()) this.decks.setUserYear(l.id, y);
    this.editing.set('');
  }
}
