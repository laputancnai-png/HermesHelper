#!/usr/bin/env bash
set -euo pipefail

version_ge() {
  [ "$1" = "$2" ] && return 0
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

linux_preflight() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    return
  fi

if ! command -v pkg-config >/dev/null 2>&1; then
    cat >&2 <<'EOF'
[tauri-run] Missing pkg-config.
[tauri-run] Run: npm run bootstrap:linux
EOF
    exit 1
  fi

  if ! pkg-config --exists glib-2.0 gobject-2.0; then
    cat >&2 <<'EOF'
[tauri-run] Missing GLib/GObject development packages.
[tauri-run] Run: npm run bootstrap:linux
EOF
    exit 1
  fi

  local glib_ver
  glib_ver="$(pkg-config --modversion glib-2.0)"
  if ! version_ge "$glib_ver" "2.70"; then
    cat >&2 <<EOF
[tauri-run] GLib version is too old: $glib_ver
[tauri-run] This app currently requires glib-2.0 >= 2.70.
[tauri-run] Use Ubuntu 22.04+ (or newer distro), then run: npm run bootstrap:linux
EOF
    exit 1
  fi
}

# Make cargo available for Tauri subprocesses on fresh Linux/macOS shells.
if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
elif [[ -d "$HOME/.cargo/bin" ]]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

linux_preflight

exec tauri "$@"
