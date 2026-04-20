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

ensure_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "[bootstrap] This script is for macOS only." >&2
    exit 1
  fi
}

ensure_xcode_clt() {
  if xcode-select -p >/dev/null 2>&1; then
    log "Xcode Command Line Tools present"
    return
  fi

  cat <<'EOF' >&2
[bootstrap] Xcode Command Line Tools are required.
Run this first, complete the installer, then rerun:
  xcode-select --install
EOF
  exit 1
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
  ensure_macos
  ensure_xcode_clt
  ensure_rust
  ensure_node_npm
  install_project_deps
  print_next_steps
}

main "$@"
