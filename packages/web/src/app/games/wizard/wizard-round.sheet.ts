import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { clone, signed, wizard } from '@spieleblock/games';
import { SHEET_DATA, SheetService } from '../../core/ui/sheet.service';
import { doubleTap } from '../../core/util/double-tap';
import { PlayContext } from '../../features/play/play-context';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

export interface RoundSheetData {
  mode: wizard.DraftMode;
  index: number;
}

/** Ansagen und Stiche einer Runde eintragen oder ändern. */
@Component({
  selector: 'sb-wizard-round-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, NgTemplateOutlet],
  template: `
    @let w = draft();
    @if (w) {
      <sb-sheet-head [eyebrow]="eyebrow()" [title]="title()" />
      <div class="wz-rows">
        @for (p of game().players; track $index; let i = $index) {
          <div class="wz-row" [style.--pc]="'var(--p' + p.color + ')'">
            <div class="wz-name">
              <span class="dot"></span>
              <span>{{ p.name }}@if (game().tbl && game().tblSeat === p.color) { <em class="me">du</em> }</span>
              @if (w.showT) {
                <span class="wz-pts" [class.neg]="points(i) < 0">{{ sign(points(i)) }}</span>
              }
            </div>
            <div class="wz-ctrls">
              @if (w.showB) {
                <ng-container *ngTemplateOutlet="stepper; context: { i: i, field: 'b', label: 'Ansage', value: w.b[i] }" />
              } @else {
                <div class="wz-st fix"><span class="wz-l">Ansage</span><span class="wz-n">{{ w.b[i] }}</span></div>
              }
              @if (w.showT) {
                <ng-container *ngTemplateOutlet="stepper; context: { i: i, field: 't', label: 'Stiche', value: w.t![i] }" />
              }
            </div>
          </div>
        }
      </div>

      @if (w.showB) {
        @if (bidSum() === w.k) {
          <p class="wz-sum bad">Die Ansagen dürfen nicht aufgehen: zusammen {{ bidSum() }} bei {{ w.k }} {{ w.k === 1 ? 'Stich' : 'Stichen' }}. Einer muss höher oder niedriger ansagen, meistens der Geber.</p>
        } @else {
          <p class="wz-sum">Ansagen zusammen: <b>{{ bidSum() }}</b> bei {{ w.k }} {{ w.k === 1 ? 'Stich' : 'Stichen' }} ({{ bidSum() > w.k ? bidSum() - w.k + ' zu viel' : w.k - bidSum() + ' zu wenig' }}) ✓</p>
        }
      }
      @if (w.showT) {
        @if (trickSum() === w.k) {
          <p class="wz-sum">Stiche zusammen: <b>{{ trickSum() }}</b> von {{ w.k }} ✓</p>
        } @else {
          <p class="wz-sum bad">Es müssen genau {{ w.k }} {{ w.k === 1 ? 'Stich' : 'Stiche' }} sein, gerade sind es {{ trickSum() }}.</p>
        }
      }

      <button class="btn primary big" type="button" [disabled]="!valid()" (click)="save()">{{ saveLabel() }}</button>
      @if (canDelete()) {
        <button type="button" class="link" style="margin-top: 8px" (click)="remove()">{{ deleteTap.armed() ? 'Nochmal tippen zum Zurücksetzen' : 'Runde zurücksetzen' }}</button>
      }

      <ng-template #stepper let-i="i" let-field="field" let-label="label" let-value="value">
        <div class="wz-st">
          <span class="wz-l">{{ label }}</span>
          <button type="button" class="wz-b" [attr.aria-label]="label + ' verringern'" [disabled]="value <= 0" (click)="step(field, i, -1)">−</button>
          <output class="wz-n" [attr.aria-label]="label">{{ value }}</output>
          <button type="button" class="wz-b" [attr.aria-label]="label + ' erhöhen'" [disabled]="value >= w.k" (click)="step(field, i, 1)">+</button>
        </div>
      </ng-template>
    }
  `,
})
export class WizardRoundSheet {
  private readonly ctx = inject(PlayContext);
  private readonly sheets = inject(SheetService);
  private readonly data = inject(SHEET_DATA) as RoundSheetData;

  protected readonly game = this.ctx.typed<wizard.WizardGame>();
  protected readonly draft = signal<wizard.RoundDraft | null>(wizard.openDraft(this.game(), this.data.mode, this.data.index));
  protected readonly deleteTap = doubleTap();
  protected readonly sign = signed;

  protected readonly bidSum = computed(() => (this.draft()?.b ?? []).reduce((a, b) => a + b, 0));
  protected readonly trickSum = computed(() => (this.draft()?.t ?? []).reduce((a, b) => a + b, 0));
  protected readonly valid = computed(() => !!this.draft() && wizard.validateDraft(this.draft()!) === null);
  protected readonly canDelete = computed(() => {
    const w = this.draft();
    return !!w && !w.isNew && w.idx === this.game().rounds.length - 1;
  });

  protected readonly eyebrow = computed(() => {
    const w = this.draft()!;
    const what = w.isNew ? 'Neue Runde' : w.showB && w.showT ? 'Runde bearbeiten' : w.showT ? 'Nach dem Spielen' : 'Ansagen ändern';
    return `${what} · ${w.k} ${w.k === 1 ? 'Karte' : 'Karten'}`;
  });
  protected readonly title = computed(() => {
    const w = this.draft()!;
    return w.showB && w.showT ? 'Runde ' + w.k : (w.showT ? 'Stiche' : 'Ansagen') + ' · Runde ' + w.k;
  });
  protected readonly saveLabel = computed(() => {
    const w = this.draft()!;
    return w.isNew ? 'Ansagen speichern' : w.showT && !w.showB ? 'Runde abschließen' : 'Änderung speichern';
  });

  protected points(i: number): number {
    const w = this.draft()!;
    return wizard.score(w.b[i]!, w.t![i]!);
  }

  protected step(field: 'b' | 't', i: number, delta: number): void {
    this.draft.update(w => {
      const next = clone(w!);
      wizard.stepDraft(next, field, i, delta);
      return next;
    });
  }

  protected save(): void {
    const w = this.draft();
    if (!w) return;
    const error = wizard.validateDraft(w);
    if (error) return this.ctx.notify(error);
    const result = this.ctx.update<wizard.WizardGame, wizard.SaveOutcome | null>(g => wizard.saveDraft(g, w));
    if (!result) return;
    this.sheets.close();
    this.ctx.notify(result.message, true);
    if (result.phase === 'done' && !w.isNew) setTimeout(() => this.ctx.notify('Alle Runden gespielt. Zeit zum Auswerten!'), 600);
  }

  protected remove(): void {
    const w = this.draft();
    if (!w || w.isNew || !this.deleteTap.tap()) return;
    this.ctx.update<wizard.WizardGame>(g => void wizard.deleteRound(g, w.idx));
    this.sheets.close();
    this.ctx.notify(`Runde ${w.idx + 1} zurückgesetzt`, true);
  }
}
