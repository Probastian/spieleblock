import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SheetService } from '../../core/ui/sheet.service';
import { GameTopbarComponent } from '../../features/play/game-topbar.component';
import { PlayContext } from '../../features/play/play-context';
import { DieComponent } from '../../shared/ui/die.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { KniffelActions } from './kniffel-actions';
import { KniffelDock } from './kniffel-dock.component';
import { KniffelFieldSheet, type FieldSheetData } from './field.sheet';
import { KniffelInfoSheet, type InfoSheetData } from './info.sheet';
import { KniffelOverviewSheet } from './overview.sheet';

interface Row {
  field: kniffel.FieldDef;
  /** Anzeige in der Zelle */
  text: string;
  /** CSS-Klassen der Zelle */
  cls: string;
  label: string;
}

interface Bonus {
  def: kniffel.BonusDef;
  got: boolean;
  dead: boolean;
  percent: number;
  status: string;
}

/** Das Kniffel-Blatt: oberer und unterer Teil, Extras, Gesamtsumme und die Würfelablage. */
@Component({
  selector: 'sb-kniffel-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, GameTopbarComponent, DieComponent, IconComponent, KniffelDock],
  template: `
    @let g = game();
    @let t = totals();
    <sb-game-topbar [title]="g.variant === 'extreme' ? 'Extreme' : 'Kniffel'">
      <span subtitle>Runde <span class="mono">{{ round() }}</span> von {{ fieldCount() }}@if (!multi()) { · <span class="mono">{{ t.total }}</span> Pkt. }</span>
      <div actions class="seg" role="group" aria-label="Eingabeart">
        <button type="button" [attr.aria-pressed]="diceMode()" aria-label="Würfel-Eingabe" (click)="actions.setInput('dice')"><svg sb-die [n]="5" mini></svg></button>
        <button type="button" [attr.aria-pressed]="!diceMode()" aria-label="Summen-Eingabe" (click)="actions.setInput('number')"><span class="n123">123</span></button>
      </div>
      <button actions class="iconbtn" type="button" aria-label="Übersichtstabelle" (click)="sheets.open(overview, { tall: true })"><svg sb-icon name="grid"></svg></button>

      @if (multi()) {
        <div class="wrap">
          <div class="strip">
            @for (pl of g.players; track $index; let i = $index) {
              <button class="pchip" type="button" [attr.aria-pressed]="i === g.view" [style.--pc]="'var(--p' + pl.color + ')'" (click)="actions.show(i)"
                [attr.aria-label]="pl.name + ', ' + scoreOf(pl) + ' Punkte' + (i === g.turn && !finished() ? ', am Zug' : '')">
                @if (i === g.turn && !finished()) { <span class="turnmark">am Zug</span> }
                <span class="pn"><span class="dot"></span><span>{{ pl.name }}</span></span>
                <span class="pt">{{ scoreOf(pl) }}</span>
              </button>
            }
          </div>
        </div>
      }
    </sb-game-topbar>

    <main class="wrap main kmain" [class.has-dock]="diceMode() && !finished()">
      @if (finished()) {
        <div class="notice"><span>Spiel beendet.</span><button class="btn sm" type="button" (click)="ctx.showResult()">Ergebnis</button></div>
      } @else if (multi() && g.view !== g.turn) {
        <div class="notice"><span><b>{{ turnPlayer().name }}</b> ist am Zug.</span><button class="btn sm" type="button" (click)="actions.showTurn()">Zu {{ turnPlayer().name }}</button></div>
      }

      <div class="kgrid">
        <div class="kcol">
          <section class="block" aria-label="Oberer Teil">
            <div class="sec-h"><span class="lbl">Oben</span><span class="mono sec-sum">{{ t.up }}</span></div>
            @for (r of upper(); track r.field.id) {
              <ng-container *ngTemplateOutlet="row; context: { r: r }" />
            }
            <div class="bonuswrap">
              @for (b of bonuses(); track b.def.at) {
                <div class="bonus" [class.got]="b.got" [class.dead]="b.dead">
                  <div class="bonus-top">
                    <span class="bl">{{ b.def.tiny || b.def.label }} <small>{{ b.def.at }}</small></span>
                    <span class="bs">{{ b.status }}</span>
                  </div>
                  <div class="bar"><i [style.width.%]="b.percent"></i></div>
                </div>
              }
              @if (target(); as s) {
                <div class="soll">Soll <b>{{ s.sign }}{{ s.abs }}</b>{{ s.value >= 0 ? ' · Bonuskurs' : '' }}</div>
              }
            </div>
          </section>
        </div>
        <div class="kcol">
          <section class="block" aria-label="Unterer Teil">
            <div class="sec-h"><span class="lbl">Unten</span><span class="mono sec-sum">{{ t.low }}</span></div>
            @for (r of lower(); track r.field.id) {
              <ng-container *ngTemplateOutlet="row; context: { r: r }" />
            }
          </section>
        </div>
      </div>

      @if (extraBonus() || g.firstRule) {
        <section class="block extras" aria-label="Extras">
          @if (extraBonus()) {
            <ng-container *ngTemplateOutlet="stepper; context: { label: 'Extra-Kniffel', count: viewed().extra || 0, kind: 'xk', canAdd: viewed().scores['kn'] === 50 }" />
          }
          @if (g.firstRule) {
            <ng-container *ngTemplateOutlet="stepper; context: { label: '1. Hand +5', count: viewed().fh || 0, kind: 'fh', canAdd: true }" />
          }
        </section>
      }

      <section class="grand" aria-label="Gesamtpunkte">
        <div class="g-l"><span class="lbl">{{ multi() ? viewed().name : 'Gesamt' }}</span><span class="g-n mono">{{ t.total }}</span></div>
        <div class="g-b">Oben {{ t.up }} · Bonus {{ t.bon }} · Unten {{ t.low }}@if (extraBonus()) { · Extra {{ t.kb }} }@if (g.firstRule) { · Hand {{ t.hand }} }</div>
      </section>
    </main>

    @if (diceMode() && !finished()) {
      <sb-kniffel-dock />
    }

    <ng-template #row let-r="r">
      <div class="row" [attr.data-f]="r.field.id" [class.flash]="flashing() === r.field.id">
        <button class="info" type="button" [attr.aria-label]="'So zählt ' + r.field.name" (click)="info(r.field.id)">
          @if (r.field.upper) { <svg sb-die [n]="r.field.face" mini></svg> } @else { <svg sb-icon name="info"></svg> }
        </button>
        <button class="rbtn" type="button" [attr.aria-label]="r.field.name + ', ' + r.field.short + ': ' + r.label" (click)="tap(r.field.id)">
          <span class="fname">{{ r.field.name }}@if (r.field.isNew) { <span class="new">neu</span> }</span>
          <span class="cell" [class]="r.cls">{{ r.text }}</span>
        </button>
      </div>
    </ng-template>

    <ng-template #stepper let-label="label" let-count="count" let-kind="kind" let-canAdd="canAdd">
      <div class="xrow">
        <span class="fname">{{ label }}</span>
        <span class="stepper">
          <button type="button" [disabled]="!count" [attr.aria-label]="label + ' entfernen'" (click)="actions.stepCounter(kind, -1)">−</button>
          <span class="mono" aria-live="polite">{{ count }}×</span>
          <button type="button" [disabled]="!canAdd" [attr.aria-label]="label + ' hinzufügen'" (click)="actions.stepCounter(kind, 1)">+</button>
        </span>
      </div>
    </ng-template>
  `,
})
export class KniffelBoard {
  protected readonly ctx = inject(PlayContext);
  protected readonly actions = inject(KniffelActions);
  protected readonly sheets = inject(SheetService);
  private readonly injector = inject(Injector);
  protected readonly overview = KniffelOverviewSheet;

