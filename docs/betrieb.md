# Betrieb

Für den laufenden Dienst: Einstellungen, Daten und Backups, Updates, Datenschutz, Fehlersuche. Die Installation steht in [deployment.md](deployment.md).

## Einstellungen

Alle Einstellungen sind Umgebungsvariablen: in `docker-compose.yml` unter `environment:`, bei systemd als `Environment=`-Zeilen. Nach einer Änderung den Dienst neu starten (`docker compose up -d` bzw. `systemctl restart spieleblock`).

| Variable | Standard | Bedeutung |
|---|---|---|
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

Das erste Release bekommt die Version aus der `package.json`. Das Docker-Image ist nach dem ersten Release zunächst privat: In den Paket-Einstellungen auf GitHub auf *Public* stellen, sonst muss der Server sich bei `ghcr.io` anmelden.

### Automatisch auf dem Server

Der Server prüft stündlich, ob es ein neues Release gibt, und installiert es. Dafür dient `deploy/update.sh` mit einem systemd-Timer; er läuft auf dem Docker-Host bzw. im LXC.

```bash
cp deploy/update.sh /usr/local/sbin/spieleblock-update && chmod +x /usr/local/sbin/spieleblock-update
cp deploy/spieleblock-update.service deploy/spieleblock-update.timer /etc/systemd/system/
```

* **Ohne Docker:** Nichts weiter einstellen (`MODE=systemd` ist voreingestellt). Das Skript lädt das Paket des neuesten Releases nach `/opt/spieleblock` und startet den Dienst neu. Die installierte Version steht in `/opt/spieleblock/VERSION`. Gebraucht werden `curl` und das vorhandene Node.
* **Mit Docker:** In `/etc/systemd/system/spieleblock-update.service` die Zeile `MODE=systemd` durch `MODE=docker` ersetzen und `COMPOSE_DIR` auf den Ordner mit der `docker-compose.yml` setzen. Das Skript zieht das Image `latest` und erstellt den Container nur neu, wenn es sich geändert hat.

Dann den Timer einschalten und einmal von Hand prüfen:

```bash
systemctl daemon-reload && systemctl enable --now spieleblock-update.timer
systemctl start spieleblock-update.service && journalctl -u spieleblock-update -n 20
systemctl list-timers spieleblock-update
```

Der Dienst startet beim Update kurz neu (wenige Sekunden); offene Browser verbinden sich selbst wieder.

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

* **Keine Konten, keine Mailadressen, kein Tracking.** Schriften und alles andere kommen vom eigenen Server, es werden keine fremden Dienste geladen.
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
| Dienst antwortet mit `429` | Mehr als `RATE_PER_MIN` Anfragen pro Minute von einer IP. Steht ein Proxy davor, muss er `X-Forwarded-For` setzen, sonst zählen alle Nutzer als eine IP. |
