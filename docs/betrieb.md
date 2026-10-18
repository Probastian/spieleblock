# Betrieb

Für den laufenden Dienst: Einstellungen, Daten und Backups, Updates, Datenschutz, Fehlersuche. Die Installation steht in [deployment.md](deployment.md).

## Einstellungen

Alle Einstellungen sind Umgebungsvariablen: in `docker-compose.yml` unter `environment:`, bei systemd als `Environment=`-Zeilen. Nach einer Änderung den Dienst neu starten (`docker compose up -d` bzw. `systemctl restart spieleblock`).

| Variable | Standard | Bedeutung |
|---|---|---|
| `UPDATE_FROM_UI` | leer | `1` erlaubt der App, eine Update-Prüfung anzufordern (versteckter Knopf, siehe [Updates](#automatisch-auf-dem-server)). Braucht die Path-Unit aus `deploy/`, nur ohne Docker. |
| `SPOTIFY_CLIENT_ID` | leer | Client-ID der Spotify-App für Hitster, siehe [Hitster einrichten](#hitster-einrichten-spotify). Ohne sie bleibt Hitster ohne Spotify. |
| `ACCESS_KEY` | leer | Zugangscode. Wenn gesetzt, fragt die App danach (wird im Browser gemerkt). Die Seite selbst ist öffentlich, die Daten nicht. |
| `PORT` | `3000` | Port des Servers |
| `HOST` | `0.0.0.0` | Adresse, auf der der Server lauscht (`127.0.0.1`, wenn nur ein lokaler Proxy davor steht) |
| `DATA_DIR` | `/data` (Docker) | Ordner für Daten und Backups |
| `PUBLIC_DIR` | `public` neben `server.mjs` | Ordner mit der gebauten Web-App |
| `TABLE_TTL_DAYS` | `30` | Live-Tische ohne Aktivität werden nach so vielen Tagen gelöscht (`0` = nie). Spieler und Spiele der Nutzer sind davon **nicht** betroffen. |
| `BACKUP_KEEP` | `14` | Anzahl der aufbewahrten Tagesbackups |
| `MAX_DOC_BYTES` | `262144` | Maximale Größe eines Dokuments (256 KB) |
| `MAX_DOCS` | `50000` | Maximale Anzahl Dokumente insgesamt |
| `RATE_PER_MIN` | `1200` | Anfragen pro Minute und IP |
| `LOG` | `1` | `0` schaltet die Protokollausgabe ab |

## Hitster einrichten (Spotify)

Hitster liest Playlists aus Spotify und startet die Songs auf einem Spotify-Gerät. Dafür braucht der Block eine eigene Spotify-App. Das ist einmalig und kostenlos, aber an Bedingungen von Spotify geknüpft.

1. Auf [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) mit dem Spotify-Konto einloggen und **Create app** wählen. Bei „APIs used“ **Web API** ankreuzen.
2. Als **Redirect URI** genau diese Adresse eintragen, mit deiner Domain und ohne Schrägstrich am Ende: `https://spiele.deinedomain.de/spotify`. Sie muss `https` haben.
3. Die **Client ID** der App in `docker-compose.yml` (`SPOTIFY_CLIENT_ID`) bzw. in die systemd-Datei eintragen und den Dienst neu starten. Die Client-ID ist kein Geheimnis, ein Client-Secret braucht der Block nicht.
4. In der Spotify-App unter **User Management** jede Person eintragen, die sich im Block bei Spotify anmelden soll (Name und Mail ihres Spotify-Kontos). Sonst lehnt Spotify die Anmeldung ab.

**Bedingungen von Spotify** (Stand Februar 2026, sie können sich ändern):

* Der **Besitzer der Spotify-App braucht Premium.** Läuft das Abo aus, hört Hitster auf zu funktionieren, bis es wieder aktiv ist.
* Im Entwicklermodus sind **höchstens 5 Personen** freigeschaltet. Das betrifft nur, wer sich im Block mit Spotify anmeldet.
* **Wer Musik abspielen lässt, braucht Premium.** Die Wiedergabe läuft über Spotify Connect, und Spotify erlaubt das nur mit Premium.

Wer am Live-Tisch nur mitspielt, muss sich nicht anmelden: Es genügt, wenn ein Gerät den Stapel lädt und ein Gerät die Musik abspielt.

**Jahre.** Spotify nennt oft das Jahr des Albums, bei Sammlern und Neuauflagen also nicht das Original. Deshalb fragt der Browser beim Prüfen die freie Datenbank [MusicBrainz](https://musicbrainz.org) nach dem frühesten Erscheinungsjahr. Das Ergebnis speichert der Block in den Einstellungen des Nutzers, jeder Song wird nur einmal gesucht. MusicBrainz erlaubt etwa eine Anfrage pro Sekunde, parallele Anfragen helfen deshalb nicht. Der Block fragt darum in zwei Stufen: Zuerst je 20 Songs gebündelt über ihre ISRC (eine Anfrage für alle 20), dann einzeln nach Titel und Interpret nur dort, wo das Albumjahr falsch sein kann (Remaster, Sammler, „Best of“, Deluxe) oder die ISRC nichts ergab. Die Prüfung läuft im Hintergrund, man kann schon vorher spielen.

## Daten und Backups

Alles liegt im `DATA_DIR` (bei Docker im Volume `spieleblock-data`):

| Datei | Inhalt |
|---|---|
| `snapshot.json` | vollständiger Stand zum letzten Zusammenführen |
| `journal.jsonl` | alle Änderungen seitdem, eine pro Zeile |
| `backups/JJJJ-MM-TT.json` | täglich ein vollständiger Stand, die letzten `BACKUP_KEEP` bleiben |

Jede Änderung geht zuerst ins Journal; beim Beenden und nach vielen Änderungen werden Journal und Snapshot zusammengeführt. Ein Absturz oder Stromausfall verliert nichts, eine halb geschriebene letzte Zeile wird beim Start ignoriert.

**Sichern.** Der Datenordner ist alles, was gesichert werden muss. In Proxmox deckt der normale Backup-Job der VM bzw. des LXC das mit ab. Von Hand:

```bash
docker cp spieleblock:/data ./spieleblock-backup          # Docker
cp -r /var/lib/spieleblock ./spieleblock-backup           # systemd
```

Zusätzlich kann jeder Nutzer in der App unter **Gespeichert → Backup herunterladen** seine eigenen Spieler und Spiele als Datei sichern und dort wieder einspielen.

**Zurückspielen.** Dienst stoppen, gewünschte Datei aus `backups/` als `snapshot.json` ablegen, `journal.jsonl` löschen, Dienst starten:

```bash
docker compose stop
docker run --rm -v spieleblock_spieleblock-data:/data alpine sh -c \
  'cp /data/backups/2026-10-01.json /data/snapshot.json && rm -f /data/journal.jsonl'
docker compose start
```

(Den Volume-Namen zeigt `docker volume ls`; er beginnt mit dem Ordnernamen des Projekts.)

**Umziehen.** Dienst stoppen, `DATA_DIR` auf den neuen Server kopieren, dort mit demselben Ordner starten. Nutzer behalten alles, solange die Adresse für ihre Browser gleich bleibt oder sie ihre Gerätekennung eintragen (App: **Gespeichert → Gerätekennung**).

## Updates

### Release erstellen

Auf GitHub unter **Actions → Release → Run workflow**. Optional einen Commit-Hash angeben (leer = neuester Commit des Standard-Branches) und wählen, ob Patch-, Minor- oder Major-Version hochgezählt wird. Der Workflow führt `npm run check` aus und legt dann an:

* das GitHub-Release `vX.Y.Z` mit automatisch erzeugten Änderungsnotizen,
* daran das Paket `spieleblock-vX.Y.Z.tar.gz` (`server.mjs` und `public/`) für die Installation ohne Docker,
* das Docker-Image `ghcr.io/probastian/spieleblock` mit den Tags `X.Y.Z` und `latest` (amd64 und arm64).

Die Version steht unten im Hauptmenü der App. Der Server liest sie aus `APP_VERSION` oder der Datei `VERSION` neben `server.mjs` (Paket und Image legen sie an); ohne beides zeigt die App `dev`.

Das erste Release bekommt die Version aus der `package.json`. Das Docker-Image ist nach dem ersten Release zunächst privat: In den Paket-Einstellungen auf GitHub auf *Public* stellen, sonst muss der Server sich bei `ghcr.io` anmelden.

### Automatisch auf dem Server

Der Server prüft alle 2 Minuten, ob es ein neues Release gibt, und installiert es. Dafür dient `deploy/update.sh` mit einem systemd-Timer; er läuft auf dem Docker-Host bzw. im LXC. Die Prüfung ist leicht: Sie fragt nur die Weiterleitung von `github.com/<repo>/releases/latest` ab, nicht die GitHub-API (die ohne Anmeldung auf 60 Anfragen pro Stunde begrenzt ist). Im Journal steht nur etwas, wenn wirklich aktualisiert wurde.

```bash
cp deploy/update.sh /usr/local/sbin/spieleblock-update && chmod +x /usr/local/sbin/spieleblock-update
cp deploy/spieleblock-update.service deploy/spieleblock-update.timer /etc/systemd/system/
```

* **Ohne Docker:** Nichts weiter einstellen (`MODE=systemd` ist voreingestellt). Das Skript lädt das Paket des neuesten Releases nach `/opt/spieleblock` und startet den Dienst neu. Die installierte Version steht in `/opt/spieleblock/VERSION`. Gebraucht wird nur `curl`.
* **Mit Docker:** In `/etc/systemd/system/spieleblock-update.service` die Zeile `MODE=systemd` durch `MODE=docker` ersetzen und `COMPOSE_DIR` auf den Ordner mit der `docker-compose.yml` setzen. Das Skript zieht das Image `latest` und erstellt den Container nur neu, wenn es sich geändert hat. Bei Docker holt der Timer alle 2 Minuten das Image-Manifest; wer das nicht möchte, ändert in `deploy/spieleblock-update.timer` `OnUnitActiveSec`.

Dann den Timer einschalten und einmal von Hand prüfen:

```bash
systemctl daemon-reload && systemctl enable --now spieleblock-update.timer
systemctl start spieleblock-update.service && journalctl -u spieleblock-update -n 20
systemctl list-timers spieleblock-update
```

Der Dienst startet beim Update kurz neu (wenige Sekunden); offene Browser verbinden sich selbst wieder.

**Update aus der Oberfläche (nur ohne Docker).** Wer nicht bis zum nächsten Timer-Lauf warten will, tippt im Hauptmenü **fünfmal schnell auf die Versionsnummer** unten. Es öffnet sich ein verstecktes Fenster „Updates“ mit dem Knopf *Jetzt nach Update suchen*; die App zeigt das Ergebnis an und lädt nach einer Installation von selbst neu. Einrichten:

```bash
cp deploy/spieleblock-update.path /etc/systemd/system/
systemctl edit spieleblock            # eintragen:  [Service]  und  Environment=UPDATE_FROM_UI=1
systemctl daemon-reload && systemctl enable --now spieleblock-update.path && systemctl restart spieleblock
```

So funktioniert das, ohne dem Server Rechte zu geben: Der Server läuft weiter ohne Root und kann nur die Datei `update-request` im Datenordner anlegen. Die Path-Unit `spieleblock-update.path` sieht sie und startet `spieleblock-update.service`, also dasselbe Skript wie der Timer, als root. Das Skript löscht die Datei, prüft, installiert gegebenenfalls und schreibt das Ergebnis nach `update-status.json` (im Datenordner), das der Server der App zeigt. Die App kann weder eine Version noch eine Quelle vorgeben, nur „jetzt prüfen“ anstoßen; Anforderungen werden auf eine alle 10 Sekunden begrenzt, und mit gesetztem `ACCESS_KEY` braucht auch das den Zugangscode. Liegt der Datenordner nicht unter `/var/lib/spieleblock`, den Pfad in `spieleblock-update.path` und `DATA_DIR` in `spieleblock-update.service` anpassen.

### Von Hand

```bash
git pull
docker compose pull && docker compose up -d      # Docker, neuestes Release-Image
docker compose up -d --build                     # Docker, selbst bauen
```

Bei systemd: `spieleblock-update` aufrufen (siehe oben) oder selbst bauen (`npm ci && npm run build`), `packages/server/dist/server.mjs` und `public/` nach `/opt/spieleblock` kopieren, `systemctl restart spieleblock`.

Die Daten bleiben. Geöffnete Browser laden die neue Version beim nächsten Öffnen; ist die Seite danach merkwürdig, einmal hart neu laden (Strg/Cmd+Shift+R). Das Datenformat ist über den Umbau auf Angular hinweg unverändert, vorhandene Daten laufen weiter.

## Überwachung

* **Lebenszeichen:** `GET /healthz` antwortet `ok`. Der Docker-Healthcheck nutzt genau das; für Uptime-Monitore (Uptime Kuma o. Ä.) ebenfalls geeignet.
* **Logs:** `docker compose logs -f` bzw. `journalctl -u spieleblock -f`. Beim Start steht dort, wie viele Dokumente geladen wurden; dazu kommen Meldungen zu Tagesbackups und entfernten alten Tischen.
* **Speicher:** Der Dienst hält alle Dokumente im Arbeitsspeicher. Für einen Freundeskreis sind das wenige MB; das Limit `MAX_DOCS` schützt vor Ausufern.

## Datenschutz und Sicherheit

* **Keine Konten, keine Mailadressen, kein Tracking.** Schriften und alles andere kommen vom eigenen Server. Einzige Ausnahme ist **Hitster**: Der Browser spricht dann direkt mit Spotify (Anmeldung, Playlists, Wiedergabe) und MusicBrainz (Jahre). MusicBrainz erfährt dabei Titel und Interpret der geprüften Songs und die IP-Adresse des Geräts. Außerdem lädt der Browser die Albumcover von Spotifys Bilderserver (`i.scdn.co`), die Adresse der Bilder steht im Spiel. Der Server des Blocks sieht davon nichts.
* **Spotify-Anmeldungen bleiben auf dem Gerät.** Die Zugangsdaten für Spotify liegen nur im Browser des jeweiligen Geräts und werden weder zum Server noch zu anderen Geräten übertragen. „Von Spotify abmelden“ im Spiel löscht sie.
* **Gespeichert wird:** Spielernamen, Farben, Einstellungen und Spiele, dazu offene Live-Tische. Jeder Nutzer bleibt unter einer zufälligen Gerätekennung; der Server kennt nur einen Hash davon.
* **Schutz der Nutzerdaten:** Nur wer die Gerätekennung kennt, kann die Spieler und Spiele dieser Kennung lesen oder ändern. Die Kennung ist wie ein Passwort zu behandeln.
* **Live-Tische sind offen:** Wer den fünfstelligen Code kennt (und den Dienst erreicht), kann am Tisch mitlesen und mitschreiben. Das ist für den Spieleabend gedacht. Wer den Dienst im Internet betreibt, setzt `ACCESS_KEY`, damit Fremde gar nicht erst hineinkommen.
* **Daten liegen unverschlüsselt** im Datenordner und in den Backups. Backups also wie die Daten selbst behandeln.
* **Härtung:** Der Docker-Container läuft ohne Root-Rechte, mit schreibgeschütztem Dateisystem und ohne zusätzliche Linux-Fähigkeiten; die systemd-Datei sperrt `/home` und alles außer dem Datenordner. Anfragen sind pro IP begrenzt (`RATE_PER_MIN`), Dokumente in der Größe (`MAX_DOC_BYTES`) und Anzahl.

## Fehlersuche

| Problem | Ursache / Lösung |
|---|---|
| Oben steht „Nur lokal“ | Der Server ist nicht erreichbar. Adresse und Proxy prüfen. Die App versucht es alle 20 Sekunden erneut. |
| Oben steht „Wartet auf Sync“ | Kurz offline. Nichts geht verloren, die App versucht es alle 20 Sekunden erneut. |
| Live-Änderungen kommen verzögert an | Der Proxy puffert den Event-Stream: Einstellungen aus [deployment.md](deployment.md) übernehmen. Cloudflare-Proxy testweise auf „DNS only“ stellen. |
| Zugangscode-Abfrage erscheint immer wieder | Der Browser blockiert Speicherung (privater Modus). |
| „Keinen Tisch mit diesem Code gefunden“ | Code falsch getippt oder der Tisch wurde vom Gastgeber beendet bzw. war länger als `TABLE_TTL_DAYS` inaktiv. |
| „App installieren“ fehlt | Die Adresse hat kein `https://`. |
| Seite lädt nach Update alt/kaputt | Hart neu laden. Der Offline-Speicher (Service Worker) holt neue Dateien beim nächsten Start. |
| `docker compose` meldet „Port belegt“ | In `docker-compose.yml` den linken Port ändern, z. B. `"3100:3000"`. |
| Container startet nicht, Log: „Snapshot nicht lesbar“ | `snapshot.json` ist beschädigt. Aus `backups/` zurückspielen (siehe oben). |
| Hitster: „noch nicht mit einer Spotify-App verbunden“ | `SPOTIFY_CLIENT_ID` ist nicht gesetzt oder der Dienst wurde nach dem Eintragen nicht neu gestartet. |
| Hitster: Spotify-Anmeldung scheitert oder zeigt „INVALID_CLIENT: Invalid redirect URI“ | Die Redirect URI in der Spotify-App stimmt nicht genau mit `https://<Domain>/spotify` überein, oder die Seite wird unter einer anderen Adresse geöffnet. |
| Hitster: „Spotify verweigert den Zugriff“ | Das Konto steht nicht unter **User Management** der Spotify-App (höchstens 5), oder der Besitzer der App hat kein Premium mehr. |
| Hitster: „Kein Spotify-Gerät gefunden“ | Auf dem Gerät muss die Spotify-App offen sein und kurz etwas gespielt haben. Dann im Spiel unter Menü, Wiedergabe, „Geräte suchen“. |
| Hitster: „braucht das Spotify-Konto Premium“ | Spotify erlaubt die Fernsteuerung nur mit Premium. |
| Hitster: Jahresprüfung bricht ab („MusicBrainz antwortet gerade nicht“) | MusicBrainz ist überlastet. „Weiter prüfen“ später nochmal, bis dahin gilt das Spotify-Jahr. |
| „Updates“-Fenster: „nicht eingerichtet“ | `UPDATE_FROM_UI=1` fehlt am Server, oder der Dienst wurde danach nicht neu gestartet. |
| „Updates“-Fenster: „Keine Antwort vom Update-Dienst“ | Die Path-Unit läuft nicht: `systemctl status spieleblock-update.path`. Prüfen, ob `/var/lib/spieleblock/update-request` entsteht und der Pfad in der Unit zum Datenordner passt. |
| „Updates“-Fenster: „Die Prüfung ist fehlgeschlagen“ | `journalctl -u spieleblock-update -n 30`. Meist ist GitHub nicht erreichbar oder das Release hat kein Paket. |
| Dienst antwortet mit `429` | Mehr als `RATE_PER_MIN` Anfragen pro Minute von einer IP. Steht ein Proxy davor, muss er `X-Forwarded-For` setzen, sonst zählen alle Nutzer als eine IP. |