  protected readonly game = this.ctx.typed<kniffel.KniffelGame>();
  protected readonly finished = computed(() => this.game().status === 'finished');
  protected readonly diceMode = computed(() => this.game().input === 'dice');
  protected readonly multi = computed(() => this.game().players.length > 1);
  protected readonly viewed = computed(() => this.game().players[this.game().view]!);
  protected readonly turnPlayer = computed(() => this.game().players[this.game().turn]!);
  protected readonly def = computed(() => kniffel.variantOf(this.game()));
  protected readonly fieldCount = computed(() => kniffel.allFields(this.game()).length);
  protected readonly round = computed(() => kniffel.currentRound(this.game()));
  protected readonly totals = computed(() => kniffel.totals(this.game(), this.viewed()));
  protected readonly extraBonus = computed(() => kniffel.extraValue(this.game()) > 0);

  /** Mit fünf Würfeln in der Ablage zeigt jedes freie Feld, was der Wurf dort brächte. */
  private readonly preview = computed(() => this.diceMode() && !this.finished() && kniffel.isDiceFull(this.game()));
  private readonly best = computed(() => (this.preview() ? kniffel.bestField(this.game(), this.viewed()) : null));

  protected readonly upper = computed(() => this.def().upper.map(f => this.rowOf(f)));
  protected readonly lower = computed(() => this.def().lower.map(f => this.rowOf(f)));

