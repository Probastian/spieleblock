import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SHEET_DATA } from '../../core/ui/sheet.service';
import { PlayContext } from '../../features/play/play-context';
import { digitsOnly } from '../../shared/dom';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';
import { KniffelActions } from './kniffel-actions';
import { RuleBoxComponent } from './rule-box.component';

export interface FieldSheetData {
  fieldId: string;
  playerIndex: number;
}

/** Punkte für ein Feld per Zahl eintragen (Summen-Eingabe), mit Schnellwahl und Regelkasten. */
@Component({
  selector: 'sb-kniffel-field-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, RuleBoxComponent],
  template: `
    <sb-sheet-head [title]="field.name">
      <span eyebrow [style.--pc]="'var(--p' + player.color + ')'" style="display: contents"><span class="dot"></span>{{ player.name }}{{ current !== undefined ? ' · aktuell ' + current : '' }}</span>
    </sb-sheet-head>

    <form autocomplete="off" novalidate (submit)="submit($event)">
      <div class="numrow">
        <input #numberInput class="numin" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" maxlength="3" placeholder="Punkte" [class.bad]="check().state === 'bad'"
          [attr.aria-label]="'Punkte für ' + field.name" aria-describedby="numMsg" [value]="text()" (input)="type($event)" />
        <button class="btn primary" type="submit" [disabled]="check().state !== 'ok'">{{ current !== undefined ? 'Ändern' : 'Eintragen' }}</button>
      </div>
      <div class="chips">
        @if (game().firstRule && current === undefined) {
          <button type="button" class="chip fromdice" [attr.aria-pressed]="firstHand()" (click)="firstHand.set(!firstHand())">Aus erstem Wurf · +5</button>
        }
        @if (fromDice !== null && fromDice > 0 && !quick.includes(fromDice)) {
          <button type="button" class="chip fromdice" (click)="pick(fromDice)">{{ fromDice }} aus Wurf</button>
        }
        @for (v of quick; track v) {
          <button type="button" class="chip" [class.fromdice]="v === fromDice" (click)="pick(v)">{{ v }}</button>
        }
        <button type="button" class="chip txt" (click)="pick(0)">0 · streichen</button>
        @if (current !== undefined) {
          <button type="button" class="chip ghost" (click)="clear()">Feld leeren</button>
        }
      </div>
      <p id="numMsg" class="msg" [class.err]="check().state === 'bad'">{{ check().message }}</p>
    </form>
    <sb-rule-box [field]="field" [variant]="game().variant" [extra]="game().extra" />
  `,
})
export class KniffelFieldSheet {
  private readonly ctx = inject(PlayContext);
  private readonly actions = inject(KniffelActions);
  private readonly data = inject(SHEET_DATA) as FieldSheetData;

  protected readonly game = this.ctx.typed<kniffel.KniffelGame>();
  protected readonly field = kniffel.FIELDS_BY_ID[this.data.fieldId]!;
  protected readonly player = this.game().players[this.data.playerIndex]!;
  protected readonly current = this.player.scores[this.data.fieldId];

  private readonly allowed = kniffel.possibleValues(this.field);
  private readonly allowedText = kniffel.possibleText(this.field);
  /** Bei wenigen möglichen Werten gibt es Schnellwahl-Knöpfe. */
  protected readonly quick = this.allowed.filter(x => x > 0).length <= 6 ? this.allowed.filter(x => x > 0) : [];
  /** Punkte, die der aktuelle Wurf in der Ablage hier ergäbe. */
  protected readonly fromDice: number | null = kniffel.isDiceFull(this.game()) ? this.field.calc(this.game().dice) : null;

  protected readonly text = signal(this.current !== undefined ? String(this.current) : '');
  /** „Aus erstem Wurf“ (Hausregel +5), vorbelegt wie die Ablage. */
  protected readonly firstHand = signal(this.game().first);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('numberInput');

  constructor() {
    afterNextRender(() => {
      try {
        const el = this.input()?.nativeElement;
        el?.focus({ preventScroll: true });
        el?.select();
      } catch {
        /* nicht fokussierbar */
      }
    });
  }

  protected readonly check = computed<{ state: 'empty' | 'ok' | 'bad'; value: number | null; message: string }>(() => {
    const raw = this.text();
    const name = this.field.name;
    if (raw === '') return { state: 'empty', value: null, message: `Erlaubt: ${this.allowedText}. 0 heißt gestrichen.` };
    const n = parseInt(raw, 10);
    if (n === 0 || this.allowed.includes(n)) return { state: 'ok', value: n, message: n === 0 ? '0 Punkte: das Feld wird gestrichen.' : `${n} Punkte bei ${name}.` };
    return { state: 'bad', value: null, message: `${n} geht bei ${name} nicht. Erlaubt: ${this.allowedText}.` };
  });

  protected type(e: Event): void {
    const el = e.target as HTMLInputElement;
    el.value = digitsOnly(el.value, 3);
    this.text.set(el.value);
  }

  protected submit(e: Event): void {
    e.preventDefault();
    const { state, value } = this.check();
    if (state === 'ok') this.pick(value!);
  }

  protected pick(value: number): void {
    this.actions.commit(this.data.playerIndex, this.data.fieldId, value, { fromDice: false, firstHand: this.firstHand() });
  }

  protected clear(): void {
    this.actions.commit(this.data.playerIndex, this.data.fieldId, null, { fromDice: false });
  }
}
