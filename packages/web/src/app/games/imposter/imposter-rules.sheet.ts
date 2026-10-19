import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-imposter-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Imposter" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Ablauf einer Runde</h3>
        <p>Der Block zieht ein geheimes Wort. Alle bekommen es zu sehen, nur der Imposter nicht (je nach Einstellung kennt er die Kategorie). Niemand darf sein Wort laut sagen.</p>
        <p>Dann nennt reihum jeder einen Hinweis zum Wort, möglichst so, dass die Mitspieler merken, dass man es kennt, der Imposter aber nichts lernt. Der Imposter versucht mitzuhalten, ohne aufzufallen.</p>
        <p>Danach wird abgestimmt, wer der Imposter ist. Bei Gleichstand wird niemand verdächtigt. Wird der Imposter erwischt, darf er noch das Wort raten.</p>
      </section>
      <section>
        <h3>Punkte</h3>
        <ul>
          <li>Imposter, der nicht erwischt wird: 2 Punkte</li>
          <li>Erwischter Imposter, der das Wort errät: 1 Punkt</li>
          <li>Alle anderen: 1 Punkt, wenn sie einen Imposter verdächtigt haben</li>
        </ul>
      </section>
      <section>
        <h3>Mit einem Handy oder am Live-Tisch</h3>
        <ul>
          <li>Am Live-Tisch sieht jeder seine Rolle nur auf dem eigenen Handy und stimmt dort geheim ab.</li>
          <li>Mit einem Handy wird es reihum weitergegeben: Rolle ansehen, „Verstanden“, weiterreichen. Abgestimmt wird danach laut, und die Runde trägt den Verdächtigen ein.</li>
          <li>Bei mehr als einem Imposter wissen die Imposter nicht voneinander.</li>
        </ul>
      </section>
    </div>
  `,
})
export class ImposterRulesSheet {}