  protected readonly bonuses = computed<Bonus[]>(() => {
    const p = this.viewed();
    const up = this.totals().up;
    const open = this.def().upper.filter(f => p.scores[f.id] === undefined);
    const maxUp = up + open.reduce((a, f) => a + 5 * (f.face ?? 0), 0);
    return this.def().bonus.map(def => {
      const got = up >= def.at;
      const dead = !got && maxUp < def.at;
      return { def, got, dead, percent: Math.min(100, (up / def.at) * 100), status: got ? '+' + def.pts : dead ? 'weg' : 'noch ' + (def.at - up) };
    });
  });

  /** „Soll“: wie weit liegen die ausgefüllten oberen Felder über oder unter drei Würfeln je Zahl? */
  protected readonly target = computed(() => {
    const p = this.viewed();
    const done = this.def().upper.filter(f => p.scores[f.id] !== undefined);
    if (!done.length) return null;
    const value = done.reduce((a, f) => a + p.scores[f.id]! - 3 * (f.face ?? 0), 0);
    return { value, sign: value > 0 ? '+' : value < 0 ? '−' : '±', abs: Math.abs(value) };
  });

  protected readonly flashing = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Kurz aufleuchten (und ggf. hinscrollen), wenn ein Feld hervorgehoben werden soll
    effect(() => {
      const flash = this.ctx.flash();
      if (!flash) return;
      untracked(() => {
        this.flashing.set(flash.id);
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => this.flashing.set(null), 1400);
        if (flash.scroll) {
          afterNextRender(
            () => document.querySelector(`.row[data-f="${flash.id}"]`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
            { injector: this.injector },
          );
        }
      });
    });
  }

  protected scoreOf(p: kniffel.KniffelPlayer): number {
    return kniffel.totals(this.game(), p).total;
  }

  private rowOf(field: kniffel.FieldDef): Row {
    const g = this.game();
    const value = this.viewed().scores[field.id];
    if (value !== undefined) return { field, text: String(value), cls: value === 0 ? 'zero' : 'filled', label: value === 0 ? 'gestrichen' : value + ' Punkte' };
    if (this.preview()) {
      const points = field.calc(g.dice);
      const best = field.id === this.best() ? ' best' : '';
      return { field, text: points > 0 ? '+' + points : '0', cls: (points > 0 ? 'prev' : 'prev nil') + best, label: points > 0 ? `Wurf eintragen: ${points} Punkte` : 'Wurf passt nicht, Feld streichen' };
    }
    return { field, text: '', cls: 'empty', label: 'leer' };
  }

  /** Feld antippen: mit vollen Würfeln gleich eintragen, sonst Zahl abfragen. */
  protected tap(fieldId: string): void {
    const g = this.game();
    const filled = this.viewed().scores[fieldId] !== undefined;
    if (this.preview() && !filled) {
      this.actions.commit(g.view, fieldId, kniffel.FIELDS_BY_ID[fieldId]!.calc(g.dice), { fromDice: true, firstHand: g.first });
      return;
    }
    this.sheets.open(KniffelFieldSheet, { data: { fieldId, playerIndex: g.view } satisfies FieldSheetData });
  }

  protected info(fieldId: string): void {
    const g = this.game();
    this.sheets.open(KniffelInfoSheet, { data: { fieldId, variant: g.variant, extra: g.extra } satisfies InfoSheetData });
  }
}
