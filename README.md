# Campus Plus API (Transcendence)

Backend for **Campus Plus**: a Django REST + WebSocket API running behind Nginx (HTTPS), with PostgreSQL and Redis. Everything runs with Docker Compose, so nobody needs to install Python, Postgres or Redis locally.

## Tech stack

| Layer | Tech |
|---|---|
| Language / framework | Python 3.11, Django, Django REST Framework |
| API docs | drf-spectacular (OpenAPI + Swagger UI) |
| Real-time | Django Channels + `channels-redis` (WebSockets) |
| App server | Daphne (ASGI) |
| Database | PostgreSQL 16 |
| Cache / channel layer | Redis 7 |
| Reverse proxy | Nginx (alpine): HTTPS, static/media files, WebSocket proxy, rate limiting |
| Orchestration | Docker Compose |

## Architecture

```
Browser / Client
      │  :80 (redirects to 443)   :443 (HTTPS / WSS)
      ▼
┌───────────┐   /static/  /media/  → served directly from shared volumes
│   nginx   │
└─────┬─────┘
      │ proxy_pass web:8000  (HTTP + WebSocket upgrade on /ws/)
      ▼
┌───────────┐        ┌──────────┐
│    web    │───────▶│    db    │  PostgreSQL 16
│  (daphne) │        └──────────┘
│           │        ┌──────────┐
│           │───────▶│  redis   │  Channels layer (pub/sub)
└───────────┘        └──────────┘
```

- Only **nginx** is exposed to the host (ports `80` and `443`). `web`, `db` and `redis` are reachable only inside the Docker network.
- On container start, `entrypoint.sh` runs `migrate` and `collectstatic`, then starts Daphne.
- `web` waits for `db` to be healthy and for `redis` to start.

## Project structure

```
.
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env                      # local secrets (NOT committed)
├── .gitignore
├── README.md
└── infrastructure/
    ├── entrypoint.sh         # migrate + collectstatic, then exec CMD
    ├── app/                  # Django project (copied to /app in the image)
    │   ├── manage.py
    │   └── config/
    │       ├── settings.py
    │       ├── urls.py
    │       ├── views.py
    │       ├── asgi.py
    │       ├── routing.py    # WebSocket routes
    │       └── consumers.py  # WebSocket consumers
    └── nginx/
        ├── nginx.conf
        ├── gen-certs.sh      # generates a self-signed cert for local dev
        └── certs/            # cert.pem + key.pem (git-ignored)
```

> The `Dockerfile` copies `infrastructure/app` to `/app` and `infrastructure/entrypoint.sh` to `/entrypoint.sh`, and `docker-compose.yml` mounts `./infrastructure/nginx/...`. Keep the repo laid out exactly like this.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ with the Compose plugin (`docker compose version` must work)
- `openssl` (to generate the local HTTPS certificate). Already installed on Linux/macOS; on Windows use Git Bash or WSL.
- Free ports **80** and **443** on your machine

## Getting started

### 1. Clone the repo

```bash
git clone <repo-url>
cd <repo-folder>
```

### 2. Create the `.env` file

At the repo root, create a file named `.env`:

```env
POSTGRES_DB=campus_plus
POSTGRES_USER=campus_user
POSTGRES_PASSWORD=change_me
SECRET_KEY=change_me_to_a_long_random_string
DEBUG=true
```

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `SECRET_KEY` | Django secret key (use a long random string) |
| `DEBUG` | `true` for development, `false` for production |

`.env` is git-ignored. **Never commit it.** Each team member creates their own. Generate a strong secret key with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 3. Generate the local HTTPS certificate

Nginx expects `cert.pem` and `key.pem` in `infrastructure/nginx/certs/`.

```bash
cd infrastructure/nginx
sh gen-certs.sh
cd ../..
```

This creates a self-signed certificate for `localhost` / `127.0.0.1`, valid for 365 days. Your browser will show a security warning the first time: that's expected, accept it for local dev.

### 4. Build and start everything

```bash
docker compose up --build
```

Add `-d` to run in the background. The first build takes a few minutes. When you see Daphne listening on `0.0.0.0:8000`, the stack is ready.

### 5. Check that it works

| What | URL |
|---|---|
| Health check (REST) | https://localhost/api/health/ |
| Swagger UI (API docs) | https://localhost/api/docs/ |
| OpenAPI schema | https://localhost/api/schema/ |
| Django admin | https://localhost/admin/ |
| WebSocket health | `wss://localhost/ws/health/` |

