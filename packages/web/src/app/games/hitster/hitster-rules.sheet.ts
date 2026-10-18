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
        <p>Hat der Spieler am Zug den Platz gewählt, bestätigt er ihn. Danach können die anderen widersprechen (siehe Einspruch), und sobald alle entschieden haben, löst der Block von selbst auf und zeigt das Jahr. Liegt der Song richtig, bleibt die Karte im Zeitstrahl, sonst ist sie raus. Gleiche Jahre zählen immer als richtig. Wer zuerst das Ziel an Karten hat, gewinnt.</p>
      </section>
      <section>
        <h3>Token</h3>
        <div class="ritem">
          <div class="ritem-h"><b>Überspringen</b></div>
          <p>Vor dem Legen kannst du für Token einen Song überspringen und eine neue Karte ziehen.</p>
        </div>
        <div class="ritem">
          <div class="ritem-h"><b>Einspruch</b></div>
          <p>Nachdem der Spieler am Zug den Platz bestätigt hat, entscheidet jeder andere: Wer den Song anders einsortieren würde, widerspricht, setzt ein Token ein und tippt auf einen anderen Platz im Zeitstrahl, alle anderen sagen „Kein Einspruch“. Wer sich keinen Einspruch leisten kann, muss nichts tun. Pro Spieler ein Einspruch, und jeder Platz nur einmal. Haben alle entschieden, geht es automatisch weiter. Liegt der Spieler am Zug richtig, bleibt die Karte bei ihm. Liegt er falsch und ein Einspruch richtig, bekommt der Widersprechende die Karte in seinen eigenen Zeitstrahl, bei mehreren der Erste reihum nach dem Spieler am Zug. Das Token ist in jedem Fall weg. Wartet jemand nicht ab, beendet „Ohne Warten weiter“ die Runde.</p>
        </div>
        <div class="ritem">
          <div class="ritem-h"><b>Titel und Interpret</b></div>
          <p>Nach dem Auflösen stehen beide auf der Karte. Hat der Spieler am Zug sie vorher richtig genannt, bekommt er Token, einmal je Karte. Ob es stimmte, entscheidet die Runde, der Block zählt nur mit.</p>
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
