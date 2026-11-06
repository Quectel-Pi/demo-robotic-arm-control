#!/usr/bin/env bash
set -Eeuo pipefail

# Resolve the installation paths independently of the caller's working directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="demo-robotic-arm-control.service"
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
ACTION="${1:-}"

usage() {
  printf 'Usage: bash scripts/manage_autostart.sh [enable|disable|status]\n'
}

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 2
fi

if [[ -z "$ACTION" ]]; then
  if [[ ! -t 0 ]]; then
    usage >&2
    exit 2
  fi
  printf 'Choose web-console startup behavior:\n'
  printf '  1) Enable auto-start at boot\n'
  printf '  2) Disable auto-start\n'
  printf '  3) Show service status\n'
  read -r -p 'Select [1-3]: ' choice
  case "$choice" in
    1) ACTION="enable" ;;
    2) ACTION="disable" ;;
    3) ACTION="status" ;;
    *) printf 'No changes made.\n'; exit 0 ;;
  esac
fi

case "$ACTION" in
  enable|disable|status) ;;
  *) usage >&2; exit 2 ;;
esac

if ! command -v systemctl >/dev/null 2>&1; then
  printf 'systemd/systemctl is not available on this system.\n' >&2
  exit 1
fi

if (( EUID == 0 )); then
  SUDO=()
else
  if ! command -v sudo >/dev/null 2>&1; then
    printf 'sudo is required to manage a system service.\n' >&2
    exit 1
  fi
  SUDO=(sudo)
fi

run_systemctl() {
  "${SUDO[@]}" systemctl "$@"
}

case "$ACTION" in
  status)
    run_systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || true
    run_systemctl status --no-pager "$SERVICE_NAME" || true
    exit 0
    ;;
  disable)
    if [[ ! -f "$SERVICE_PATH" ]]; then
      printf 'The project auto-start service is not installed.\n'
      exit 0
    fi
    run_systemctl disable "$SERVICE_NAME"
    printf 'Auto-start disabled. A currently running service is left running until it is stopped or the board is rebooted.\n'
    exit 0
    ;;
esac

if [[ ! -x "$PROJECT_DIR/.venv/bin/python" ]]; then
  printf 'Environment is not installed. Run: bash "%s/deploy_environment.sh"\n' "$SCRIPT_DIR" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/config.yaml" ]]; then
  printf 'Configuration file not found: %s/config.yaml\n' "$PROJECT_DIR" >&2
  exit 1
fi

SERVICE_USER="${SUDO_USER:-$(stat -c '%U' "$PROJECT_DIR")}"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  printf 'Could not find the project service user: %s\n' "$SERVICE_USER" >&2
  exit 1
fi
SERVICE_GROUP="$(id -gn "$SERVICE_USER")"

# Escape systemd path metacharacters before embedding the project path in a unit.
systemd_escape_path() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//%/%%}"
  value="${value// /\\x20}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

SYSTEMD_PROJECT_DIR="$(systemd_escape_path "$PROJECT_DIR")"
DIALOUT_SETTING=""
# Keep the service user's UART access when the standard dialout group exists.
if getent group dialout >/dev/null 2>&1; then
  DIALOUT_SETTING="SupplementaryGroups=dialout"
fi

UNIT_TMP="$(mktemp)"
trap 'rm -f "$UNIT_TMP"' EXIT
# Write the unit to a temporary file before installing it under /etc/systemd.
cat > "$UNIT_TMP" <<EOF
[Unit]
Description=Jibot1 Robotic Arm Web Console
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
$DIALOUT_SETTING
WorkingDirectory=$SYSTEMD_PROJECT_DIR
ExecStart=/bin/bash scripts/start_web.sh
Environment=DEMO_M2_WEB_HOST=0.0.0.0
Environment=DEMO_M2_WEB_PORT=8080
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
KillSignal=SIGINT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

"${SUDO[@]}" install -o root -g root -m 0644 "$UNIT_TMP" "$SERVICE_PATH"
run_systemctl daemon-reload

if command -v ss >/dev/null 2>&1 && ss -ltnH 'sport = :8080' 2>/dev/null | grep -q .; then
  run_systemctl enable "$SERVICE_NAME"
  printf 'Auto-start enabled. Port 8080 already has a listener, so it was left untouched; systemd will start the console after reboot.\n'
else
  run_systemctl enable --now "$SERVICE_NAME"
  printf 'Auto-start enabled and the web console has been started.\n'
fi

printf 'Service status: bash scripts/manage_autostart.sh status\n'
