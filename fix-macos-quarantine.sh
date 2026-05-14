#!/usr/bin/env bash
# Fix "is damaged and can't be opened" on macOS (Apple Silicon & Intel)
# Usage:
#   ./fix-macos-quarantine.sh                         # auto-find DMG in ~/Downloads
#   ./fix-macos-quarantine.sh /path/to/hermes.dmg     # explicit path
set -euo pipefail

APP_NAME="hermes-manager"
APP_DST="/Applications/${APP_NAME}.app"

# ── locate DMG ────────────────────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  DMG="$1"
else
  DMG=$(ls -t ~/Downloads/hermes-manager-latest-macos-*.dmg 2>/dev/null | head -1 || true)
fi

if [ -z "${DMG:-}" ] || [ ! -f "$DMG" ]; then
  echo "ERROR: DMG not found. Pass the path explicitly:" >&2
  echo "  $0 /path/to/hermes-manager-latest-macos-arm64.dmg" >&2
  exit 1
fi

echo "DMG: $DMG"

# ── strip quarantine from DMG ─────────────────────────────────────────────────
xattr -d com.apple.quarantine "$DMG" 2>/dev/null && echo "Quarantine removed from DMG" || echo "No quarantine on DMG (OK)"

# ── mount ─────────────────────────────────────────────────────────────────────
echo "Mounting..."
MOUNT_OUTPUT=$(hdiutil attach "$DMG" -nobrowse -noautoopen)
VOLUME=$(echo "$MOUNT_OUTPUT" | awk 'END{print $NF}')

if [ ! -d "$VOLUME" ]; then
  echo "ERROR: Could not determine mount point from: $MOUNT_OUTPUT" >&2
  exit 1
fi

echo "Mounted at: $VOLUME"

# ── copy to /Applications ─────────────────────────────────────────────────────
APP_SRC="$VOLUME/${APP_NAME}.app"
if [ ! -d "$APP_SRC" ]; then
  # try case-insensitive fallback
  APP_SRC=$(find "$VOLUME" -maxdepth 1 -iname "*.app" | head -1 || true)
fi

if [ -z "${APP_SRC:-}" ] || [ ! -d "$APP_SRC" ]; then
  hdiutil detach "$VOLUME" -quiet 2>/dev/null || true
  echo "ERROR: .app not found inside $VOLUME" >&2
  exit 1
fi

echo "Installing to $APP_DST ..."
if [ -d "$APP_DST" ]; then
  sudo rm -rf "$APP_DST"
fi
sudo cp -R "$APP_SRC" "$APP_DST"

hdiutil detach "$VOLUME" -quiet
echo "DMG unmounted"

# ── strip quarantine recursively from .app ────────────────────────────────────
echo "Clearing quarantine from app bundle..."
sudo xattr -cr "$APP_DST"

echo ""
echo "Done. Opening $APP_DST ..."
open "$APP_DST"
