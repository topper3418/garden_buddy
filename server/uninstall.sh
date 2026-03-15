#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (example: sudo bash server/uninstall.sh)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_DIR="${APP_DIR:-${REPO_DIR}}"
SERVICE_NAME="${SERVICE_NAME:-garden-buddy}"
STATIC_DIR="${STATIC_DIR:-/var/www/${SERVICE_NAME}}"
ENV_DIR="/etc/garden-buddy"
ENV_FILE="${ENV_DIR}/garden-buddy.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
REMOVE_ENV_FILE="${REMOVE_ENV_FILE:-false}"
REMOVE_BUILD_ARTIFACTS="${REMOVE_BUILD_ARTIFACTS:-true}"

log() {
  printf '%s\n' "$1"
}

run_or_warn() {
  if ! "$@"; then
    log "Warning: command failed: $*"
  fi
}

log "[1/6] Stopping and disabling service if present..."
if command -v systemctl >/dev/null 2>&1; then
  run_or_warn systemctl disable --now "${SERVICE_NAME}"
fi

log "[2/6] Removing systemd unit..."
rm -f "${SERVICE_FILE}"
if command -v systemctl >/dev/null 2>&1; then
  run_or_warn systemctl daemon-reload
fi

log "[3/6] Removing nginx site config/symlink..."
rm -f "${NGINX_ENABLED}"
rm -f "${NGINX_AVAILABLE}"

log "[4/6] Reloading nginx if installed..."
if command -v nginx >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
  run_or_warn nginx -t
  run_or_warn systemctl reload nginx
fi

log "[5/6] Removing environment file (optional)..."
if [[ "${REMOVE_ENV_FILE}" == "true" ]]; then
  rm -f "${ENV_FILE}"
  rmdir --ignore-fail-on-non-empty "${ENV_DIR}" || true
fi

log "[6/6] Removing local build/runtime artifacts (optional)..."
if [[ "${REMOVE_BUILD_ARTIFACTS}" == "true" ]]; then
  rm -rf "${APP_DIR}/venv"
  rm -rf "${APP_DIR}/frontend/node_modules"
  rm -rf "${APP_DIR}/frontend/dist"
  rm -rf "${STATIC_DIR}"
fi

log "Uninstall cleanup complete."
log "Note: project source files and data/ were not deleted."
