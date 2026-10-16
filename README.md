# Spieleblock zum Selbst-Hosten

Kniffel, Wizard und Punktetafel mit **Live-Tisch**: Alle Mitspieler öffnen im Browser die Adresse, geben den Tisch-Code ein, wählen ihren Platz und tragen ihre Werte selbst ein. Niemand braucht ein Konto.

Der Server ist eine einzige Datei (`server.mjs`, Node, **keine Pakete zum Installieren**). Er braucht rund 60 MB RAM und läuft auch auf einem winzigen Container.

---

## 1. Schnellstart mit Docker

Auf dem Docker-Host (am besten dort, wo auch der Nginx Proxy Manager läuft):

```bash
unzip spieleblock-server.zip -d spieleblock && cd spieleblock
docker compose up -d --build
```

Test: `http://<Host-IP>:3000` im Browser öffnen. Die App startet, oben steht „Gespeichert“.

Die Daten liegen im Docker-Volume `spieleblock-data` (siehe Abschnitt 4).

### Welche Proxmox-Umgebung?

| Du hast … | Dann … |
|---|---|
| schon eine VM oder einen LXC mit Docker, in dem der Nginx Proxy Manager läuft | **Dort einfach den Stack dazustellen.** Kein neuer Container, kein neues System. Empfohlen. |
| nur den NPM-Container und sonst kein Docker | Neuen **Debian-12-LXC** (1 Kern, 256 MB RAM, 2 GB Disk) anlegen und Abschnitt 5 (ohne Docker) nehmen. |

Docker in einem unprivilegierten LXC geht auch (Optionen *Nesting* und *keyctl* aktivieren), ist hier aber unnötig, weil der Server ohne Docker genauso einfach läuft.

---

## 2. Nginx Proxy Manager einrichten

**Proxy Host → Add Proxy Host**

| Feld | Wert |
|---|---|
| Domain Names | z. B. `spiele.deinedomain.de` |
| Scheme | `http` |
| Forward Hostname / IP | IP des Docker-Hosts (oder `spieleblock`, wenn du Variante B in `docker-compose.yml` nutzt) |
| Forward Port | `3000` |
| Block Common Exploits | an |
| Websockets Support | egal (wird nicht gebraucht) |

**Tab SSL:** neues Let’s-Encrypt-Zertifikat, *Force SSL* und *HTTP/2* an.

Mehr ist nicht nötig. Der Live-Sync läuft über Server-Sent Events. Der Server schickt `X-Accel-Buffering: no` und alle 20 Sekunden ein Lebenszeichen, damit nginx die Verbindung weder puffert noch kappt. Falls ein Live-Update trotzdem hängt, im Tab **Advanced** eintragen:

```nginx
proxy_buffering off;
proxy_read_timeout 1h;
```

### Von außen erreichbar oder nur im Heimnetz?

* **Nur im WLAN** (Spieleabend zu Hause): interner DNS-Eintrag (Pi-hole/AdGuard/Router) auf den NPM, `http://spiele.lan` reicht. Die „App installieren“-Funktion und der Offline-Start brauchen https; das Spielen selbst nicht.
* **Über das Internet:** Port 443 auf den NPM weiterleiten, **und setze dann einen `ACCESS_KEY`** (Abschnitt 3). Wer die Adresse kennt, kann sonst Tische und Daten anlegen.
* **Nur für dich und Freunde mit VPN:** Tailscale/WireGuard, dann ist nichts öffentlich.

---

## 3. Einstellungen (Umgebungsvariablen)

In `docker-compose.yml` unter `environment:` oder in der systemd-Datei.

| Variable | Standard | Bedeutung |
|---|---|---|
| `ACCESS_KEY` | leer | Wenn gesetzt, fragt die App beim ersten Öffnen nach diesem Code (wird im Browser gemerkt). Die Seite selbst ist öffentlich, die Daten nicht. |
| `PORT` | `3000` | Port des Servers |
| `DATA_DIR` | `/data` (Docker) | Wo Daten und Backups liegen |
| `TABLE_TTL_DAYS` | `30` | Live-Tische ohne Aktivität werden nach so vielen Tagen gelöscht (`0` = nie). Deine Spieler und Spiele sind davon **nicht** betroffen. |
| `BACKUP_KEEP` | `14` | Anzahl der Tagesbackups |
| `MAX_DOC_BYTES` | `262144` | Maximale Größe eines Spielstands |
| `RATE_PER_MIN` | `1200` | Anfragen pro Minute und IP |

