#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${SUVHLATEX_APP_ROOT:-$HOME/projects/suvhlatex}"
ENV_FILE="${SUVHLATEX_ENV_FILE:-$HOME/.config/suvhlatex/.env}"

cd "$APP_ROOT"
export SUVHLATEX_ENV_FILE="$ENV_FILE"
export SUVHLATEX_HOST="${SUVHLATEX_HOST:-127.0.0.1}"
export SUVHLATEX_PORT="${SUVHLATEX_PORT:-8765}"

if [[ -x "$APP_ROOT/.venv/bin/python" ]]; then
  exec "$APP_ROOT/.venv/bin/python" "$APP_ROOT/server.py"
fi

if command -v conda >/dev/null 2>&1 \
  && conda env list | awk '{print $1}' | grep -qx "${SUVHLATEX_ENV_NAME:-suvhlatex}"; then
  exec conda run --no-capture-output --name "${SUVHLATEX_ENV_NAME:-suvhlatex}" \
    python "$APP_ROOT/server.py"
fi

exec python3 "$APP_ROOT/server.py"
