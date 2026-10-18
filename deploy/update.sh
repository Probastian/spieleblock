#!/usr/bin/env bash
# Holt das neueste GitHub-Release und startet den Dienst damit neu. Ohne neues Release passiert nichts.
# Gedacht für den regelmäßigen Aufruf durch spieleblock-update.timer (siehe docs/betrieb.md), außerdem durch
# spieleblock-update.path, wenn jemand in der Oberfläche „Jetzt nach Update suchen“ antippt.
#
#   MODE=docker    Compose-Projekt: neues Image ziehen, Container nur bei Änderung neu erstellen
#   MODE=systemd   Ohne Docker: Release-Paket nach APP_DIR entpacken, Dienst neu starten
#
# Einstellungen per Umgebungsvariable: MODE (docker), REPO, COMPOSE_DIR, APP_DIR, DATA_DIR
#
# Mit MODE=systemd schreibt das Skript nach jedem Lauf `$DATA_DIR/update-status.json`, damit die Oberfläche
# das Ergebnis anzeigen kann, und löscht die Anforderung `$DATA_DIR/update-request`.
set -euo pipefail

MODE="${MODE:-docker}"
REPO="${REPO:-Probastian/spieleblock}"
DATA_DIR="${DATA_DIR:-/var/lib/spieleblock}"
log() { echo "spieleblock-update: $*"; }

# Neuste Release-Version. Die Weiterleitung von /releases/latest nennt sie, ohne die GitHub-API zu brauchen
# (die erlaubt ohne Anmeldung nur 60 Anfragen pro Stunde, bei einer Prüfung alle 2 Minuten wäre das zu knapp).
latest_tag() {
  local url tag
  url=$(curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") || return 1
  tag="${url##*/}"
  [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  printf '%s' "$tag"
}

# Ergebnis für die Oberfläche: state = current | updated | failed. Nur zeichensichere Werte, kein JSON-Escaping nötig.
write_status() {
  [ -d "$DATA_DIR" ] || return 0
  local tmp="$DATA_DIR/.update-status.tmp" cur lat
  cur=$(printf '%s' "$2" | tr -cd 'A-Za-z0-9._-' | cut -c1-32)
  lat=$(printf '%s' "$3" | tr -cd 'A-Za-z0-9._-' | cut -c1-32)
  { printf '{"checkedAt":%s000,"state":"%s","current":"%s","latest":"%s"}\n' "$(date +%s)" "$1" "$cur" "$lat" > "$tmp" \
      && chmod 644 "$tmp" && mv -f "$tmp" "$DATA_DIR/update-status.json"; } 2>/dev/null || true
}

# Anforderung aus der Oberfläche sofort entfernen, sonst startet die Path-Unit das Skript gleich wieder.
rm -f "$DATA_DIR/update-request" 2>/dev/null || true

case "$MODE" in
  docker)
    cd "${COMPOSE_DIR:-$(dirname "$(readlink -f "$0")")/..}"
    docker compose pull --quiet
    docker compose up -d --no-build
    docker image prune -f >/dev/null
    ;;

  systemd)
    APP_DIR="${APP_DIR:-/opt/spieleblock}"
    current=$(cat "$APP_DIR/VERSION" 2>/dev/null || true)
    tag=""
    trap 'write_status failed "$current" "$tag"' ERR

    tag=$(latest_tag)
    if [ "$tag" = "$current" ]; then
      write_status current "$current" "$tag"
      # Der Timer läuft alle paar Minuten, im Journal soll nur Neues stehen; bei Handstart ist es hilfreich
      if [ -t 1 ]; then log "aktuell ($tag)"; fi
      exit 0
    fi

    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    curl -fsSL -o "$tmp/paket.tar.gz" \
      "https://github.com/$REPO/releases/download/$tag/spieleblock-$tag.tar.gz"
    tar -xzf "$tmp/paket.tar.gz" -C "$tmp" --no-same-owner
    [ -f "$tmp/server.mjs" ] && [ -d "$tmp/public" ] || { log "Paket unvollständig"; exit 1; }

    rm -rf "$APP_DIR/public"
    mv "$tmp/public" "$APP_DIR/public"
    mv "$tmp/server.mjs" "$APP_DIR/server.mjs"
    echo "$tag" > "$APP_DIR/VERSION"
    # Vor dem Neustart schreiben: Der neue Server liest den Status gleich beim ersten Aufruf
    write_status updated "$tag" "$tag"
    systemctl restart spieleblock
    log "${current:-nichts} -> $tag"
    ;;

  *)
    log "MODE muss docker oder systemd sein, nicht '$MODE'"
    exit 2
    ;;
esac
