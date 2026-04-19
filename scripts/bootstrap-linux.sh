#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf "\n[bootstrap] %s\n" "$*"
}

ensure_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[bootstrap] Missing command: $cmd" >&2
    exit 1
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt"
  elif command -v dnf >/dev/null 2>&1; then
    echo "dnf"
  elif command -v pacman >/dev/null 2>&1; then
    echo "pacman"
  else
    echo ""
  fi
}

version_ge() {
  [ "$1" = "$2" ] && return 0
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

check_glib_version() {
  if ! command -v pkg-config >/dev/null 2>&1; then
    echo "[bootstrap] pkg-config is missing; cannot verify glib version." >&2
    exit 1
  fi

  if ! pkg-config --exists glib-2.0; then
    echo "[bootstrap] glib-2.0 development files are missing." >&2
    echo "[bootstrap] Install libglib2.0-dev (apt) or glib2-devel (dnf) and rerun." >&2
    exit 1
  fi

  local glib_version
  glib_version="$(pkg-config --modversion glib-2.0)"
  if ! version_ge "$glib_version" "2.70"; then
    cat >&2 <<EOF
[bootstrap] Installed glib-2.0 is too old: $glib_version
[bootstrap] This project's current Tauri/Rust dependency chain requires glib >= 2.70.
[bootstrap] On Ubuntu, please use 22.04+ (or a distro with newer glib) before running the app.
EOF
    exit 1
  fi
}

apt_pick_package() {
  for pkg in "$@"; do
    if apt-cache show "$pkg" >/dev/null 2>&1; then
      echo "$pkg"
      return 0
    fi
  done
  return 1
}

install_system_deps() {
  local pm
  pm="$(detect_pkg_manager)"

  if [[ -z "$pm" ]]; then
    cat <<'EOF' >&2
[bootstrap] Unsupported Linux distro (no apt/dnf/pacman found).
Install these manually, then re-run:
- C toolchain: build-essential / gcc / make / pkg-config
- SSL dev: libssl-dev / openssl-devel
- GTK3 and WebKitGTK
- AppIndicator/Ayatana and librsvg
- patchelf
EOF
    exit 1
  fi

  log "Installing Linux system dependencies using $pm"
  case "$pm" in
    apt)
      sudo apt-get update

      local webkit_pkg
      webkit_pkg="$(apt_pick_package libwebkit2gtk-4.1-dev libwebkit2gtk-4.0-dev)" || {
        echo "[bootstrap] Could not find WebKitGTK dev package (tried 4.1 and 4.0)." >&2
        exit 1
      }

      local appindicator_pkg
      appindicator_pkg="$(apt_pick_package libayatana-appindicator3-dev libappindicator3-dev)" || {
        echo "[bootstrap] Could not find AppIndicator dev package." >&2
        exit 1
      }

      sudo apt-get install -y \
        build-essential curl wget file pkg-config libssl-dev libglib2.0-dev \
        libgtk-3-dev "$appindicator_pkg" librsvg2-dev \
        patchelf "$webkit_pkg" libxdo-dev
      check_glib_version
      ;;
    dnf)
      sudo dnf install -y \
        gcc gcc-c++ make curl wget file pkgconf-pkg-config openssl-devel \
        glib2-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel \
        patchelf webkit2gtk4.1-devel xdotool
      check_glib_version
      ;;
    pacman)
      sudo pacman -Sy --needed --noconfirm \
        base-devel curl wget file pkgconf openssl \
        glib2 gtk3 libappindicator-gtk3 librsvg webkit2gtk patchelf xdotool
      check_glib_version
      ;;
  esac
}

ensure_rust() {
  if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    log "Rust already installed: $(rustc --version)"
    return
  fi

  log "Installing Rust via rustup"
  ensure_cmd curl
  curl https://sh.rustup.rs -sSf | sh -s -- -y

  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
  log "Rust installed: $(rustc --version)"
}

ensure_node_npm() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "Node present: $(node --version), npm: $(npm --version)"
    return
  fi

  cat <<'EOF' >&2
[bootstrap] Node.js/npm not found.
Install Node 20+ first (nvm recommended), then rerun this script.
EOF
  exit 1
}

install_project_deps() {
  log "Installing project dependencies (including devDependencies)"
  cd "$PROJECT_DIR"

  export npm_config_production=false
  npm install --include=dev

  log "Validating Tauri CLI from local dependencies"
  npm exec tauri -- --version
}

print_next_steps() {
  cat <<EOF

[bootstrap] Completed successfully.

Next steps:
  cd "$PROJECT_DIR"
  npm run tauri dev
EOF
}

main() {
  log "Project dir: $PROJECT_DIR"
  install_system_deps
  ensure_rust
  ensure_node_npm
  install_project_deps
  print_next_steps
}

main "$@"
