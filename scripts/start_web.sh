#!/usr/bin/env bash
set -Eeuo pipefail

# Resolve paths from this script so it can be run from any working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_PYTHON="$PROJECT_DIR/.venv/bin/python"

if [[ ! -x "$VENV_PYTHON" ]]; then
  printf 'Environment is not installed. Run: bash "%s/deploy_environment.sh"\n' "$SCRIPT_DIR" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/config.yaml" ]]; then
  printf 'Configuration file not found: %s/config.yaml\n' "$PROJECT_DIR" >&2
  exit 1
fi

WEB_HOST="${DEMO_M2_WEB_HOST:-0.0.0.0}"
WEB_PORT="${DEMO_M2_WEB_PORT:-8080}"

# Keep relative project resources anchored to the repository root.
cd "$PROJECT_DIR"
exec "$VENV_PYTHON" -m demo_robotic_arm_control.app.web_server \
  --config "$PROJECT_DIR/config.yaml" \
  --host "$WEB_HOST" \
  --port "$WEB_PORT"
