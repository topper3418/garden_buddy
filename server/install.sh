#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (example: sudo bash server/install.sh)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_DIR="${APP_DIR:-${REPO_DIR}}"
APP_USER="${APP_USER:-${SUDO_USER:-$(id -un)}}"
APP_GROUP="${APP_GROUP:-$(id -gn "${APP_USER}")}"
SERVICE_NAME="${SERVICE_NAME:-garden-buddy}"
SERVER_NAME="${SERVER_NAME:-_}"
ENV_DIR="/etc/garden-buddy"
ENV_FILE="${ENV_DIR}/garden-buddy.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently supports Debian/Ubuntu (apt-get) only."
  exit 1
fi

echo "[1/8] Installing system dependencies..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 \
  python3-venv \
  python3-pip \
  nginx \
  nodejs \
  npm

echo "[2/8] Preparing app directories..."
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "${APP_USER}"
fi
mkdir -p "${APP_DIR}/data/logs" "${APP_DIR}/data/media"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}/data"

echo "[3/8] Creating and populating Python virtual environment..."
if [[ ! -d "${APP_DIR}/venv" ]]; then
  sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/venv"
fi
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install --upgrade pip
sudo -u "${APP_USER}" "${APP_DIR}/venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

echo "[4/8] Installing frontend dependencies and building assets..."
if [[ -f "${APP_DIR}/frontend/package-lock.json" ]]; then
  sudo -u "${APP_USER}" npm ci --prefix "${APP_DIR}/frontend"
else
  sudo -u "${APP_USER}" npm install --prefix "${APP_DIR}/frontend"
fi
sudo -u "${APP_USER}" env VITE_API_BASE_URL=/api npm run build --prefix "${APP_DIR}/frontend"

echo "[5/8] Creating environment file (if missing)..."
mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/garden-buddy.env.template" "${ENV_FILE}"
fi
chown root:"${APP_GROUP}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"

echo "[6/8] Rendering systemd service and nginx config..."
sed \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  -e "s|__APP_USER__|${APP_USER}|g" \
  -e "s|__APP_GROUP__|${APP_GROUP}|g" \
  -e "s|__ENV_FILE__|${ENV_FILE}|g" \
  "${SCRIPT_DIR}/garden-buddy.service.template" > "${SERVICE_FILE}"

sed \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
  "${SCRIPT_DIR}/garden-buddy.nginx.conf.template" > "${NGINX_AVAILABLE}"

ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

echo "[7/8] Starting/restarting services..."
nginx -t
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl enable --now nginx
systemctl restart nginx

echo "[8/8] Verifying backend health..."
if ! curl -fsS http://127.0.0.1:8000/health >/dev/null; then
  echo "Warning: backend healthcheck failed. Check logs with:"
  echo "  journalctl -u ${SERVICE_NAME} -n 200 --no-pager"
  exit 1
fi

if ! curl -fsS http://127.0.0.1/ >/dev/null; then
  echo "Warning: nginx frontend check failed. Check logs with:"
  echo "  journalctl -u nginx -n 200 --no-pager"
  exit 1
fi

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Garden Buddy deployment complete."
echo "App URL: http://${HOST_IP:-<server-ip>}"
echo "Server name configured for nginx: ${SERVER_NAME}"
echo "Service status: systemctl status ${SERVICE_NAME}"
