import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-film-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Film-Zeitstrahl" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>Jeder startet mit einem Film im eigenen Zeitstrahl, die ältesten links. Wer dran ist, zieht eine Karte und sieht Plakat und Titel, aber nicht das Jahr. Dann sortiert er den Film an die richtige Stelle ein: vor den ersten Film, zwischen zwei Filme oder hinter den letzten.</p>
        <p>Danach können die anderen widersprechen (siehe Token), und der Block löst auf und zeigt das Erscheinungsjahr. Liegt der Film richtig, bleibt die Karte im Zeitstrahl, sonst ist sie raus. Gleiche Jahre zählen immer als richtig. Wer zuerst das Ziel an Karten hat, gewinnt.</p>
      </section>
      <section>
        <h3>Token</h3>
        <p>Überspringen, Einspruch und Karte kaufen funktionieren wie bei Hitster. Den Bonus für „Titel und Interpret“ gibt es hier nicht, der Titel steht ja auf der Karte.</p>
      </section>
      <section>
        <h3>Jahre</h3>
        <ul>
          <li>Gezählt wird das Jahr des Kinostarts im Ursprungsland. Bei manchen Filmen nennen Datenbanken das Festivaljahr. Stimmt ein Jahr nicht, tippe nach dem Auflösen auf „Jahr stimmt nicht?“. Die Korrektur bleibt für alle künftigen Spiele.</li>
          <li>Die Liste „Bekannte Filme“ ist im Block eingebaut. Weitere Listen (Jahrzehnte, deutsche Filme, Animation) gibt es, wenn der Server einen TMDB-Zugang hat.</li>
        </ul>
        <p>Dieses Produkt verwendet die TMDB-API, wird aber von TMDB weder unterstützt noch zertifiziert.</p>
      </section>
    </div>
  `,
})
export class FilmRulesSheet {}
