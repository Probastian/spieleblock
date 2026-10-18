# Deployment

So kommt der Spieleblock auf einen Server. Für Einstellungen, Backups, Updates und Fehlersuche im laufenden Betrieb siehe [betrieb.md](betrieb.md).

## Was gebraucht wird

Der Dienst ist ein einziger Node-Prozess, der Daten, Live-Verbindungen und die Web-App bereitstellt. Er braucht rund 60 MB RAM, wenig CPU und einen Ordner für die Daten.

| Variante | Wann | Voraussetzung |
|---|---|---|
| **Docker Compose** (empfohlen) | ein Docker-Host ist vorhanden (z. B. dort, wo der Nginx Proxy Manager läuft) | Docker mit Compose |
| **Ohne Docker** (systemd) | ein schlanker LXC/VM ohne Docker | Node 22.12 oder neuer zum Laufen, zum Bauen ebenfalls |

Davor sollte ein Reverse Proxy mit **HTTPS** stehen. Das Spielen geht auch ohne, aber „App installieren“ und der Offline-Start des Browsers brauchen `https://`.

## Variante A: Docker Compose

```bash
git clone https://github.com/Probastian/spieleblock && cd spieleblock
docker compose up -d            # zieht das fertige Image des neuesten Releases
docker compose up -d --build    # oder: selbst bauen (z. B. solange es noch kein Release gibt)
```

