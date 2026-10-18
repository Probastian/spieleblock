import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SheetHeadComponent } from '../../shared/ui/sheet-head.component';

@Component({
  selector: 'sb-hitster-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent],
  template: `
    <sb-sheet-head eyebrow="Hitster" title="So wird gespielt" />
    <div class="rules">
      <section>
        <h3>Ablauf</h3>
        <p>Jeder startet mit einer Karte im eigenen Zeitstrahl, die ältesten Songs oben. Wer dran ist, zieht eine Karte und hört den Song, ohne Titel und Jahr zu sehen. Dann sortiert er ihn in seinen Zeitstrahl ein: vor die erste Karte, zwischen zwei Karten oder hinter die letzte.</p>
        <p>Beim Auflösen zeigt der Block das Jahr. Liegt der Song richtig, bleibt die Karte im Zeitstrahl, sonst ist sie raus. Gleiche Jahre zählen immer als richtig. Wer zuerst das Ziel an Karten hat, gewinnt.</p>
      </section>
      <section>
        <h3>Token</h3>
        <div class="ritem">
          <div class="ritem-h"><b>Überspringen</b></div>
          <p>Vor dem Legen kannst du für Token einen Song überspringen und eine neue Karte ziehen.</p>
        </div>
        <div class="ritem">
          <div class="ritem-h"><b>Titel und Interpret</b></div>
          <p>Wer beides richtig nennt, bekommt Token. Ob es stimmt, entscheidet die Runde, der Block zählt nur mit.</p>
        </div>
        <div class="ritem">
          <div class="ritem-h"><b>Karte kaufen</b></div>
          <p>Für Token gibt es die oberste Karte des Stapels, sie wird gleich richtig einsortiert. Die Kosten stellst du beim Einrichten ein, auch „Aus“.</p>
        </div>
      </section>
      <section>
        <h3>Jahre</h3>
        <ul>
          <li>Spotify nennt oft das Jahr des Albums, nicht das Original. Der Block gleicht die Jahre mit MusicBrainz ab und markiert unsichere Songs mit „Prüfen“.</li>
          <li>Stimmt ein Jahr trotzdem nicht, tippe nach dem Auflösen auf „Jahr stimmt nicht?“. Die Karte wird neu bewertet und die Korrektur bleibt für alle künftigen Spiele.</li>
          <li>Am Live-Tisch spielt jeder auf seinem Handy, aber nur wer dran ist, kann legen. Wer „Auf diesem Gerät abspielen“ einschaltet, hört den Song über sein Spotify-Gerät.</li>
        </ul>
      </section>
    </div>
  `,
})
export class HitsterRulesSheet {}
