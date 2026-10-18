import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { kniffel } from '@spieleblock/games';
import { PlayContext } from '../../features/play/play-context';
import { DieComponent } from '../../shared/ui/die.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { KniffelActions } from './kniffel-actions';

/** Die Würfelablage am unteren Rand: fünf Plätze, Würfeln-Knopf, Augenzahlen zum Antippen. */
@Component({
  selector: 'sb-kniffel-dock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DieComponent, IconComponent],
  template: `
    @let g = game();
    <div class="dock" [class.kniffel]="isKniffel()" role="region" aria-label="Wurf eingeben">
      <div class="wrap">
        <div class="dock-hint">
          <span class="dh">
            @if (isKniffel()) {
              <b>KNIFFEL!</b> {{ extraApplies() ? '+' + extraPoints() + ' extra, Feld wählen' : 'Feld wählen' }}
            } @else if (full()) {
              @if (best(); as id) { Meiste: <b>{{ fieldName(id) }}</b> } @else { Feld antippen zum Eintragen }
            } @else if (placed()) {
              Noch {{ 5 - placed() }} Würfel eingeben
            } @else {
              Augen antippen oder würfeln
            }
          </span>
          @if (g.firstRule) {
            <button class="firstbtn" type="button" [attr.aria-pressed]="g.first" aria-label="Wurf stammt aus dem ersten Wurf, plus 5 Punkte" (click)="actions.toggleFirstRoll()">1. Wurf +5</button>
          }
          <span class="sum">@if (placed()) { Σ {{ sum() }} }</span>
        </div>

        <div class="slots">
          @for (x of g.dice; track $index; let i = $index) {
            <button class="slot" type="button" [class.set]="x" [class.tumble]="actions.rolled().includes(i)" [style.--d]="actions.rolled().indexOf(i) * 45 + 'ms'"
              [attr.aria-label]="x ? 'Würfel ' + (i + 1) + ' zeigt ' + x + ', antippen zum Entfernen' : 'Würfel ' + (i + 1) + ' leer'" (click)="actions.removeDie(i)">
              @if (x) { <svg sb-die [n]="x"></svg> } @else { {{ i + 1 }} }
            </button>
          }
          <button class="roll" type="button" [disabled]="full() || g.rolls >= 3" [attr.aria-label]="'Leere Plätze würfeln, Wurf ' + g.rolls + ' von 3'" (click)="actions.roll()">
            <span>{{ full() ? 'Neu?' : 'Würfeln' }}</span><small>{{ g.rolls }}/3</small>
          </button>
        </div>

        <div class="faces">
          @for (f of faces; track f) {
            <button class="face" type="button" [disabled]="full()" [attr.aria-label]="f + ' eintragen'" (click)="actions.setDie(f)"><svg sb-die [n]="f"></svg></button>
          }
          <button class="face clr" type="button" [disabled]="!placed()" aria-label="Alle Würfel entfernen" (click)="actions.clearDice()"><svg sb-icon name="back"></svg></button>
        </div>
      </div>
    </div>
  `,
})
export class KniffelDock {
  protected readonly ctx = inject(PlayContext);
  protected readonly actions = inject(KniffelActions);
  protected readonly game = this.ctx.typed<kniffel.KniffelGame>();
  protected readonly faces = [1, 2, 3, 4, 5, 6];

  protected readonly placed = computed(() => this.game().dice.filter(Boolean).length);
  protected readonly full = computed(() => kniffel.isDiceFull(this.game()));
  protected readonly sum = computed(() => kniffel.diceSum(this.game()));
  protected readonly isKniffel = computed(() => this.full() && kniffel.isKniffel(this.game().dice));
  protected readonly extraPoints = computed(() => kniffel.extraValue(this.game()));
  private readonly viewed = computed(() => this.game().players[this.game().view]!);
  protected readonly extraApplies = computed(() => this.extraPoints() > 0 && this.viewed().scores['kn'] === 50);
  protected readonly best = computed(() => (this.full() ? kniffel.bestField(this.game(), this.viewed()) : null));

  private seen: { id: string; dice: number[]; rolls: number } | null = null;

  constructor() {
    // Würfel purzeln lassen, sobald ein Wurf dazukommt – auch wenn er von einem anderen Gerät am Live-Tisch stammt
    effect(() => {
      const { id, dice, rolls } = this.game();
      untracked(() => {
        const before = this.seen;
        this.seen = { id, dice: dice.slice(), rolls };
        if (before?.id !== id || rolls <= before.rolls) return;
        const fresh = dice.flatMap((x, i) => (x && !before.dice[i] ? [i] : []));
        if (fresh.length) this.actions.tumble(fresh);
      });
    });
  }

  protected fieldName(id: string): string {
    return kniffel.FIELDS_BY_ID[id]?.name ?? id;
  }
}
