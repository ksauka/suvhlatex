#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
VERSION="${SUVHLATEX_VERSION:-$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$ROOT_DIR/pyproject.toml")}"
PACKAGE_ROOT="$DIST_DIR/suvhlatex-deb"

rm -rf "$PACKAGE_ROOT"
mkdir -p "$PACKAGE_ROOT/DEBIAN" "$PACKAGE_ROOT/opt/suvhlatex/web" "$PACKAGE_ROOT/usr/bin" "$PACKAGE_ROOT/usr/share/applications" "$PACKAGE_ROOT/usr/share/icons/hicolor/scalable/apps"

install -m 644 "$ROOT_DIR/server.py" "$PACKAGE_ROOT/opt/suvhlatex/server.py"
install -m 644 "$ROOT_DIR/pyproject.toml" "$PACKAGE_ROOT/opt/suvhlatex/pyproject.toml"
cp -a "$ROOT_DIR/web/." "$PACKAGE_ROOT/opt/suvhlatex/web/"
install -m 755 "$ROOT_DIR/packaging/installed-launcher.sh" "$PACKAGE_ROOT/opt/suvhlatex/installed-launcher.sh"
install -m 755 "$ROOT_DIR/packaging/installed-launcher.sh" "$PACKAGE_ROOT/usr/bin/suvhlatex"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.desktop" "$PACKAGE_ROOT/usr/share/applications/suvhlatex.desktop"
install -m 644 "$ROOT_DIR/packaging/suvhlatex.svg" "$PACKAGE_ROOT/usr/share/icons/hicolor/scalable/apps/suvhlatex.svg"

cat > "$PACKAGE_ROOT/DEBIAN/control" <<CONTROL
Package: suvhlatex
Version: $VERSION
Section: text
Priority: optional
Architecture: all
Depends: python3 (>= 3.10), xdg-utils, git, texlive-latex-base, texlive-latex-recommended, texlive-latex-extra, texlive-fonts-recommended, texlive-fonts-extra, texlive-publishers, texlive-science, texlive-bibtex-extra, biber
Maintainer: suvhlatex contributors
Description: Local LaTeX editor and PDF compiler
 A local-first browser editor for LaTeX projects with PDF compilation,
 bibliography support, ZIP import, and Git repository import.
CONTROL

mkdir -p "$DIST_DIR"
dpkg-deb --build --root-owner-group "$PACKAGE_ROOT" "$DIST_DIR/suvhlatex_${VERSION}_all.deb"
rm -rf "$PACKAGE_ROOT"
echo "Created $DIST_DIR/suvhlatex_${VERSION}_all.deb"
