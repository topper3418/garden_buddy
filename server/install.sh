#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (example: sudo bash server/install.sh)"
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

detect_default_server_name() {
  local host_name
  host_name="$(hostname -f 2>/dev/null || hostname 2>/dev/null || true)"

  if [[ -z "${host_name}" || "${host_name}" == "localhost" || "${host_name}" == "localhost.localdomain" ]]; then
    printf '_\n'
    return
  fi

  printf 'garden.%s\n' "${host_name}"
}

validate_port() {
  local value="$1"
  [[ "${value}" =~ ^[0-9]+$ ]] || return 1
  (( value >= 1 && value <= 65535 )) || return 1
}

is_port_in_use() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "( sport = :${port} )" | grep -q .
    return
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null
    return
  fi

  return 1
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

find_route_conflicts() {
  local route="$1"
  local conf

  shopt -s nullglob
  for conf in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [[ -f "${conf}" ]] || continue

    if [[ "$(basename "${conf}")" == "${SERVICE_NAME}.conf" ]]; then
      continue
    fi

    if [[ "${SERVER_NAME}" != "_" ]]; then
      local -a conf_server_names=()
      local server_name_matches=false
      local conf_name

      mapfile -t conf_server_names < <(awk '$1 == "server_name" { for (i = 2; i <= NF; i += 1) { gsub(/;$/, "", $i); print $i } }' "${conf}")

      # If no server_name is declared, treat config as unrelated for named-host installs.
      if [[ "${#conf_server_names[@]}" -eq 0 ]]; then
        continue
      fi

      for conf_name in "${conf_server_names[@]}"; do
        if [[ "${conf_name}" == "_" || "${SERVER_NAME}" == ${conf_name} ]]; then
          server_name_matches=true
          break
        fi
      done

      if [[ "${server_name_matches}" != true ]]; then
        continue
      fi
    fi

    while read -r location_path; do
      [[ -z "${location_path}" ]] && continue

      if [[ "${location_path}" != "/" && "${location_path}" != "${route}" && "${route}" != "${location_path}"* && "${location_path}" != "${route}"* ]]; then
        continue
      fi

      # Allow install at '/' when only the stock default site owns '/'.
      if [[ "${route}" == "/" && "${SERVER_NAME}" == "_" && "${conf}" == "/etc/nginx/sites-enabled/default" ]]; then
        continue
      fi

      printf '%s\n' "${conf}"
      break
    done < <(awk '$1 == "location" { if ($2 ~ /^(=|\^~|~|~\*)$/) { path = $3 } else { path = $2 } gsub(/\{/, "", path); print path }' "${conf}")
  done
  shopt -u nullglob
}

resolve_port_conflict() {
  local current_port="$1"

  echo
  echo "Backend port '${current_port}' is already in use."

  if [[ ! -t 0 ]]; then
    echo "Install cancelled because APP_PORT is already in use."
    echo "Set APP_PORT to a free port or run: sudo bash server/uninstall.sh"
    exit 1
  fi

  while true; do
    echo
    echo "Choose an action:"
    echo "  1) Select a new backend port"
    echo "  2) Run uninstall script now (server/uninstall.sh)"
    echo "  3) Cancel install"
    read -r -p "Selection (1/2/3): " selection

    case "${selection}" in
      1)
        read -r -p "New backend port (1-65535): " new_port
        if ! validate_port "${new_port}"; then
          echo "Invalid port. Enter a number between 1 and 65535."
          continue
        fi
        APP_PORT="${new_port}"
        return
        ;;
      2)
        read -r -p "Run uninstall now? [y/N]: " confirm_uninstall
        if [[ "${confirm_uninstall}" =~ ^[Yy]$ ]]; then
          bash "${SCRIPT_DIR}/uninstall.sh"
          return
        fi
        ;;
      3)
        echo "Install cancelled by user."
        exit 1
        ;;
      *)
        echo "Invalid selection. Please enter 1, 2, or 3."
        ;;
    esac
  done
}

