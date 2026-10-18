import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-wizard-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Wizard" title="So wird gezählt" />
    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>In Runde 1 bekommt jeder 1 Karte, in Runde 2 zwei Karten und so weiter. Gespielt werden 60 geteilt durch die Spielerzahl Runden, also 20 bei 3, 15 bei 4, 12 bei 5 und 10 bei 6 Spielern.</p>
        <p>Nach dem Geben sagt jeder an, wie viele Stiche er gewinnen will. Es beginnt der Spieler links vom Geber. Die Ansagen dürfen zusammen nicht genau der Kartenzahl entsprechen, es wird also immer zu viel oder zu wenig angesagt. Das ist die Aufgabe des Gebers, der als Letzter ansagt. Danach wird gespielt und gezählt. Der Geber wechselt jede Runde reihum.</p>
      </section>
      <section>
        <h3>Punkte</h3>
        <div class="ritem">
          <div class="ritem-h"><b>Ansage getroffen</b><span>20 + 10 je Stich</span></div>
          <p>Wer genau so viele Stiche macht wie angesagt, bekommt 20 Punkte plus 10 für jeden Stich. Angesagt und geholt 2: 40 Punkte. Angesagt 0 und leer ausgegangen: 20 Punkte.</p>
        </div>
        <div class="ritem">
          <div class="ritem-h"><b>Ansage verfehlt</b><span>−10 je Stich Abweichung</span></div>
          <p>Wer danebenliegt, verliert 10 Punkte für jeden Stich Unterschied, egal ob zu viele oder zu wenige. Angesagt 3 und 1 geholt: −20 Punkte.</p>
        </div>
      </section>
      <section>
        <h3>So nutzt du den Block</h3>
        <ul>
          <li>Vor dem Spielen trägst du die Ansagen ein. Danach spielt ihr die Runde.</li>
          <li>Danach trägst du die echten Stiche ein. Sie sind schon mit den Ansagen vorbelegt, du änderst nur die Abweichungen. Die Stiche müssen zusammen der Kartenzahl entsprechen.</li>
          <li>Das Diagramm zeigt, wie sich die Punktestände Runde für Runde entwickeln. Tippe oder fahre mit dem Finger darüber, um die Werte zu sehen.</li>
        </ul>
      </section>
    </div>
  `,
})
export class WizardRulesSheet {}