Wie sich der Server danach von selbst aktualisiert, steht in [betrieb.md](betrieb.md#updates).

Beim Selbstbauen lädt der erste Build die Abhängigkeiten und baut Web-App und Server (einige Minuten). Das fertige Image enthält nur `server.mjs` und die Web-App, keine Entwicklungswerkzeuge.

Prüfen:

```bash
curl http://localhost:3000/healthz     # antwortet: ok
docker compose logs -f                 # "Spieleblock läuft auf http://0.0.0.0:3000"
```

Dann `http://<Host-IP>:3000` im Browser öffnen; oben steht „Gespeichert“.

Was die mitgelieferte [docker-compose.yml](../docker-compose.yml) einrichtet:

* Das Volume `spieleblock-data` für alle Daten (überlebt Neubauen und Updates).
* Ein gehärteter Container: schreibgeschütztes Dateisystem, keine zusätzlichen Rechte, 192 MB Speicherlimit, läuft als unprivilegierter Nutzer.
* Einen Gesundheitscheck auf `/healthz`.
* `restart: unless-stopped`: Der Dienst startet nach einem Neustart des Hosts wieder.

Netzwerk, zwei Varianten (Kommentare in der Datei):

* **Port freigeben** (Standard): Der Container ist unter `<Host-IP>:3000` erreichbar. Im Nginx Proxy Manager zeigst du auf diese Adresse. Hat der Host eine Firewall, den Port nur für den Proxy öffnen.
* **Ohne Port, im Docker-Netz des Proxys:** `ports:` löschen, das Netzwerk des Proxys eintragen (`docker network ls`), im Proxy als Host `spieleblock` und Port `3000` verwenden. Der Dienst ist dann von außen gar nicht direkt erreichbar.

## Variante B: Ohne Docker (Debian-LXC, systemd)

**1. Bauen** (auf dem eigenen Rechner oder im LXC, Node 22.12+):

```bash
git clone https://github.com/Probastian/spieleblock && cd spieleblock
npm ci && npm run build
```

Ergebnis ist der Ordner `packages/server/dist` mit `server.mjs` und `public/`. Nur dieser Ordner muss auf den Server. Statt selbst zu bauen, geht auch das Paket `spieleblock-vX.Y.Z.tar.gz` vom neuesten [GitHub-Release](https://github.com/Probastian/spieleblock/releases); es enthält genau diese beiden Einträge.

**2. Im LXC einrichten:**

```bash
apt update && apt install -y nodejs                      # Node 22 oder neuer; `node -v` prüfen
useradd --system --home /opt/spieleblock spieleblock
mkdir -p /opt/spieleblock
cp -r server.mjs public /opt/spieleblock/                # aus packages/server/dist
cp deploy/spieleblock.service /etc/systemd/system/       # Datei aus dem Repo
systemctl daemon-reload && systemctl enable --now spieleblock
```

Liefert `apt` ein zu altes Node, die Pakete von nodesource.com nehmen. Die Daten liegen unter `/var/lib/spieleblock`, Logs mit `journalctl -u spieleblock -f`. Einstellungen (z. B. `ACCESS_KEY`) stehen als `Environment=`-Zeilen in der Service-Datei; nach Änderungen `systemctl daemon-reload && systemctl restart spieleblock`.

Ein neuer LXC in Proxmox reicht mit 1 Kern, 256 MB RAM und 2 GB Disk. Docker in einem unprivilegierten LXC geht auch (Optionen *Nesting* und *keyctl*), ist hier aber unnötig.

## Reverse Proxy mit HTTPS

Der Dienst spricht einfaches HTTP auf Port 3000; HTTPS übernimmt der Proxy. Wichtig ist nur, dass der Proxy den **Event-Stream** (`/api/stream`) nicht puffert und nicht vorzeitig kappt. Der Server schickt `X-Accel-Buffering: no` und alle 20 Sekunden ein Lebenszeichen, das reicht in der Regel schon.

### Nginx Proxy Manager

**Proxy Host → Add Proxy Host**

| Feld | Wert |
|---|---|
| Domain Names | z. B. `spiele.deinedomain.de` |
| Scheme | `http` |
| Forward Hostname / IP | IP des Docker-Hosts bzw. des LXC (oder `spieleblock` im gemeinsamen Docker-Netz) |
| Forward Port | `3000` |
| Block Common Exploits | an |
| Websockets Support | egal (wird nicht gebraucht) |

**Tab SSL:** neues Let’s-Encrypt-Zertifikat, *Force SSL* und *HTTP/2* an.

Falls Live-Updates verzögert ankommen, im Tab **Advanced** ergänzen:

```nginx
proxy_buffering off;
proxy_read_timeout 1h;
```

### Eigener nginx

```nginx
server {
    listen 443 ssl http2;
    server_name spiele.deinedomain.de;
    # ssl_certificate … (z. B. von certbot)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_buffering off;          # Event-Stream nicht puffern
        proxy_read_timeout 1h;
    }
}
```

### Caddy

```
spiele.deinedomain.de {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy besorgt das Zertifikat selbst und leitet Event-Streams ohne Puffern durch.

> Steht Cloudflare als Proxy davor, kann es Event-Streams puffern. Dann testweise auf „DNS only“ stellen.

## Wer darf drauf?

Der Dienst hat **keine Benutzerverwaltung**. Entscheidend ist, wer die Adresse erreichen kann:

| Szenario | Empfehlung |
|---|---|
| **Nur im Heimnetz** (Spieleabend zu Hause) | Interner DNS-Eintrag (Pi-hole, AdGuard, Router) auf den Proxy. Kein Zugangscode nötig. |
| **Freunde per VPN** | Tailscale oder WireGuard; der Dienst ist nicht öffentlich. |
| **Aus dem Internet erreichbar** | Port 443 zum Proxy weiterleiten **und `ACCESS_KEY` setzen.** Sonst kann jeder, der die Adresse kennt, Daten und Tische anlegen. |

Mit gesetztem `ACCESS_KEY` fragt die App beim ersten Öffnen nach dem Code und merkt ihn sich im Browser. Der Code gehört in `docker-compose.yml` (`ACCESS_KEY: "..."`, Zeile ist auskommentiert vorbereitet) bzw. in die systemd-Datei.

## Abnahme

Nach dem Aufsetzen kurz durchspielen:

1. `https://<deine-adresse>` öffnen: Titel „Spieleblock“, oben „Gespeichert“.
2. Einen Spieler anlegen, Seite neu laden: Der Spieler ist noch da.
3. Ein Spiel starten, **Live-Tisch** im Menü starten, mit einem zweiten Handy beitreten: Eintragungen erscheinen auf beiden Geräten sofort. Kommen sie verzögert an, siehe Proxy-Einstellungen oben.
4. Auf dem Handy „App installieren“ anbieten lassen (zeigt, dass HTTPS passt).
