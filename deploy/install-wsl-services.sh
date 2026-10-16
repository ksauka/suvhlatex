#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="${HOME}/.config/suvhlatex"
ENV_FILE="${CONFIG_DIR}/.env"
UNIT_DIR="${HOME}/.config/systemd/user"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is unavailable. Enable systemd in WSL first." >&2
  exit 1
fi

if [[ ! -s "$ENV_FILE" ]] || ! grep -Eq '^SUVHLATEX_PASSWORD=.+$' "$ENV_FILE"; then
  echo "Create $ENV_FILE with a strong SUVHLATEX_PASSWORD before exposing the app." >&2
  exit 1
fi

if ! grep -Eq '^SUVHLATEX_COMPILE_MODE=(container|auto)$' "$ENV_FILE"; then
  echo "Set SUVHLATEX_COMPILE_MODE=container (or auto with Docker/Podman) in $ENV_FILE." >&2
  exit 1
fi

mkdir -p "$CONFIG_DIR" "$UNIT_DIR"
chmod 700 "$CONFIG_DIR"
install -m 0644 "$APP_ROOT/deploy/suvhlatex.service" "$UNIT_DIR/"
install -m 0644 "$APP_ROOT/deploy/suvhlatex-cloudflared.service" "$UNIT_DIR/"

if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER"
fi

systemctl --user daemon-reload
systemctl --user enable --now suvhlatex.service
systemctl --user enable --now suvhlatex-cloudflared.service

echo "suvhlatex and its Cloudflare Quick Tunnel are enabled for this WSL user."
echo "URL: journalctl --user -u suvhlatex-cloudflared.service | grep trycloudflare"
