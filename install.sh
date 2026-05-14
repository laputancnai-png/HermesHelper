#!/usr/bin/env sh
# Hermes Helper — one-line installer (macOS & Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/laputancnai-png/HermesHelper/main/install.sh | sh
set -eu

BASE_URL="https://github.com/laputancnai-png/HermesHelper/releases/latest/download"

OS=$(uname -s)
ARCH=$(uname -m)

install_linux() {
  if [ "$ARCH" != "x86_64" ]; then
    echo "Only x86_64 (amd64) is supported on Linux. Detected: $ARCH" >&2
    exit 1
  fi

  ASSET="hermes-manager-latest-linux-x64.AppImage"
  BIN_DIR="$HOME/.local/bin"
  BIN_PATH="$BIN_DIR/hermes-manager"

  echo "Downloading Hermes Helper for Linux (x86_64)..."
  mkdir -p "$BIN_DIR"
  curl -fsSL "$BASE_URL/$ASSET" -o "$BIN_PATH"
  chmod +x "$BIN_PATH"

  echo ""
  echo "Hermes Helper installed successfully!"
  echo ""
  echo "  Run:  hermes-manager"
  echo ""
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) echo "  NOTE: Add $BIN_DIR to your PATH if the command is not found." ;;
  esac
}

install_macos() {
  if [ "$ARCH" = "arm64" ]; then
    ASSET="hermes-manager-latest-macos-arm64.dmg"
  else
    ASSET="hermes-manager-latest-macos-x64.dmg"
  fi

  echo "Downloading Hermes Helper for macOS ($ARCH)..."

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  DMG="$TMP/hermes-manager.dmg"
  curl -fsSL "$BASE_URL/$ASSET" -o "$DMG"

  echo "Mounting disk image..."
  MOUNT_OUTPUT=$(hdiutil attach "$DMG" -nobrowse -noautoopen -quiet)
  VOLUME=$(echo "$MOUNT_OUTPUT" | awk 'END{print $NF}')

  APP_SRC="$VOLUME/hermes-manager.app"
  APP_DST="/Applications/hermes-manager.app"

  echo "Installing to /Applications..."
  if [ -d "$APP_DST" ]; then
    rm -rf "$APP_DST"
  fi
  cp -R "$APP_SRC" "$APP_DST"

  hdiutil detach "$VOLUME" -quiet

  echo "Removing macOS quarantine attributes..."
  xattr -cr "$APP_DST"

  if [ "$ARCH" = "arm64" ]; then
    echo "Applying ad-hoc signature (required on Apple Silicon)..."
    codesign --force --deep --sign - "$APP_DST" 2>/dev/null || true
  fi

  echo ""
  echo "Hermes Helper installed to /Applications/hermes-manager.app"
  echo ""
  echo "  Open via Spotlight (Cmd+Space → hermes-manager)"
  echo "  or: open /Applications/hermes-manager.app"
}

case "$OS" in
  Linux)  install_linux ;;
  Darwin) install_macos ;;
  *)
    echo "Unsupported OS: $OS" >&2
    echo "Download from: $BASE_URL" >&2
    exit 1
    ;;
esac
