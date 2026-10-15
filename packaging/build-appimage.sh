#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
VERSION="${SUVHLATEX_VERSION:-$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$ROOT_DIR/pyproject.toml")}" 
APPDIR="$DIST_DIR/suvhlatex.AppDir"
APPIMAGETOOL="${APPIMAGETOOL:-$(command -v appimagetool || true)}"
APPIMAGE_ARCH="${ARCH:-x86_64}"
APPIMAGETOOL_ARGS=()

if [[ "$APPIMAGETOOL" == *.AppImage ]]; then
  APPIMAGETOOL_ARGS=(--appimage-extract-and-run)
fi

if [[ -n "${APPIMAGE_RUNTIME_FILE:-}" ]]; then
  APPIMAGETOOL_ARGS+=(--runtime-file "$APPIMAGE_RUNTIME_FILE")
fi

if [[ -z "$APPIMAGETOOL" ]]; then
  echo "appimagetool is required. Set APPIMAGETOOL or install it before building." >&2
  exit 1
fi

rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/share/suvhlatex/web" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/icons/hicolor/scalable/apps"
install -m 755 "$ROOT_DIR/packaging/AppRun" "$APPDIR/AppRun"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.desktop" "$APPDIR/suvhlatex.desktop"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.svg" "$APPDIR/suvhlatex.svg"
install -m 644 "$ROOT_DIR/server.py" "$APPDIR/usr/share/suvhlatex/server.py"
install -m 644 "$ROOT_DIR/pyproject.toml" "$APPDIR/usr/share/suvhlatex/pyproject.toml"
cp -a "$ROOT_DIR/web/." "$APPDIR/usr/share/suvhlatex/web/"
install -m 755 "$ROOT_DIR/packaging/installed-launcher.sh" "$APPDIR/usr/share/suvhlatex/installed-launcher.sh"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.desktop" "$APPDIR/usr/share/applications/suvhlatex.desktop"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.svg" "$APPDIR/usr/share/icons/hicolor/scalable/apps/suvhlatex.svg"

mkdir -p "$DIST_DIR"
ARCH="$APPIMAGE_ARCH" "$APPIMAGETOOL" "${APPIMAGETOOL_ARGS[@]}" "$APPDIR" "$DIST_DIR/suvhlatex-${VERSION}-${APPIMAGE_ARCH}.AppImage"
rm -rf "$APPDIR"
echo "Created $DIST_DIR/suvhlatex-${VERSION}-${APPIMAGE_ARCH}.AppImage"
