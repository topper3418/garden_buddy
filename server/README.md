# Garden Buddy Server Deploy

One command deploy on Debian/Ubuntu Linux:

```bash
sudo SERVER_NAME=your-domain.example.com APP_USER=$USER bash server/install.sh
```

Optional overrides:

- `APP_ROUTE=/garden/` to serve from a path prefix
- `STATIC_DIR=/var/www/garden-buddy` to control where built frontend files are published for nginx

The installer prompts for a route prefix.

- Leave it blank to serve at `/` on port 80.
- Enter something like `/garden/` to serve under a path prefix.

You can also skip the prompt by passing `APP_ROUTE`:

```bash
sudo SERVER_NAME=your-domain.example.com APP_USER=$USER APP_ROUTE=/garden/ bash server/install.sh
```

If you want nginx to listen on any host/IP without a domain, omit `SERVER_NAME`:

```bash
sudo APP_USER=$USER bash server/install.sh
```

## What the installer does

- Installs system packages: `python3`, `python3-venv`, `python3-pip`, `nodejs`, `npm`, `nginx`
- Creates and populates `venv` in the repo root
- Installs backend dependencies from `requirements.txt`
- Installs frontend dependencies and builds with route-aware `VITE_API_BASE_URL` and Vite `--base`
- Publishes frontend build output to `/var/www/garden-buddy` by default (override with `STATIC_DIR`)
- Renders and installs systemd service from `garden-buddy.service.template`
- Renders and installs nginx config from `garden-buddy.nginx.conf.template`
- Creates `/etc/garden-buddy/garden-buddy.env` from template (if missing)
- Enables and starts both `garden-buddy` and `nginx`
- Does **not** run the seed script automatically (fresh/unseeded start)

## Files

- `install.sh`: single-command installer
- `update.sh`: pull/rebuild/restart updater for existing installs
- `uninstall.sh`: cleanup script for full/partial installs
- `garden-buddy.service.template`: systemd unit template
- `garden-buddy.nginx.conf.template`: nginx site template
- `garden-buddy.env.template`: backend environment template

## Update Existing Install

Run from the repo root:

```bash
sudo bash server/update.sh
```

What it does:

- Pulls latest git changes with `git pull --ff-only`
- Refreshes backend Python dependencies in `venv`
- Installs frontend dependencies and rebuilds assets
- Publishes built frontend files to nginx static directory
- Restarts `garden-buddy` and `nginx`
- Runs backend and frontend health checks

Useful overrides:

- `SKIP_GIT_PULL=true` to skip git pull (useful for local testing)
- `APP_ROUTE=/garden/` to override detected route prefix
- `APP_USER=ubuntu` if git/dependency commands must run as a specific user
- `STATIC_DIR=/var/www/garden-buddy` for custom static publish target
- `SERVICE_NAME=garden-buddy` for custom systemd/nginx naming
- `HEALTH_RETRIES=40` and `HEALTH_DELAY_SECONDS=1` to tune post-restart health wait window

## Notes

- Installer currently targets Debian/Ubuntu (`apt-get`).
- If backend startup fails, check:

```bash
journalctl -u garden-buddy -n 200 --no-pager
```

- If nginx fails, check:

```bash
journalctl -u nginx -n 200 --no-pager
```

## Uninstall / Cleanup

One command cleanup (handles failed/partial installs too):

```bash
sudo bash server/uninstall.sh
```

Optional flags:

- `REMOVE_ENV_FILE=false` keeps `/etc/garden-buddy/garden-buddy.env`
- `REMOVE_BUILD_ARTIFACTS=false` keeps `venv`, `frontend/node_modules`, `frontend/dist`
- `STATIC_DIR=/var/www/garden-buddy` targets a custom published static directory for cleanup