---

## 4. Daten, Backups, Updates

**Wo liegt was?** (im Volume bzw. in `DATA_DIR`)

* `snapshot.json` + `journal.jsonl`: der aktuelle Stand. Jede Änderung wird sofort ins Journal geschrieben, beim Beenden und bei Bedarf in den Snapshot zusammengeführt. Ein Absturz oder Stromausfall verliert nichts (ein halb geschriebener letzter Eintrag wird ignoriert).
* `backups/JJJJ-MM-TT.json`: täglich ein vollständiger Stand, die letzten 14 bleiben.

**Backup holen** (Docker):

```bash
docker cp spieleblock:/data ./spieleblock-backup
```

In Proxmox deckt der normale Backup-Job der VM/des LXC das Volume mit ab.

**Zurückspielen:** Container stoppen, gewünschte Datei aus `backups/` als `snapshot.json` ablegen, `journal.jsonl` löschen, Container starten.

```bash
docker compose stop
docker run --rm -v spieleblock_spieleblock-data:/data alpine sh -c \
  'cp /data/backups/2026-10-01.json /data/snapshot.json && rm -f /data/journal.jsonl'
docker compose start
```

(Den Volume-Namen zeigt `docker volume ls`; er beginnt mit dem Ordnernamen.)

**Update:** Neues Paket entpacken (die Daten sind im Volume und bleiben), dann `docker compose up -d --build`. Offene Browser laden die neue Version beim nächsten Öffnen.

Einzelne Spieler können außerdem in der App unter *Speicher → Backup herunterladen* ihre eigenen Daten als Datei sichern.

---

## 5. Ohne Docker (Debian-LXC, systemd)

```bash
apt update && apt install -y nodejs          # Node 20 oder neuer
useradd --system --home /opt/spieleblock spieleblock
mkdir -p /opt/spieleblock && cp -r server.mjs package.json public /opt/spieleblock/
cp deploy/spieleblock.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now spieleblock
```

Falls `apt` ein zu altes Node liefert (`node -v` unter 20), nimm das Paket von nodesource.com oder `docker`. Daten liegen unter `/var/lib/spieleblock`. Logs: `journalctl -u spieleblock -f`.

---

## 6. So funktioniert es (und was es nicht kann)

* **Identität:** Jedes Gerät bekommt beim ersten Öffnen eine zufällige **Gerätekennung** (20 Zeichen). Daraus wird eine öffentliche Nutzer-ID berechnet; die Kennung selbst verlässt das Gerät nur als Header zu deinem Server. Deine Spieler und Spiele sind nur mit dieser Kennung lesbar.
* **Zweites Gerät oder neues Handy:** In der App *Speicher → Gerätekennung* anzeigen lassen und auf dem anderen Gerät dort eintragen. Die Kennung ist wie ein Passwort zu behandeln.
* **Live-Tisch:** Der Gastgeber legt einen Tisch an, alle anderen geben den fünfstelligen Code ein. Das Spiel ist für alle am Tisch les- und schreibbar. Es gibt bewusst **keine Konten und keine Rechteverwaltung**: Wer den Code kennt, kann mitschreiben. Das ist für einen Spieleabend gedacht, nicht für Fremde.
* Löscht jemand die Browserdaten, ist auch die Gerätekennung weg. Wer sie vorher notiert oder auf einem zweiten Gerät eingetragen hat, kommt wieder an alle Daten.
* Fremde Schriften werden nicht nachgeladen. Alle Schriften liegen lokal im Paket.

## 7. Fehlersuche

| Problem | Ursache / Lösung |
|---|---|
| Oben steht „Nur lokal“ | Der Server ist nicht erreichbar oder die Seite wurde als Datei geöffnet. Adresse prüfen. |
| Oben steht „Wartet auf Sync“ | Kurz offline. Die App versucht es alle 20 Sekunden erneut, nichts geht verloren. |
| Live-Änderungen kommen verzögert an | Im NPM unter *Advanced* die zwei Zeilen aus Abschnitt 2 eintragen. Cloudflare-Proxy kann Event-Streams puffern; testweise auf „DNS only“ stellen. |
| Zugangscode-Abfrage erscheint immer wieder | Browser blockiert Speicherung (Privatmodus). |
| `docker compose` meldet Port belegt | In `docker-compose.yml` links den Port ändern, z. B. `"3100:3000"`. |
| Gesundheitscheck | `curl http://<Host>:3000/healthz` antwortet `ok`. |
