import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { wizard } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { WizardRulesSheet } from './wizard-rules.sheet';

type Options = wizard.WizardOptions;

@Component({
  selector: 'sb-wizard-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="hL">
      <h2 class="lbl" id="hL">Spiellänge</h2>
      <div class="variants">
        <button class="vopt" type="button" [attr.aria-pressed]="options().len !== 'short'" (click)="set('full')"><span class="vname">Komplett</span><span class="vdesc">{{ describe('full') }}</span></button>
        <button class="vopt" type="button" [attr.aria-pressed]="options().len === 'short'" (click)="set('short')"><span class="vname">Kurz</span><span class="vdesc">{{ describe('short') }}</span></button>
      </div>
      <p class="note" style="margin: 0">
        Der erste Spieler gibt in Runde 1, danach wechselt der Geber reihum. Wizard geht mit 3 bis 6 Spielern.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rules)">So wird gezählt</button>
      </p>
    </section>
  `,
})
export class WizardSetup {
  /** Anzahl gewählter Spieler: bestimmt die Rundenzahl. */
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly sheets = inject(SheetService);
  protected readonly rules = WizardRulesSheet;
  protected readonly options = computed(() => this.store.options<Options>('wizard'));

  protected set(len: Options['len']): void {
    this.store.setGameOptions<Options>('wizard', { len });
  }

  protected describe(len: Options['len']): string {
    const n = this.playerCount();
    const full = n >= 3 && n <= 6 ? Math.floor(60 / n) : 0;
    if (full) return `${len === 'full' ? full : Math.ceil(full / 2)} Runden bei ${n} Spielern`;
    return len === 'full' ? '60 geteilt durch die Spielerzahl, also 10 bis 20 Runden' : 'Halb so viele Runden, ein kürzerer Abend';
  }
}