Quick tests from the terminal (`-k` skips the self-signed cert check):

```bash
curl -k https://localhost/api/health/
# {"status":"ok","message":"API is running"}

curl -k https://localhost/api/check-ip/
# {"real_ip":"..."}   -> confirms Nginx forwards X-Real-IP
```

WebSocket test (needs [`websocat`](https://github.com/vi/websocat) or similar):

```bash
websocat -k wss://localhost/ws/health/
# {"status": "ok", "message": "WebSocket connected"}
```

Or in the browser console (after accepting the cert warning on https://localhost):

```js
const ws = new WebSocket("wss://localhost/ws/health/");
ws.onmessage = (e) => console.log(e.data);
```

### 6. Create an admin user (optional)

```bash
docker compose exec web python manage.py createsuperuser
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health/` | Health check (rate-limited to 60 req/min per IP by Nginx) |
| GET | `/api/check-ip/` | Returns the client IP seen via `X-Real-IP` |
| GET | `/api/schema/` | OpenAPI schema |
| GET | `/api/docs/` | Swagger UI |
| — | `/admin/` | Django admin |
| WS | `/ws/health/` | WebSocket health consumer |

## Daily commands

```bash
docker compose up -d                 # start in background
docker compose down                  # stop (data is kept)
docker compose logs -f web           # follow Django/Daphne logs
docker compose logs -f nginx         # follow Nginx logs
docker compose ps                    # container status
docker compose restart web           # restart only the backend

# Django management commands
docker compose exec web python manage.py migrate
docker compose exec web python manage.py makemigrations
docker compose exec web python manage.py shell

# Database shell
docker compose exec db psql -U campus_user -d campus_plus

# Full reset (DELETES the database, static and media volumes)
docker compose down -v
```

## Developing

- The code is **copied into the image at build time**, not mounted. After changing Python code, rebuild:
  ```bash
  docker compose up -d --build web
  ```
- After changing `nginx.conf`:
  ```bash
  docker compose restart nginx
  ```
- Add a new Python dependency: put it in `requirements.txt`, then rebuild `web`.
- Adding a new Django app: create it inside `infrastructure/app/`, add it to `INSTALLED_APPS` in `config/settings.py`, then rebuild.
- Adding a new WebSocket route: create the consumer in `config/consumers.py` and register it in `config/routing.py`. Nginx already proxies everything under `/ws/`.

## Persistent data (Docker volumes)

| Volume | Content |
|---|---|
| `postgres_data` | PostgreSQL data |
| `static_data` | Collected static files (shared `web` → `nginx`) |
| `media_data` | User uploads (shared `web` → `nginx`) |

## Troubleshooting

**Port 80/443 already in use**: stop the other service (Apache, another Nginx, IIS...) or change the host ports in `docker-compose.yml` (e.g. `"8080:80"`, `"8443:443"`).

**Nginx exits with `cannot load certificate`**: you skipped step 3, or the certs are not in `infrastructure/nginx/certs/`. Run `gen-certs.sh` from inside `infrastructure/nginx`.

**`CSRF verification failed` on the admin login**: the origin must be listed in `CSRF_TRUSTED_ORIGINS` in `settings.py`. Currently only `https://localhost` and `https://127.0.0.1` are trusted. Add your domain (e.g. `https://campusplus.ma`) when deploying.

**`DisallowedHost` / 400 error**: the hostname is not in `ALLOWED_HOSTS` (`localhost`, `127.0.0.1`, `campusplus.ma`).

**Database password changed in `.env` but login fails**: Postgres only reads `POSTGRES_PASSWORD` on first initialization. Either change it inside Postgres or reset the volume with `docker compose down -v` (this deletes data).

**WebSocket fails to connect**: use `wss://` (not `ws://`) since HTTP redirects to HTTPS, and make sure you accepted the certificate in the browser.

## Notes before going to production

- Set `DEBUG=false`.
- Use a strong, unique `SECRET_KEY` and database password. Don't reuse the dev values.
- Replace the self-signed certificate with a real one (e.g. Let's Encrypt) for `campusplus.ma`.
- Add the production origin to `CSRF_TRUSTED_ORIGINS`.
- Pin dependency versions in `requirements.txt` for reproducible builds.
- Don't expose Redis or Postgres ports publicly.
- Serve media files only for trusted content.# Campus Plus API (Transcendence)

Backend for **Campus Plus**: a Django REST + WebSocket API running behind Nginx (HTTPS), with PostgreSQL and Redis. Everything runs with Docker Compose, so nobody needs to install Python, Postgres or Redis locally.

## Tech stack

| Layer | Tech |
|---|---|
| Language / framework | Python 3.11, Django, Django REST Framework |
| API docs | drf-spectacular (OpenAPI + Swagger UI) |
| Real-time | Django Channels + `channels-redis` (WebSockets) |
| App server | Daphne (ASGI) |
| Database | PostgreSQL 16 |
| Cache / channel layer | Redis 7 |
| Reverse proxy | Nginx (alpine): HTTPS, static/media files, WebSocket proxy, rate limiting |
| Orchestration | Docker Compose |

## Architecture

```
Browser / Client
      │  :80 (redirects to 443)   :443 (HTTPS / WSS)
      ▼
┌───────────┐   /static/  /media/  → served directly from shared volumes
│   nginx   │
└─────┬─────┘
      │ proxy_pass web:8000  (HTTP + WebSocket upgrade on /ws/)
      ▼
┌───────────┐        ┌──────────┐
│    web    │───────▶│    db    │  PostgreSQL 16
│  (daphne) │        └──────────┘
│           │        ┌──────────┐
│           │───────▶│  redis   │  Channels layer (pub/sub)
└───────────┘        └──────────┘
```

- Only **nginx** is exposed to the host (ports `80` and `443`). `web`, `db` and `redis` are reachable only inside the Docker network.
- On container start, `entrypoint.sh` runs `migrate` and `collectstatic`, then starts Daphne.
- `web` waits for `db` to be healthy and for `redis` to start.

## Project structure

```
.
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env                      # local secrets (NOT committed)
├── .gitignore
├── README.md
└── infrastructure/
    ├── entrypoint.sh         # migrate + collectstatic, then exec CMD
    ├── app/                  # Django project (copied to /app in the image)
    │   ├── manage.py
    │   └── config/
    │       ├── settings.py
    │       ├── urls.py
    │       ├── views.py
    │       ├── asgi.py
    │       ├── routing.py    # WebSocket routes
    │       └── consumers.py  # WebSocket consumers
    └── nginx/
        ├── nginx.conf
        ├── gen-certs.sh      # generates a self-signed cert for local dev
        └── certs/            # cert.pem + key.pem (git-ignored)
```

> The `Dockerfile` copies `infrastructure/app` to `/app` and `infrastructure/entrypoint.sh` to `/entrypoint.sh`, and `docker-compose.yml` mounts `./infrastructure/nginx/...`. Keep the repo laid out exactly like this.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ with the Compose plugin (`docker compose version` must work)
- `openssl` (to generate the local HTTPS certificate). Already installed on Linux/macOS; on Windows use Git Bash or WSL.
- Free ports **80** and **443** on your machine

## Getting started

### 1. Clone the repo

```bash
git clone <repo-url>
cd <repo-folder>
```

### 2. Create the `.env` file

At the repo root, create a file named `.env`:

```env
POSTGRES_DB=campus_plus
POSTGRES_USER=campus_user
POSTGRES_PASSWORD=change_me
SECRET_KEY=change_me_to_a_long_random_string
DEBUG=true
```

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `SECRET_KEY` | Django secret key (use a long random string) |
| `DEBUG` | `true` for development, `false` for production |

`.env` is git-ignored. **Never commit it.** Each team member creates their own. Generate a strong secret key with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 3. Generate the local HTTPS certificate

Nginx expects `cert.pem` and `key.pem` in `infrastructure/nginx/certs/`.

```bash
cd infrastructure/nginx
sh gen-certs.sh
cd ../..
```

This creates a self-signed certificate for `localhost` / `127.0.0.1`, valid for 365 days. Your browser will show a security warning the first time: that's expected, accept it for local dev.

### 4. Build and start everything

```bash
docker compose up --build
```

Add `-d` to run in the background. The first build takes a few minutes. When you see Daphne listening on `0.0.0.0:8000`, the stack is ready.

### 5. Check that it works

| What | URL |
|---|---|
| Health check (REST) | https://localhost/api/health/ |
| Swagger UI (API docs) | https://localhost/api/docs/ |
| OpenAPI schema | https://localhost/api/schema/ |
| Django admin | https://localhost/admin/ |
| WebSocket health | `wss://localhost/ws/health/` |

Quick tests from the terminal (`-k` skips the self-signed cert check):

```bash
curl -k https://localhost/api/health/
# {"status":"ok","message":"API is running"}

curl -k https://localhost/api/check-ip/
# {"real_ip":"..."}   -> confirms Nginx forwards X-Real-IP
```

WebSocket test (needs [`websocat`](https://github.com/vi/websocat) or similar):

```bash
websocat -k wss://localhost/ws/health/
# {"status": "ok", "message": "WebSocket connected"}
```

Or in the browser console (after accepting the cert warning on https://localhost):

```js
const ws = new WebSocket("wss://localhost/ws/health/");
ws.onmessage = (e) => console.log(e.data);
```

### 6. Create an admin user (optional)

```bash
docker compose exec web python manage.py createsuperuser
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health/` | Health check (rate-limited to 60 req/min per IP by Nginx) |
| GET | `/api/check-ip/` | Returns the client IP seen via `X-Real-IP` |
| GET | `/api/schema/` | OpenAPI schema |
| GET | `/api/docs/` | Swagger UI |
| — | `/admin/` | Django admin |
| WS | `/ws/health/` | WebSocket health consumer |

## Daily commands

```bash
docker compose up -d                 # start in background
docker compose down                  # stop (data is kept)
docker compose logs -f web           # follow Django/Daphne logs
docker compose logs -f nginx         # follow Nginx logs
docker compose ps                    # container status
docker compose restart web           # restart only the backend

# Django management commands
docker compose exec web python manage.py migrate
docker compose exec web python manage.py makemigrations
docker compose exec web python manage.py shell

# Database shell
docker compose exec db psql -U campus_user -d campus_plus

# Full reset (DELETES the database, static and media volumes)
docker compose down -v
```

## Developing

- The code is **copied into the image at build time**, not mounted. After changing Python code, rebuild:
  ```bash
  docker compose up -d --build web
  ```
- After changing `nginx.conf`:
  ```bash
  docker compose restart nginx
  ```
- Add a new Python dependency: put it in `requirements.txt`, then rebuild `web`.
- Adding a new Django app: create it inside `infrastructure/app/`, add it to `INSTALLED_APPS` in `config/settings.py`, then rebuild.
- Adding a new WebSocket route: create the consumer in `config/consumers.py` and register it in `config/routing.py`. Nginx already proxies everything under `/ws/`.

## Persistent data (Docker volumes)

| Volume | Content |
|---|---|
| `postgres_data` | PostgreSQL data |
| `static_data` | Collected static files (shared `web` → `nginx`) |
| `media_data` | User uploads (shared `web` → `nginx`) |

## Troubleshooting

**Port 80/443 already in use**: stop the other service (Apache, another Nginx, IIS...) or change the host ports in `docker-compose.yml` (e.g. `"8080:80"`, `"8443:443"`).

**Nginx exits with `cannot load certificate`**: you skipped step 3, or the certs are not in `infrastructure/nginx/certs/`. Run `gen-certs.sh` from inside `infrastructure/nginx`.

**`CSRF verification failed` on the admin login**: the origin must be listed in `CSRF_TRUSTED_ORIGINS` in `settings.py`. Currently only `https://localhost` and `https://127.0.0.1` are trusted. Add your domain (e.g. `https://campusplus.ma`) when deploying.

**`DisallowedHost` / 400 error**: the hostname is not in `ALLOWED_HOSTS` (`localhost`, `127.0.0.1`, `campusplus.ma`).

**Database password changed in `.env` but login fails**: Postgres only reads `POSTGRES_PASSWORD` on first initialization. Either change it inside Postgres or reset the volume with `docker compose down -v` (this deletes data).

**WebSocket fails to connect**: use `wss://` (not `ws://`) since HTTP redirects to HTTPS, and make sure you accepted the certificate in the browser.

## Notes before going to production

- Set `DEBUG=false`.
- Use a strong, unique `SECRET_KEY` and database password. Don't reuse the dev values.
- Replace the self-signed certificate with a real one (e.g. Let's Encrypt) for `campusplus.ma`.
- Add the production origin to `CSRF_TRUSTED_ORIGINS`.
- Pin dependency versions in `requirements.txt` for reproducible builds.
- Don't expose Redis or Postgres ports publicly.
- Serve media files only for trusted content.