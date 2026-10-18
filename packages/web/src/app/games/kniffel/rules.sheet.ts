import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { SHEET_DATA } from '../../core/ui/sheet.service';
import { DieComponent } from '../../shared/ui/die.component';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

export interface RulesSheetData {
  variant: kniffel.VariantKey;
  /** Hausregel „Extra-Kniffel +50“ der klassischen Variante. */
  extra: boolean;
  /** Hausregel „Erste Hand +5“. */
  firstHand: boolean;
}

/** Alle Felder und der Ablauf, umschaltbar zwischen Klassisch und Extreme. */
@Component({
  selector: 'sb-kniffel-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, DieComponent, NgTemplateOutlet],
  template: `
    <sb-sheet-head eyebrow="Regeln" title="Felder & Ablauf" />
    <div class="tabs" role="group" aria-label="Variante">
      <button type="button" [attr.aria-pressed]="variant() === 'classic'" (click)="variant.set('classic')">Klassisch</button>
      <button type="button" [attr.aria-pressed]="variant() === 'extreme'" (click)="variant.set('extreme')">Extreme</button>
    </div>

    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>Wer am Zug ist, würfelt bis zu dreimal. Nach jedem Wurf darfst du beliebige Würfel liegen lassen und die übrigen neu werfen. Danach trägst du das Ergebnis in genau ein freies Feld ein. Passt der Wurf nirgends, streichst du ein Feld mit 0.</p>
        <p>Nach {{ fieldCount() }} Runden sind alle Felder voll. Es gewinnt die höchste Gesamtsumme.</p>
        @if (variant() === 'extreme') {
          <p>Extreme hat vier neue Felder, einen Superbonus ab 80 Punkten oben und jeder weitere Kniffel zählt 100.</p>
        }
        @if (data.firstHand) {
          <p><b>Erste Hand (Hausregel):</b> Trägst du direkt nach dem ersten Wurf ein Feld mit mindestens einem Punkt ein, gibt es 5 Extrapunkte. Gestrichene Felder zählen nicht. Mit „Würfeln“ im Block erkennt er den ersten Wurf selbst. Bei eigenen Würfeln schaltest du „1. Wurf +5“ ein, oder du stellst den Zähler „1. Hand“ nach.</p>
        }
      </section>

      <section>
        <h3>Oben</h3>
        @for (f of def().upper; track f.id) {
          <ng-container *ngTemplateOutlet="item; context: { f: f }" />
        }
        @for (b of def().bonus; track b.at) {
          <div class="ritem">
            <div class="ritem-h"><b>{{ b.label }}</b><span>ab {{ b.at }} oben · +{{ b.pts }}</span></div>
            <p>
              @if (b.at === 63) {
                Erreichst du oben mindestens 63 Punkte, gibt es 35 Punkte extra. 63 entspricht drei Würfeln jeder Zahl (3×1 + 3×2 + … + 3×6). Der Block zeigt dir, wie weit du über oder unter diesem Soll liegst.
              } @else {
                Bei 80 Punkten oder mehr gibt es zusätzlich noch einmal 25 Punkte. Zusammen mit dem normalen Bonus sind das 60.
              }
            </p>
          </div>
        }
      </section>

      <section>
        <h3>Unten</h3>
        @for (f of def().lower; track f.id) {
          <ng-container *ngTemplateOutlet="item; context: { f: f }" />
        }
        @if (extraRule()) {
          <div class="ritem">
            <div class="ritem-h"><b>Extra-Kniffel</b><span>+{{ extraPoints() }} je Stück</span></div>
            <p>Würfelst du einen weiteren Kniffel, nachdem dein Kniffel-Feld mit 50 belegt ist, gibt es {{ extraPoints() }} Extrapunkte. Bei der Würfel-Eingabe passiert das automatisch, sonst über den Zähler unter den Feldern. Ist das Kniffel-Feld gestrichen, gibt es nichts extra.</p>
          </div>
        }
      </section>

      <section>
        <h3>So nutzt du den Block</h3>
        <ul>
          <li><b>Würfel-Eingabe:</b> Augen unten antippen oder „Würfeln“ drücken. Sobald fünf Würfel liegen, zeigt jedes freie Feld seine Punkte. Feld antippen, fertig.</li>
          <li>Einen Würfel antippen nimmt ihn heraus. „Würfeln“ wirft nur die leeren Plätze neu, die anderen bleiben liegen.</li>
          <li><b>Summen-Eingabe:</b> Feld antippen und die Punkte mit der Zahlentastatur eintippen. Unmögliche Werte nimmt der Block nicht an.</li>
          <li>Ein ausgefülltes Feld antippen, um es zu ändern. Jeder Eintrag lässt sich rückgängig machen.</li>
          <li>Das Spiel wird laufend gespeichert. Du kannst jederzeit zum Hauptmenü und später weiterspielen.</li>
        </ul>
      </section>
    </div>

    <ng-template #item let-f="f">
      <div class="ritem">
        <div class="ritem-h"><b>{{ f.name }}@if (f.isNew) { <span class="new">neu</span> }</b><span>{{ f.short }}</span></div>
        <p>{{ text(f) }}</p>
        <div class="example">
          <span class="exdice">@for (d of f.ex; track $index) { <svg sb-die [n]="d"></svg> }</span>
          <span class="exeq">ergibt <b>{{ f.calc(f.ex) }}</b></span>
        </div>
      </div>
    </ng-template>
  `,
})
export class KniffelRulesSheet {
  protected readonly data = inject(SHEET_DATA) as RulesSheetData;
  protected readonly variant = signal(this.data.variant);
  protected readonly def = computed(() => kniffel.VARIANTS[this.variant()]);
  protected readonly fieldCount = computed(() => kniffel.fieldsOf(this.def()).length);
  protected readonly extraRule = computed(() => this.variant() === 'extreme' || this.data.extra);
  protected readonly extraPoints = computed(() => (this.variant() === 'extreme' ? 100 : 50));

  protected text(f: kniffel.FieldDef): string {
    return kniffel.ruleText(f, this.variant(), this.variant() === 'extreme' ? true : this.data.extra);
  }
}
