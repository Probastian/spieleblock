import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { wavelength } from '@spieleblock/games';
import { Store } from '../../core/state/store.service';
import { SheetService } from '../../core/ui/sheet.service';
import { WavelengthRulesSheet } from './wavelength-rules.sheet';

type Options = wavelength.WavelengthOptions;

@Component({
  selector: 'sb-wavelength-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="wA">
      <h2 class="lbl" id="wA">Spielart</h2>
      <div class="variants">
        <button class="vopt" type="button" [attr.aria-pressed]="!options().team" (click)="set({ team: false })"><span class="vname">Jeder für sich</span><span class="vdesc">Eigener Regler auf dem eigenen Handy</span></button>
        <button class="vopt" type="button" [attr.aria-pressed]="options().team" (click)="set({ team: true })"><span class="vname">Gemeinsam</span><span class="vdesc">Alle beraten, ein Regler für alle</span></button>
      </div>
    </section>

    <section class="card" aria-labelledby="wL">
      <h2 class="lbl" id="wL">Durchgänge</h2>
      <div class="chips" style="margin-top: 0">
        @for (v of laps; track v) {
          <button type="button" class="chip" [class.txt]="!v" [attr.aria-pressed]="options().laps === v" (click)="set({ laps: v })">{{ v || 'Offen' }}</button>
        }
      </div>
      <p class="note" style="margin: 0">
        So oft gibt jeder Spieler einen Hinweis{{ playerCount() && options().laps ? ' (' + playerCount() * options().laps + ' Runden)' : '' }}. 2 bis 8 Spieler.
        <button class="link" type="button" style="display: inline; padding: 0; font-size: inherit" (click)="sheets.open(rulesSheet)">So wird gespielt</button>
      </p>
    </section>
  `,
})
export class WavelengthSetup {
  readonly playerCount = input(0);
  private readonly store = inject(Store);
  protected readonly sheets = inject(SheetService);
  protected readonly rulesSheet = WavelengthRulesSheet;
  protected readonly laps = [1, 2, 3, 0];
  protected readonly options = computed(() => this.store.options<Options>('wavelength'));

  protected set(patch: Partial<Options>): void {
    this.store.setGameOptions<Options>('wavelength', patch);
  }
}
