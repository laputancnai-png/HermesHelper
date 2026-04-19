#!/usr/bin/env bash
set -euo pipefail

# Make cargo available for Tauri subprocesses on fresh Linux/macOS shells.
if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
elif [[ -d "$HOME/.cargo/bin" ]]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

exec tauri "$@"
