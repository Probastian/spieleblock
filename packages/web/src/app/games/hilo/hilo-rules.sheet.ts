import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-hilo-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Mehr oder weniger" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>Links siehst du ein Objekt mit seiner Zahl, zum Beispiel eine Stadt und ihre Einwohner. Rechts steht das nächste, dessen Zahl noch verborgen ist. Hat es mehr oder weniger als das linke? Tippe deinen Tipp.</p>
        <p>Danach wird die Zahl gezeigt. Wer richtig lag, bekommt einen Punkt und baut seine Serie aus. Wer falsch lag, verliert ein Leben. Das aufgedeckte Objekt ist jetzt das linke, und es geht weiter.</p>
      </section>
      <section>
        <h3>Spielende</h3>
        <ul>
          <li>Wer kein Leben mehr hat, scheidet aus. Mit mehreren Spielern gewinnt, wer am Ende die meisten Punkte hat, meistens der Letzte.</li>
          <li>Allein spielst du, bis das letzte Leben weg ist.</li>
          <li>Haben zwei Objekte genau dieselbe Zahl, sind beide Tipps richtig.</li>
        </ul>
      </section>
      <section>
        <h3>Gleichzeitig oder reihum</h3>
        <p>Gleichzeitig tippen alle in jeder Runde, am Live-Tisch jeder auf dem eigenen Handy. Reihum ist immer nur einer dran, praktisch mit einem Handy.</p>
      </section>
      <section>
        <h3>Woher die Zahlen kommen</h3>
        <p>Die Werte stammen aus Wikidata (frei verfügbar, CC0) und können vom aktuellen Stand abweichen.</p>
      </section>
    </div>
  `,
})
export class HiloRulesSheet {}
