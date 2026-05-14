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
MOUNT_OUTPUT=$(hdiutil attach "$DMG" -nobrowse -noautoopen 2>&1) || {
  echo "ERROR: hdiutil attach failed:" >&2
  echo "$MOUNT_OUTPUT" >&2
  exit 1
}

# Volume name may contain spaces; grep for /Volumes/ and take the full remainder
VOLUME=$(echo "$MOUNT_OUTPUT" | grep -oE '/Volumes/[^\t]+' | tail -1 | sed 's/[[:space:]]*$//')

if [ -z "$VOLUME" ] || [ ! -d "$VOLUME" ]; then
  echo "ERROR: Could not determine mount point." >&2
  echo "hdiutil output was:" >&2
  echo "$MOUNT_OUTPUT" >&2
  exit 1
fi

echo "Mounted at: $VOLUME"

# ── copy to /Applications ─────────────────────────────────────────────────────
APP_SRC="$VOLUME/${APP_NAME}.app"
if [ ! -d "$APP_SRC" ]; then
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

# ── strip quarantine recursively ──────────────────────────────────────────────
echo "Clearing quarantine attributes..."
sudo xattr -cr "$APP_DST"

# ── ad-hoc sign (required on Apple Silicon for unsigned builds) ───────────────
echo "Applying ad-hoc signature..."
sudo codesign --force --deep --sign - "$APP_DST" 2>&1 || {
  echo "WARNING: codesign failed, trying to open anyway..." >&2
}

echo ""
echo "Done. Opening $APP_DST ..."
open "$APP_DST"
