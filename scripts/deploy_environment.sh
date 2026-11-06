#!/usr/bin/env bash
set -Eeuo pipefail

# Resolve paths from this script so it can be run from any working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  printf 'Python executable not found: %s\n' "$PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/pyproject.toml" ]]; then
  printf 'Project metadata not found in %s\n' "$PROJECT_DIR" >&2
  exit 1
fi

"$PYTHON_BIN" -m venv "$PROJECT_DIR/.venv" || {
  printf 'Could not create the virtual environment. Install python3-venv, then retry.\n' >&2
  exit 1
}

"$PROJECT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$PROJECT_DIR/.venv/bin/python" -m pip install --editable "$PROJECT_DIR"

printf 'Environment is ready in %s/.venv\n' "$PROJECT_DIR"
