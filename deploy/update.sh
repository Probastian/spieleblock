#!/usr/bin/env bash
# Holt das neueste GitHub-Release und startet den Dienst damit neu. Ohne neues Release passiert nichts.
# Gedacht für den regelmäßigen Aufruf durch spieleblock-update.timer (siehe docs/betrieb.md).
#
#   MODE=docker    Compose-Projekt: neues Image ziehen, Container nur bei Änderung neu erstellen
#   MODE=systemd   Ohne Docker: Release-Paket nach APP_DIR entpacken, Dienst neu starten
#
# Einstellungen per Umgebungsvariable: MODE (docker), REPO, COMPOSE_DIR, APP_DIR
set -euo pipefail

MODE="${MODE:-docker}"
REPO="${REPO:-Probastian/spieleblock}"
log() { echo "spieleblock-update: $*"; }

case "$MODE" in
  docker)
    cd "${COMPOSE_DIR:-$(dirname "$(readlink -f "$0")")/..}"
    docker compose pull --quiet
    docker compose up -d --no-build
    docker image prune -f >/dev/null
    ;;

  systemd)
    APP_DIR="${APP_DIR:-/opt/spieleblock}"
    tag=$(curl -fsSL -H 'Accept: application/vnd.github+json' \
        "https://api.github.com/repos/$REPO/releases/latest" \
      | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).tag_name')
    current=$(cat "$APP_DIR/VERSION" 2>/dev/null || true)
    if [ "$tag" = "$current" ]; then
      log "aktuell ($tag)"
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
    systemctl restart spieleblock
    log "${current:-nichts} -> $tag"
    ;;

  *)
    log "MODE muss docker oder systemd sein, nicht '$MODE'"
    exit 2
    ;;
esac
