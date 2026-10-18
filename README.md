# Spieleblock

Kniffel, Wizard und Punktetafel als Web-App für den Spieleabend, zum Selbst-Hosten (z. B. auf Proxmox).
Alle Mitspieler öffnen im Browser dieselbe Adresse; mit dem **Live-Tisch** trägt jeder auf dem eigenen Handy ein, alle sehen den Stand sofort. Niemand braucht ein Konto.

* Web-App: **Angular** (Signals, ohne Zone.js), installierbar als PWA, startet auch offline
* Server: **Node**, eine einzige Datei ohne Laufzeit-Pakete, rund 60 MB RAM
* Daten: Dokumente im Speicher mit Journal, Snapshot und Tagesbackup (keine Datenbank nötig)

## Schnellstart

```bash
git clone https://github.com/Probastian/spieleblock && cd spieleblock
docker compose up -d --build
```

Dann `http://<Host-IP>:3000` öffnen. Einrichtung hinter Nginx Proxy Manager, Einstellungen, Backups und Betrieb ohne Docker stehen in **[docs/deployment.md](docs/deployment.md)**.

## Aufbau

Ein Monorepo mit vier Paketen (npm workspaces):

| Paket | Inhalt |
|---|---|
| [`packages/shared`](packages/shared) | Protokoll zwischen Server und App: Pfadregeln, Header, Nachrichtentypen, Gerätekennung, Merge |
| [`packages/games`](packages/games) | Spiel-Engines (Regeln, Zustand, Wertung, Statistik) in reinem TypeScript, ohne Framework |
| [`packages/server`](packages/server) | HTTP-Server: Dokumentenspeicher, Live-Verbindungen (SSE), API, liefert die App aus |
| [`packages/web`](packages/web) | Angular-App: Oberfläche, Zustand, Abgleich mit dem Server, Live-Tisch |

Wie alles zusammenspielt: **[docs/architektur.md](docs/architektur.md)**.
Ein neues Spiel hinzufügen: **[docs/neues-spiel.md](docs/neues-spiel.md)**.

## Entwickeln

Voraussetzung: Node 22.12 oder neuer (empfohlen 24).

```bash
npm install
npm run dev:server      # Server auf :3000 (baut und startet bei Änderungen neu)
npm run dev             # Angular-Entwicklungsserver auf :4200, leitet /api an :3000 weiter
```

| Befehl | Zweck |
|---|---|
| `npm test` | Tests von `shared`, `games` und `server` (Vitest) |
| `npm run test:web` | Tests der Web-App (`ng test`) |
| `npm run typecheck` | TypeScript-Prüfung der Pakete ohne Angular |
| `npm run build` | Web-App und Server bauen; Ergebnis in `packages/server/dist` |
| `npm run check` | alles zusammen (läuft auch in der CI) |
| `npm start` | gebauten Server starten |

`packages/server/dist` ist alles, was auf den Zielrechner muss: `server.mjs` plus der Ordner `public`.