resolve_route_conflict() {
  local -a conflicts=("$@")

  echo
  echo "Route '${APP_ROUTE}' is already in use by nginx:"
  for conf in "${conflicts[@]}"; do
    echo "  - ${conf}"
  done

  if [[ ! -t 0 ]]; then
    echo "Install cancelled because APP_ROUTE conflicts with an existing nginx route."
    echo "Set APP_ROUTE to a new value or run: sudo bash server/uninstall.sh"
    exit 1
  fi

  while true; do
    echo
    echo "Choose an action:"
    echo "  1) Select a new route"
    echo "  2) Run uninstall script now (server/uninstall.sh)"
    echo "  3) Cancel install"
    read -r -p "Selection (1/2/3): " selection

    case "${selection}" in
      1)
        read -r -p "New route prefix (blank for '/'): " APP_ROUTE_INPUT
        APP_ROUTE="$(normalize_route "${APP_ROUTE_INPUT}")"
        set_route_dependent_settings
        return
        ;;
      2)
        read -r -p "Run uninstall now? [y/N]: " confirm_uninstall
        if [[ "${confirm_uninstall}" =~ ^[Yy]$ ]]; then
          bash "${SCRIPT_DIR}/uninstall.sh"
          return
        fi
        ;;
      3)
        echo "Install cancelled by user."
        exit 1
        ;;
      *)
        echo "Invalid selection. Please enter 1, 2, or 3."
        ;;
    esac
  done
}

APP_DIR="${APP_DIR:-${REPO_DIR}}"
APP_USER="${APP_USER:-${SUDO_USER:-$(id -un)}}"
APP_GROUP_INPUT="${APP_GROUP:-}"
SERVICE_NAME="${SERVICE_NAME:-garden-buddy}"
STATIC_DIR="${STATIC_DIR:-/var/www/${SERVICE_NAME}}"
SERVER_NAME="${SERVER_NAME:-$(detect_default_server_name)}"
APP_ROUTE_INPUT="${APP_ROUTE:-}"
APP_PORT="${APP_PORT:-8001}"

if ! validate_port "${APP_PORT}"; then
  echo "APP_PORT must be an integer between 1 and 65535."
  exit 1
fi

if [[ -z "${APP_ROUTE_INPUT}" && -t 0 ]]; then
  read -r -p "Route prefix for app (blank for '/'; example '/garden/'): " APP_ROUTE_INPUT
fi

APP_ROUTE="$(normalize_route "${APP_ROUTE_INPUT}")"
set_route_dependent_settings

ENV_DIR="/etc/garden-buddy"
ENV_FILE="${ENV_DIR}/garden-buddy.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"

while true; do
  mapfile -t route_conflicts < <(find_route_conflicts "${APP_ROUTE}")
  if [[ "${#route_conflicts[@]}" -eq 0 ]]; then
    break
  fi

  resolve_route_conflict "${route_conflicts[@]}"
done

existing_service_port=''
if [[ -f "${SERVICE_FILE}" ]]; then
  existing_service_port="$(grep -Eo -- '--port[[:space:]]+[0-9]+' "${SERVICE_FILE}" | awk '{print $2}' | head -n 1 || true)"
fi

while is_port_in_use "${APP_PORT}"; do
  if [[ -n "${existing_service_port}" && "${APP_PORT}" == "${existing_service_port}" ]]; then
    break
  fi
  resolve_port_conflict "${APP_PORT}"
done

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently supports Debian/Ubuntu (apt-get) only."
  exit 1
fi

echo "[1/9] Installing system dependencies..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 \
  python3-venv \
  python3-pip \
  nginx \
  nodejs \
  npm

echo "[2/9] Preparing app directories..."
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "${APP_USER}"
fi

if [[ -n "${APP_GROUP_INPUT}" ]]; then
  APP_GROUP="${APP_GROUP_INPUT}"
else
  APP_GROUP="$(id -gn "${APP_USER}")"
fi

mkdir -p "${APP_DIR}/data/logs" "${APP_DIR}/data/media"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}/data"

