# Architektur

## Überblick

```
 Browser (Angular)                         Server (Node)
 ┌──────────────────────────┐              ┌──────────────────────────────┐
 │ Oberfläche (Komponenten) │              │ http/api      REST + SSE     │
 │   features/  games/      │              │ http/static   App ausliefern │
 │ Zustand: Store (Signals) │  HTTP + SSE  │ store/        Dokumente      │
 │ SyncService  TableService│ <──────────> │   Journal, Snapshot, Backup  │
 │ localStorage (Zwischen-  │              │ auth, rate-limit, stream-hub │
 │ speicher, offline)       │              └──────────────────────────────┘
 └───────────┬──────────────┘
             │ importiert
   @spieleblock/games   (Engines)        @spieleblock/shared  (Protokoll)
```

Der Server kennt keine Spielregeln. Er speichert JSON-Dokumente unter Pfaden und meldet Änderungen an Abonnenten. Alle Logik eines Spiels steckt in einer Engine, die Oberfläche kennt nur deren Schnittstelle.

## Pakete

### `shared`
Alles, was Server und App übereinstimmend wissen müssen: erlaubte Dokumentpfade (`paths.ts`), Header- und Endpunktnamen, Typen der Nachrichten (`protocol.ts`), Gerätekennung (`device-key.ts`) und der Dreiwege-Merge für den Live-Tisch (`merge.ts`). Ändert sich das Protokoll, bricht der Compiler auf beiden Seiten.

### `games`
Reine Funktionen auf Datenobjekten, ohne Angular und ohne DOM, daher gut testbar.

* `core/` ist spielunabhängig: Typen (`BaseGame`), der Vertrag `GameEngine`, Rangliste, Beenden/Wiederöffnen, Bereinigung fremder Dokumente (`sanitizeGame`), Statistik, Rekorde und Entwicklungs-Diagramm.
* `kniffel/`, `wizard/`, `tafel/` je mit `game.ts` (Zustand und Operationen) und `engine.ts` (Anbindung an den Vertrag).
* `registry.ts` listet alle Engines.

Operationen ändern ein übergebenes Spiel direkt (`kniffel.commit(draft, …)`). Wer sie aufruft, übergibt eine Kopie, siehe Store.

### `server`
Aufgeteilt nach Aufgaben: `config`, `auth`, `rate-limit`, `store/document-store` (Speicher, Journal, Snapshot, Backups, Aufräumen), `http/api`, `http/stream-hub` (Live-Verbindungen), `http/static`, `app.ts` (setzt alles zusammen), `main.ts` (Umgebung, Signale). Gebaut wird mit esbuild zu einer einzigen Datei.

### `web`
```
src/app/
  core/        Dienste ohne Oberfläche
    api/         HTTP, Live-Stream (SSE), Datenbank-Zugriff, Gerätekennung, Zugangscode
    state/       Store (Zustand), SyncService (Abgleich), Backup, Modelle
    table/       TableService (Live-Tisch)
    ui/          Toast, Sheets, Wake-Lock, Konfetti
    util/        kleine Helfer
  shared/      wiederverwendbare Bausteine (Würfel, Symbole, Diagramm, Sheet-Kopf …)
  shell/       Wurzel-Bausteine (Sheet-Host, Toast, Konfetti, Zugangscode-Abfrage)
  features/    Seiten: hub (Spiele, Spieler, Verlauf), setup, play (+ Spielmenü, Ende), table
  games/       Oberfläche je Spiel: kniffel/, wizard/, tafel/ und die Registry
  styles/      globales CSS in der Reihenfolge der Kaskade
```

## Zustand und Speicherung

Der **Store** hält Spielerliste, Einstellungen und alle Spiele in Signals. Änderungen gehen nur über `updateMeta` und `updateGame(id, fn)`: Der Store legt eine Kopie an, `fn` verändert sie, danach wird sie als neue Fassung abgelegt, mit neuer Änderungszeit markiert und im Browser zwischengespeichert. So lösen Signals zuverlässig aus, und die Engines bleiben einfache Funktionen.

Der **SyncService** überträgt markierte Dokumente zum Server (`flush`) und holt den Stand des Servers (`pull`). Beim Zusammenführen gewinnt die Fassung mit der neueren Änderungszeit; ohne Server bleibt alles lokal und wird später nachgereicht.

Dokumentpfade (siehe `shared/paths.ts`):

| Pfad | Inhalt | Zugriff |
|---|---|---|
| `data/users/<uid>/meta` | Spieler und Einstellungen | nur mit der passenden Gerätekennung |
| `data/users/<uid>/meta/games/<id>` | ein Spiel | wie oben |
| `tables/<CODE>` | geteiltes Spiel eines Live-Tischs | jeder mit Zugang |
| `tables/<CODE>/seats/<farbe>` | besetzter Platz | jeder mit Zugang |

`<uid>` ist ein Hash der Gerätekennung, die der Browser beim ersten Start erzeugt. Die Kennung selbst verlässt das Gerät nur als Header zum eigenen Server.

## Live-Tisch

Jedes Gerät hat eine lokale Kopie des Spiels. Der `TableService` lädt Änderungen nach kurzer Pause hoch. Dabei werden letzter gemeinsamer Stand, eigene und fremde Fassung per Dreiwege-Merge verbunden, damit gleichzeitige Eingaben verschiedener Spieler nicht überschreiben. Die Live-Verbindung (SSE) meldet Änderungen anderer sofort. Felder, die nur ein Gerät betreffen (Rückgängig-Verlauf, angezeigter Spieler, bei Kniffel die Eingabeart), gehören nicht in die geteilte Fassung; jede Engine nennt sie in `localKeys`.

## Oberfläche

* Routen: `/spiele`, `/spieler`, `/verlauf`, `/neu/:type`, `/spiel/:id`. Seiten werden bei Bedarf geladen.
* Dialoge sind **Sheets** (`SheetService`): gewöhnliche Komponenten, die von unten einfahren.
* Eine Spielseite lädt das Blatt der jeweiligen Art über die **Registry** (`games/registry.ts`). Gemeinsames liegt im `PlayContext` (aktuelles Spiel, Rückgängig, Beenden, Revanche).
* Das Aussehen steckt in CSS-Dateien unter `styles/` und je Spiel in der Komponente; die Reihenfolge der Importe in `styles.css` bestimmt die Kaskade.

## Tests

* `games`: Regeln, Abläufe, Statistik (Vitest)
* `shared`: Pfadregeln, Merge
* `server`: Speicher (Journal, Absturz, Backup, Aufräumen) und echte HTTP-Aufrufe, inklusive Live-Verbindung
* `web`: reine Logik (Diagramm, Modelle) mit `ng test`

Die Oberfläche selbst wird per Hand und mit Browser-Tests geprüft; die Engines enthalten bewusst die Logik, damit die Oberfläche dünn bleibt.
