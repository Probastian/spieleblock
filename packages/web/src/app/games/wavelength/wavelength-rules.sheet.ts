import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-wavelength-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Wavelength" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>Zwischen zwei Gegensätzen, zum Beispiel „kalt“ und „heiß“, liegt ein geheimes Ziel. Nur wer den Hinweis gibt, sieht es. Er denkt sich einen Hinweis aus (ein Wort oder eine kurze Wendung), der zeigt, wo zwischen den beiden Polen das Ziel liegt. Die anderen stellen den Regler dorthin, wo sie das Ziel vermuten.</p>
        <p>Danach wird aufgedeckt. In der nächsten Runde gibt der Nächste den Hinweis.</p>
      </section>
      <section>
        <h3>Punkte</h3>
        <ul>
          <li>Mitten im Ziel (bis 5 % daneben): 4 Punkte</li>
          <li>Nah dran (bis 11 %): 3 Punkte</li>
          <li>Noch im Feld (bis 18 %): 2 Punkte</li>
          <li>Weiter weg: nichts</li>
        </ul>
        <p>Jeder für sich: Wer den Hinweis gibt, bekommt den Durchschnitt der Raterpunkte. Gemeinsam: Alle bekommen die Punkte des einen Reglers.</p>
      </section>
      <section>
        <h3>Spielarten</h3>
        <ul>
          <li><b>Jeder für sich:</b> Jeder stellt auf dem eigenen Handy seinen Regler ein und macht ihn fest. Mit einem Handy wird es reihum weitergegeben.</li>
          <li><b>Gemeinsam:</b> Wie im Brettspiel. Alle beraten, einer stellt den einen Regler ein.</li>
        </ul>
      </section>
    </div>
  `,
})
export class WavelengthRulesSheet {}
