import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { hitster } from '@spieleblock/games';
import { HitsterDecks } from '../../core/hitster/hitster-decks.service';
import { SHEET_DATA, SheetService } from '../../core/ui/sheet.service';
import { PlayContext } from '../../features/play/play-context';
import { digitsOnly, inputValue } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

/** Korrigiert das Jahr einer Karte im laufenden Spiel. Die Korrektur gilt danach auch für künftige Spiele. */
@Component({
  selector: 'sb-hitster-year-fix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './hitster.css',
  imports: [SheetHeadComponent],
  template: `
    @if (card(); as c) {
      <sb-sheet-head eyebrow="Hitster" title="Jahr korrigieren" />
      <p class="note" style="margin: 0 0 10px"><b>{{ c.title }}</b> von {{ c.artist }}. Der Block nennt {{ c.year }}. Welches Jahr stimmt?</p>
      <input class="pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="Erscheinungsjahr" [value]="text()" (input)="text.set(digits($event))" />
      <button class="btn primary big" type="button" style="margin-top: 14px" [disabled]="!valid()" (click)="save()">Jahr übernehmen</button>
    }
  `,
})
export class YearFixSheet {
  private readonly ctx = inject(PlayContext);
  private readonly decks = inject(HitsterDecks);
  private readonly sheets = inject(SheetService);
  private readonly data = inject(SHEET_DATA) as { id: string };

  private readonly game = this.ctx.typed<hitster.HitsterGame>();
  protected readonly card = computed(() => {
    const g = this.game();
    return [...(g.current ? [g.current.card] : []), ...g.players.flatMap(p => p.line), ...g.discard].find(c => c.id === this.data.id);
  });
  protected readonly text = signal(String(this.card()?.year ?? ''));
  protected readonly valid = computed(() => {
    const y = +this.text();
    return this.text().length === 4 && y >= hitster.MIN_YEAR && y <= hitster.maxYear() && y !== this.card()?.year;
  });

  protected digits(e: Event): string {
    const v = digitsOnly(inputValue(e), 4);
    (e.target as HTMLInputElement).value = v;
    return v;
  }

  protected save(): void {
    const year = +this.text();
    const msg = this.ctx.update<hitster.HitsterGame, string | null>(g => hitster.fixYear(g, this.data.id, year));
    if (msg) {
      this.decks.setUserYear(this.data.id, year);
      this.ctx.notify(msg, true);
    }
    this.sheets.close();
  }
}
