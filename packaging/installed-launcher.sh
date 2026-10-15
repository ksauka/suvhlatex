#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SUVHLATEX_APP_DIR:-/opt/suvhlatex}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/suvhlatex"
mkdir -p "$DATA_DIR/data"

export SUVHLATEX_DATA="${SUVHLATEX_DATA:-$DATA_DIR/data}"
export SUVHLATEX_ENV_FILE="${SUVHLATEX_ENV_FILE:-$DATA_DIR/.env}"
export SUVHLATEX_CONFIG="${SUVHLATEX_CONFIG:-$DATA_DIR/config.json}"
HOST="${SUVHLATEX_HOST:-127.0.0.1}"
PORT="${SUVHLATEX_PORT:-8765}"

if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1; xdg-open "http://${HOST}:${PORT}" >/dev/null 2>&1 || true) &
fi

exec python3 "$APP_DIR/server.py" >> "$DATA_DIR/suvhlatex.log" 2>&1
