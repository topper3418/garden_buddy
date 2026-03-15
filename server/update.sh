#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (example: sudo bash server/update.sh)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

normalize_route() {
  local raw="$1"
  raw="$(printf '%s' "$raw" | tr -d '[:space:]')"

  if [[ -z "$raw" || "$raw" == "/" ]]; then
    printf '/\n'
    return
  fi

  if [[ "$raw" != /* ]]; then
    raw="/$raw"
  fi
  if [[ "$raw" != */ ]]; then
    raw="$raw/"
  fi

  raw="$(printf '%s' "$raw" | sed -E 's#/+#/#g')"
  if [[ "$raw" =~ [\?#] ]]; then
    echo "Route must be a clean path prefix (no query or fragment)." >&2
    exit 1
  fi

  printf '%s\n' "$raw"
}

set_route_dependent_settings() {
  if [[ "${APP_ROUTE}" == "/" ]]; then
    API_ROUTE="/api/"
    API_BASE_URL="/api"
    FRONTEND_FALLBACK="index.html"
    APP_ROUTE_REDIRECT_MATCH="= /__garden-buddy-noop__"
  else
    API_ROUTE="${APP_ROUTE}api/"
    API_BASE_URL="${APP_ROUTE}api"
    FRONTEND_FALLBACK="${APP_ROUTE#/}index.html"
    APP_ROUTE_REDIRECT_MATCH="= ${APP_ROUTE%/}"
  fi
}

validate_port() {
  local value="$1"
  [[ "${value}" =~ ^[0-9]+$ ]] || return 1
  (( value >= 1 && value <= 65535 )) || return 1
}

detect_port_from_service() {
  local default_port='8001'

  if [[ ! -f "${SERVICE_FILE}" ]]; then
    printf '%s\n' "${default_port}"
    return
  fi

  local detected
  detected="$(grep -Eo -- '--port[[:space:]]+[0-9]+' "${SERVICE_FILE}" | awk '{print $2}' | head -n 1 || true)"
  if validate_port "${detected}"; then
    printf '%s\n' "${detected}"
    return
  fi

  printf '%s\n' "${default_port}"
}

detect_server_name_from_nginx() {
  local default_server_name='_'

  if [[ ! -f "${NGINX_AVAILABLE}" ]]; then
    printf '%s\n' "${default_server_name}"
    return
  fi

  local detected
  detected="$(awk '$1 == "server_name" { gsub(/;$/, "", $2); print $2; exit }' "${NGINX_AVAILABLE}")"
  if [[ -n "${detected}" ]]; then
    printf '%s\n' "${detected}"
    return
  fi

  printf '%s\n' "${default_server_name}"
}

detect_static_dir_from_nginx() {
  local default_static_dir="/var/www/${SERVICE_NAME}"

  if [[ ! -f "${NGINX_AVAILABLE}" ]]; then
    printf '%s\n' "${default_static_dir}"
    return
  fi

  local detected
  detected="$(awk '$1 == "alias" { gsub(/;$/, "", $2); sub(/\/$/, "", $2); print $2; exit }' "${NGINX_AVAILABLE}")"
  if [[ -n "${detected}" ]]; then
    printf '%s\n' "${detected}"
    return
  fi

  printf '%s\n' "${default_static_dir}"
}

detect_route_from_nginx() {
  local default_route='/'
  if [[ ! -f "${NGINX_AVAILABLE}" ]]; then
    printf '%s\n' "${default_route}"
    return
  fi

  local candidate
  local detected=''
  while read -r candidate; do
    if [[ -z "${candidate}" ]]; then
      continue
    fi
    if [[ "${candidate}" == */api/ ]]; then
      continue
    fi
    detected="${candidate}"
  done < <(awk '$1 == "location" { gsub(/\{/, "", $2); print $2 }' "${NGINX_AVAILABLE}")

  if [[ -z "${detected}" ]]; then
    printf '%s\n' "${default_route}"
    return
  fi

  printf '%s\n' "${detected}"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempt

  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt += 1)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${HEALTH_DELAY_SECONDS}"
  done

  echo "${label} health check failed after ${HEALTH_RETRIES} attempts."
  return 1
}

APP_DIR="${APP_DIR:-${REPO_DIR}}"
SERVICE_NAME="${SERVICE_NAME:-garden-buddy}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-false}"
APP_ROUTE_INPUT="${APP_ROUTE:-}"
HEALTH_RETRIES="${HEALTH_RETRIES:-25}"
HEALTH_DELAY_SECONDS="${HEALTH_DELAY_SECONDS:-1}"
APP_PORT="${APP_PORT:-$(detect_port_from_service)}"
SERVER_NAME="${SERVER_NAME:-$(detect_server_name_from_nginx)}"
STATIC_DIR="${STATIC_DIR:-$(detect_static_dir_from_nginx)}"

if ! validate_port "${APP_PORT}"; then
  echo "APP_PORT must be an integer between 1 and 65535."
  exit 1
fi

DEFAULT_APP_USER="$(stat -c '%U' "${APP_DIR}")"
APP_USER="${APP_USER:-${SUDO_USER:-${DEFAULT_APP_USER}}}"

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "APP_USER '${APP_USER}' does not exist."
  exit 1
fi

if [[ ! -f "${SERVICE_FILE}" ]]; then
  echo "Service file not found: ${SERVICE_FILE}"
  echo "Run the installer first: sudo bash server/install.sh"
  exit 1
fi

if [[ ! -f "${NGINX_AVAILABLE}" ]]; then
  echo "Nginx site config not found: ${NGINX_AVAILABLE}"
  echo "Run the installer first: sudo bash server/install.sh"
  exit 1
fi

if [[ -z "${APP_ROUTE_INPUT}" ]]; then
  APP_ROUTE_INPUT="$(detect_route_from_nginx)"
fi
APP_ROUTE="$(normalize_route "${APP_ROUTE_INPUT}")"
set_route_dependent_settings

echo "[1/7] Updating repository..."
if [[ "${SKIP_GIT_PULL}" == "true" ]]; then
  echo "Skipping git pull (SKIP_GIT_PULL=true)."
else
  if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "${APP_DIR} is not a git repository."
    exit 1
  fi

  if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --quiet || ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --cached --quiet; then
    echo "Local git changes detected in ${APP_DIR}."
    echo "Commit/stash local changes or rerun with SKIP_GIT_PULL=true."
    exit 1
  fi

  sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all --prune
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only
fi

echo "[2/7] Refreshing Python dependencies..."
if [[ ! -d "${APP_DIR}/venv" ]]; then
  sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/venv"
fi
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

echo "[3/7] Installing frontend dependencies..."
if [[ -f "${APP_DIR}/frontend/package-lock.json" ]]; then
  sudo -u "${APP_USER}" npm ci --prefix "${APP_DIR}/frontend"
else
  sudo -u "${APP_USER}" npm install --prefix "${APP_DIR}/frontend"
fi

echo "[4/7] Building frontend assets..."
sudo -u "${APP_USER}" env VITE_API_BASE_URL="${API_BASE_URL}" npm run build --prefix "${APP_DIR}/frontend" -- --base "${APP_ROUTE}"

echo "[5/7] Publishing frontend assets..."
if [[ "${STATIC_DIR}" == "/" ]]; then
  echo "STATIC_DIR cannot be '/'."
  exit 1
fi
mkdir -p "${STATIC_DIR}"
rm -rf "${STATIC_DIR:?}"/*
cp -a "${APP_DIR}/frontend/dist/." "${STATIC_DIR}/"
chown -R root:root "${STATIC_DIR}"
chmod -R a+rX "${STATIC_DIR}"

echo "[6/7] Rendering nginx config and restarting services..."
sed \
  -e "s|__STATIC_DIR__|${STATIC_DIR}|g" \
  -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
  -e "s|__APP_ROUTE__|${APP_ROUTE}|g" \
  -e "s|__APP_ROUTE_REDIRECT_MATCH__|${APP_ROUTE_REDIRECT_MATCH}|g" \
  -e "s|__API_ROUTE__|${API_ROUTE}|g" \
  -e "s|__APP_PORT__|${APP_PORT}|g" \
  -e "s|__FRONTEND_FALLBACK__|${FRONTEND_FALLBACK}|g" \
  "${SCRIPT_DIR}/garden-buddy.nginx.conf.template" > "${NGINX_AVAILABLE}"

nginx -t
systemctl daemon-reload
systemctl restart "${SERVICE_NAME}"
systemctl restart nginx

echo "[7/7] Verifying health checks..."
if ! wait_for_http "http://127.0.0.1:${APP_PORT}/health" "Backend"; then
  echo "Check logs: journalctl -u ${SERVICE_NAME} -n 200 --no-pager"
  exit 1
fi

if ! wait_for_http "http://127.0.0.1${APP_ROUTE}" "Frontend"; then
  echo "Check route: ${APP_ROUTE}"
  echo "Check logs: journalctl -u nginx -n 200 --no-pager"
  exit 1
fi

echo
echo "Garden Buddy update complete."
echo "Route prefix: ${APP_ROUTE}"
echo "Backend port: ${APP_PORT}"
echo "API base URL for frontend build: ${API_BASE_URL}"
echo "Service status: systemctl status ${SERVICE_NAME}"
