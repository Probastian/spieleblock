import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChildren } from '@angular/core';
import { tafel } from '@spieleblock/games';
import { SHEET_DATA, SheetService } from '../../core/ui/sheet.service';
import { doubleTap } from '../../core/util/double-tap';
import { PlayContext } from '../../features/play/play-context';
import { digitsOnly } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

/** Eine Runde eintragen oder ändern: je Spieler Punkte und Vorzeichen. */
@Component({
  selector: 'sb-round-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head [eyebrow]="isNew ? 'Neue Runde' : 'Runde bearbeiten'" [title]="'Runde ' + (isNew ? game().rounds.length + 1 : index + 1)" />
    <form autocomplete="off" novalidate (submit)="save($event)">
      <div class="rrows">
        @for (p of game().players; track $index; let i = $index) {
          <div class="rrow" [style.--pc]="'var(--p' + p.color + ')'">
            <span class="rname"><span class="dot"></span><span>{{ p.name }}</span></span>
            <button type="button" class="sgn" [attr.aria-pressed]="negative()[i]" [attr.aria-label]="'Vorzeichen für ' + p.name" (click)="flip(i)">{{ negative()[i] ? '−' : '+' }}</button>
            <input #field class="rin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="0" [attr.enterkeyhint]="i < game().players.length - 1 ? 'next' : 'done'"
              [attr.aria-label]="'Punkte für ' + p.name" [value]="texts()[i]" (input)="type(i, $event)" (keydown.enter)="next(i, $event)" />
          </div>
        }
      </div>
      <p class="note">Leer heißt 0. Mit dem Vorzeichen-Knopf trägst du Minuspunkte ein.</p>
      <button class="btn primary big" type="submit">{{ isNew ? 'Runde speichern' : 'Änderung speichern' }}</button>
      @if (!isNew) {
        <button type="button" class="link" style="margin-top: 8px" (click)="remove()">{{ deleteTap.armed() ? 'Nochmal tippen zum Löschen' : 'Runde löschen' }}</button>
      }
    </form>
  `,
})
export class RoundSheet {
  private readonly ctx = inject(PlayContext);
  private readonly sheets = inject(SheetService);
  /** -1 = neue Runde, sonst Nummer der Runde (ab 0). */
  protected readonly index = inject(SHEET_DATA) as number;
  protected readonly isNew = this.index < 0;
  protected readonly game = this.ctx.typed<tafel.TafelGame>();
  protected readonly deleteTap = doubleTap();

  private readonly initial = this.isNew ? [] : this.game().rounds[this.index]!;
  protected readonly negative = signal(this.game().players.map((_, i) => !this.isNew && (+this.initial[i]! || 0) < 0));
  protected readonly texts = signal(this.game().players.map((_, i) => (!this.isNew && this.initial[i] ? String(Math.abs(this.initial[i]!)) : '')));
  private readonly fields = viewChildren<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => {
      const first = this.game().players.findIndex((_, i) => !(+this.initial[i]! || 0));
      try {
        this.fields()[first < 0 ? 0 : first]?.nativeElement.focus({ preventScroll: true });
      } catch {
        /* nicht fokussierbar */
      }
    });
  }

  protected readonly values = computed(() => this.texts().map((t, i) => (parseInt(t || '0', 10) || 0) * (this.negative()[i] ? -1 : 1)));

  protected flip(i: number): void {
    this.negative.update(n => n.map((v, k) => (k === i ? !v : v)));
  }

  protected type(i: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    el.value = digitsOnly(el.value);
    this.texts.update(t => t.map((v, k) => (k === i ? el.value : v)));
  }

  protected next(i: number, e: Event): void {
    e.preventDefault();
    const nextField = this.fields()[i + 1];
    if (nextField) nextField.nativeElement.focus();
    else this.save(e);
  }

  protected save(e: Event): void {
    e.preventDefault();
    const values = this.values();
    const message = this.ctx.update<tafel.TafelGame, string>(g => (this.isNew ? tafel.addRound(g, values) : tafel.editRound(g, this.index, values)));
    this.sheets.close();
    if (message) this.ctx.notify(message, true);
  }

  protected remove(): void {
    if (!this.deleteTap.tap()) return;
    const message = this.ctx.update<tafel.TafelGame, string | null>(g => tafel.deleteRound(g, this.index));
    this.sheets.close();
    if (message) this.ctx.notify(message, true);
  }
}
