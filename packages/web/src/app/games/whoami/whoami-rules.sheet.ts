import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-whoami-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Wer bin ich?" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Am Tisch</h3>
        <p>Jeder bekommt eine geheime Figur, die er selbst nicht sieht, die anderen aber schon. Das kann eine berühmte Person, eine Filmfigur, ein Tier oder ein Beruf sein. Reihum stellt jeder eine Frage, die mit „Ja“ oder „Nein“ beantwortet werden kann. Wer „Ja“ hört, darf weiterfragen.</p>
        <p>Wer glaubt zu wissen, wer er ist, tippt auf „Ich weiß es!“ und sagt es laut. Stimmt es, bleibt es dabei, sonst nimmt er es mit „Doch nicht“ zurück. Wer als Erster fertig ist, bekommt die meisten Punkte, der Letzte geht leer aus. Die Runde endet, wenn nur noch einer rät.</p>
        <p>Am Live-Tisch zeigt dein Handy alle Figuren außer deiner eigenen. Mit einem Handy tippst du bei den anderen auf „Figur zeigen“, während der Besitzer wegschaut.</p>
      </section>
      <section>
        <h3>Stirnraten</h3>
        <p>Ein Handy, ein Begriff auf dem Display. Wer dran ist, hält das Handy so an die Stirn, dass die anderen den Begriff sehen, er selbst aber nicht. Die anderen erklären ihn, ohne ihn zu nennen, und der Spieler rät.</p>
        <ul>
          <li>Richtig geraten: Handy nach unten neigen oder „Richtig“ tippen (das gibt einen Punkt)</li>
          <li>Überspringen: Handy nach oben neigen oder „Weiter“ tippen</li>
          <li>Neigen funktioniert nur, wenn du es vor dem Zug einschaltest und der Browser es erlaubt</li>
          <li>Wenn die Zeit um ist, zählen die richtigen Begriffe als Punkte. Dann ist der Nächste dran.</li>
        </ul>
      </section>
    </div>
  `,
})
export class WhoamiRulesSheet {}