echo "[3/9] Creating and populating Python virtual environment..."
if [[ ! -d "${APP_DIR}/venv" ]]; then
  sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/venv"
fi
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

echo "[4/9] Installing frontend dependencies and building assets..."
if [[ -f "${APP_DIR}/frontend/package-lock.json" ]]; then
  sudo -u "${APP_USER}" npm ci --prefix "${APP_DIR}/frontend"
else
  sudo -u "${APP_USER}" npm install --prefix "${APP_DIR}/frontend"
fi
sudo -u "${APP_USER}" env VITE_API_BASE_URL="${API_BASE_URL}" npm run build --prefix "${APP_DIR}/frontend" -- --base "${APP_ROUTE}"

echo "[5/9] Publishing frontend assets for nginx..."
if [[ "${STATIC_DIR}" == "/" ]]; then
  echo "STATIC_DIR cannot be '/'"
  exit 1
fi
mkdir -p "${STATIC_DIR}"
rm -rf "${STATIC_DIR:?}"/*
cp -a "${APP_DIR}/frontend/dist/." "${STATIC_DIR}/"
chown -R root:root "${STATIC_DIR}"
chmod -R a+rX "${STATIC_DIR}"

echo "[6/9] Creating environment file (if missing)..."
mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/garden-buddy.env.template" "${ENV_FILE}"
fi
chown root:"${APP_GROUP}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"

echo "[7/9] Rendering systemd service and nginx config..."
sed \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  -e "s|__APP_USER__|${APP_USER}|g" \
  -e "s|__APP_GROUP__|${APP_GROUP}|g" \
  -e "s|__APP_PORT__|${APP_PORT}|g" \
  -e "s|__ENV_FILE__|${ENV_FILE}|g" \
  "${SCRIPT_DIR}/garden-buddy.service.template" > "${SERVICE_FILE}"

sed \
  -e "s|__STATIC_DIR__|${STATIC_DIR}|g" \
  -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
  -e "s|__APP_ROUTE__|${APP_ROUTE}|g" \
  -e "s|__APP_ROUTE_REDIRECT_MATCH__|${APP_ROUTE_REDIRECT_MATCH}|g" \
  -e "s|__API_ROUTE__|${API_ROUTE}|g" \
  -e "s|__APP_PORT__|${APP_PORT}|g" \
  -e "s|__FRONTEND_FALLBACK__|${FRONTEND_FALLBACK}|g" \
  "${SCRIPT_DIR}/garden-buddy.nginx.conf.template" > "${NGINX_AVAILABLE}"

ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
if [[ "${APP_ROUTE}" == "/" && "${SERVER_NAME}" == "_" && -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "[8/9] Starting/restarting services..."
nginx -t
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl enable --now nginx
systemctl restart nginx

echo "[9/9] Verifying backend health..."
if ! curl -fsS "http://127.0.0.1:${APP_PORT}/health" >/dev/null; then
  echo "Warning: backend healthcheck failed. Check logs with:"
  echo "  journalctl -u ${SERVICE_NAME} -n 200 --no-pager"
  exit 1
fi

if ! curl -fsS "http://127.0.0.1${APP_ROUTE}" >/dev/null; then
  echo "Warning: nginx frontend check failed. Check logs with:"
  echo "  journalctl -u nginx -n 200 --no-pager"
  exit 1
fi

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Garden Buddy deployment complete."
if [[ "${SERVER_NAME}" == "_" ]]; then
  echo "App URL: http://${HOST_IP:-<server-ip>}${APP_ROUTE}"
else
  echo "App URL: http://${SERVER_NAME}${APP_ROUTE}"
  echo "Host fallback URL: http://${HOST_IP:-<server-ip>}${APP_ROUTE}"
fi
echo "Route prefix: ${APP_ROUTE}"
echo "Backend port: ${APP_PORT}"
echo "API base URL for frontend build: ${API_BASE_URL}"
echo "Seed script was NOT run automatically. Start is fresh/unseeded by default."
echo "Server name configured for nginx: ${SERVER_NAME}"
echo "Service status: systemctl status ${SERVICE_NAME}"
