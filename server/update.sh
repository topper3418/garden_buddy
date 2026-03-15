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
    ROOT_ROUTE_REDIRECT_MATCH="= /__garden-buddy-root-noop__"
  else
    API_ROUTE="${APP_ROUTE}api/"
    API_BASE_URL="${APP_ROUTE}api"
    FRONTEND_FALLBACK="${APP_ROUTE#/}index.html"
    APP_ROUTE_REDIRECT_MATCH="= ${APP_ROUTE%/}"
    ROOT_ROUTE_REDIRECT_MATCH="= /"
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

load_env_value_from_file() {
  local key="$1"
  local file_path="$2"

  [[ -f "${file_path}" ]] || return 0

  awk -v key="${key}" '
    /^[[:space:]]*#/ { next }
    {
      line = $0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      if (line ~ "^[[:space:]]*" key "[[:space:]]*=") {
        sub("^[[:space:]]*" key "[[:space:]]*=[[:space:]]*", "", line)
        sub(/[[:space:]]+$/, "", line)
        if ((line ~ /^".*"$/) || (line ~ /^\047.*\047$/)) {
          line = substr(line, 2, length(line) - 2)
        }
        print line
        exit
      }
    }
  ' "${file_path}"
}

upsert_env_value() {
  local file_path="$1"
  local key="$2"
  local value="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v key="${key}" -v value="${value}" '
    BEGIN { updated = 0 }
    {
      line = $0
      if (!updated && line ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*=") {
        print key "=" value
        updated = 1
      } else {
        print $0
      }
    }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "${file_path}" > "${tmp_file}"

  mv "${tmp_file}" "${file_path}"
}

is_missing_or_placeholder_ai_value() {
  local raw="$1"
  local normalized
  normalized="$(printf '%s' "${raw}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"

  if [[ -z "${normalized}" ]]; then
    return 0
  fi
  if [[ "${normalized}" == your_openai_* ]]; then
    return 0
  fi
  if [[ "${normalized}" == "change-me" || "${normalized}" == "changeme" || "${normalized}" == "replace-me" ]]; then
    return 0
  fi
  if [[ "${normalized}" == *"example.invalid"* ]]; then
    return 0
  fi

  return 1
}

sync_ai_env_from_repo_dotenv() {
  local source_env_file="${APP_DIR}/.env"
  local -a ai_keys=(GB_OPENAI_API_KEY GB_OPENAI_API_ENDPOINT GB_OPENAI_API_MODEL)

  [[ -f "${source_env_file}" ]] || return 0

  for key in "${ai_keys[@]}"; do
    local source_value
    local target_value

    source_value="$(load_env_value_from_file "${key}" "${source_env_file}")"
    if is_missing_or_placeholder_ai_value "${source_value}"; then
      continue
    fi

    target_value="$(load_env_value_from_file "${key}" "${ENV_FILE}")"
    if is_missing_or_placeholder_ai_value "${target_value}"; then
      upsert_env_value "${ENV_FILE}" "${key}" "${source_value}"
    fi
  done
}

ensure_ai_env_ready() {
  local -a ai_keys=(GB_OPENAI_API_KEY GB_OPENAI_API_ENDPOINT GB_OPENAI_API_MODEL)
  local -a missing_keys=()

  for key in "${ai_keys[@]}"; do
    local value
    value="$(load_env_value_from_file "${key}" "${ENV_FILE}")"
    if is_missing_or_placeholder_ai_value "${value}"; then
      missing_keys+=("${key}")
    fi
  done

  if [[ "${#missing_keys[@]}" -gt 0 ]]; then
    echo "AI configuration is incomplete in ${ENV_FILE}."
    echo "Missing or placeholder values: ${missing_keys[*]}"
    echo "Populate ${ENV_FILE} directly or set valid values in ${APP_DIR}/.env and rerun update."
    exit 1
  fi
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

get_default_route_ipv4() {
  local preferred
  preferred="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i += 1) if ($i == "src") { print $(i + 1); exit }}' || true)"
  if [[ -n "${preferred}" ]]; then
    printf '%s\n' "${preferred}"
  fi
}

get_all_ipv4_addrs() {
  ip -4 -o addr show scope global 2>/dev/null | awk '{ split($4, parts, "/"); print parts[1] }'
}

APP_DIR="${APP_DIR:-${REPO_DIR}}"
SERVICE_NAME="${SERVICE_NAME:-garden-buddy}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
ENV_DIR="/etc/garden-buddy"
ENV_FILE="${ENV_DIR}/garden-buddy.env"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-false}"
APP_ROUTE_INPUT="${APP_ROUTE:-/}"
HEALTH_RETRIES="${HEALTH_RETRIES:-25}"
HEALTH_DELAY_SECONDS="${HEALTH_DELAY_SECONDS:-1}"
APP_PORT="${APP_PORT:-$(detect_port_from_service)}"
SERVER_NAME='_'
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

APP_ROUTE="$(normalize_route "${APP_ROUTE_INPUT}")"
if [[ "${APP_ROUTE}" != "/" ]]; then
  echo "Only root route '/' is supported by update.sh."
  echo "Unset APP_ROUTE or set APP_ROUTE='/' and retry."
  exit 1
fi
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

mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/garden-buddy.env.template" "${ENV_FILE}"
fi
sync_ai_env_from_repo_dotenv
ensure_ai_env_ready

echo "[6/7] Rendering nginx config and restarting services..."
sed \
  -e "s|__STATIC_DIR__|${STATIC_DIR}|g" \
  -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
  -e "s|__APP_ROUTE__|${APP_ROUTE}|g" \
  -e "s|__ROOT_ROUTE_REDIRECT_MATCH__|${ROOT_ROUTE_REDIRECT_MATCH}|g" \
  -e "s|__APP_ROUTE_REDIRECT_MATCH__|${APP_ROUTE_REDIRECT_MATCH}|g" \
  -e "s|__API_ROUTE__|${API_ROUTE}|g" \
  -e "s|__APP_PORT__|${APP_PORT}|g" \
  -e "s|__FRONTEND_FALLBACK__|${FRONTEND_FALLBACK}|g" \
  "${SCRIPT_DIR}/garden-buddy.nginx.conf.template" > "${NGINX_AVAILABLE}"

if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

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

PREFERRED_IP="$(get_default_route_ipv4 || true)"
if [[ -z "${PREFERRED_IP}" ]]; then
  PREFERRED_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
mapfile -t ALL_IPV4_ADDRS < <(get_all_ipv4_addrs | awk '!seen[$0]++')

echo
echo "Garden Buddy update complete."
if [[ -n "${PREFERRED_IP}" ]]; then
  echo "Preferred app URL: http://${PREFERRED_IP}${APP_ROUTE}"
else
  echo "Preferred app URL: http://<server-ip>${APP_ROUTE}"
fi

if [[ "${#ALL_IPV4_ADDRS[@]}" -gt 1 ]]; then
  echo "Other app URLs (choose the one on the same subnet as your client):"
  for ip in "${ALL_IPV4_ADDRS[@]}"; do
    if [[ "${ip}" == "${PREFERRED_IP}" ]]; then
      continue
    fi
    echo "  - http://${ip}${APP_ROUTE}"
  done
fi

echo "Route prefix: ${APP_ROUTE}"
echo "Backend port: ${APP_PORT}"
echo "API base URL for frontend build: ${API_BASE_URL}"
echo "Service status: systemctl status ${SERVICE_NAME}"
