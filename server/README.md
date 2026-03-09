# Garden Buddy Server Deploy

One command deploy on Debian/Ubuntu Linux:

```bash
sudo SERVER_NAME=your-domain.example.com APP_USER=$USER bash server/install.sh
```

If you want nginx to listen on any host/IP without a domain, omit `SERVER_NAME`:

```bash
sudo APP_USER=$USER bash server/install.sh
```

## What the installer does

- Installs system packages: `python3`, `python3-venv`, `python3-pip`, `nodejs`, `npm`, `nginx`
- Creates and populates `venv` in the repo root
- Installs backend dependencies from `requirements.txt`
- Installs frontend dependencies and builds with `VITE_API_BASE_URL=/api`
- Renders and installs systemd service from `garden-buddy.service.template`
- Renders and installs nginx config from `garden-buddy.nginx.conf.template`
- Creates `/etc/garden-buddy/garden-buddy.env` from template (if missing)
- Enables and starts both `garden-buddy` and `nginx`

## Files

- `install.sh`: single-command installer
- `garden-buddy.service.template`: systemd unit template
- `garden-buddy.nginx.conf.template`: nginx site template
- `garden-buddy.env.template`: backend environment template

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
