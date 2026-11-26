# Campus Hub — Infrastructure & DevOps

Containerized production infrastructure for **Campus Hub**, orchestrated with **Docker Compose**, fronted by an **Nginx HTTPS reverse proxy**, and monitored with **Prometheus + Grafana**.

---

## Architecture

```text
                         ┌──────────────────────────────┐
                         │        Client / Browser      │
                         └──────────────┬───────────────┘
                                        │ :80 (301 -> HTTPS)
                                        │ :443 (TLSv1.2 / TLSv1.3)
                                        ▼
                         ┌──────────────────────────────┐
                         │        nginx (alpine)        │
                         │   Reverse Proxy + Rate Limit │
                         └──┬───────────┬───────────┬───┘
                            │           │           │
           /api/auth/* ─────┤           │           ├───── /grafana/
           /           ─────┘           │           └────► grafana:3000
                            │           │                  (Grafana 11.3.0)
                            ▼           │                        │
                 ┌──────────────────┐   │                        ▼
                 │ frontend (Next)  │   │             ┌────────────────────┐
                 │      :3000       │   │             │ prometheus:9090    │
                 └────────┬─────────┘   │             │ (v2.55.1 + alerts) │
                          │             │             └─────────┬──────────┘
         BACKEND_URL      │             │ /api/*                │ scrapes
      http://backend:8000 │             │ /admin/               ├──► node-exporter:9100
                          ▼             │ /ws/ (WSS)            └──► cadvisor:8080
                 ┌──────────────────────▼───┐
                 │  backend (Django+Daphne) │
                 │          :8000           │
                 └───────┬──────────┬───────┘
                         │          │
                         ▼          ▼
               ┌──────────────┐  ┌────────────┐
               │ postgres:16  │  │ redis:7    │
               │ (db:5432)    │  │ (redis:6379│
               └──────────────┘  └────────────┘
```

- **Network isolation:** Only **Nginx** exposes host ports (`80` and `443`). `backend`, `frontend`, `db`, `redis`, `prometheus`, `grafana`, `node-exporter`, and `cadvisor` communicate strictly over the internal Docker Compose network.
- **Persistent volumes:** `postgres_data`, `static_data`, `media_data`, `prometheus_data`, and `grafana_data`.

---

## Quick Start

1. **Create your local `.env` from `.env.example`:**

```bash
cp .env.example .env
```

2. **Generate strong secrets and update `.env`:**

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Fill in `DJANGO_SECRET_KEY`, `BACKEND_INTERNAL_KEY`, `AUTH_SECRET`, `POSTGRES_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, plus your 42 OAuth / email credentials as needed.

3. **Start the stack:**

```bash
make up
```

`make up` generates self-signed SSL certificates in `infrastructure/nginx/certs/` (if missing) and builds/starts all services via `docker compose up -d --build`.

4. **Access the endpoints:**
   - **App:** `https://localhost`
   - **API:** `https://localhost/api/`
   - **Grafana:** `https://localhost/grafana/`

---

## Services & Images

| Service | Image / Build | Internal Port | Role |
|---|---|---|---|
| `nginx` | `nginx:alpine` | `80`, `443` (host-exposed) | TLS termination, routing, rate limiting, static & media serving |
| `backend` | `./Dockerfile` (`python:3.14-slim`) | `8000` | Django + DRF + Channels ASGI server (`daphne`) |
| `frontend` | `./frontend` | `3000` | Next.js student application & Auth.js |
| `db` | `postgres:16` | `5432` | Primary relational database (with `pg_isready` healthcheck) |
| `redis` | `redis:7-alpine` | `6379` | Channel layer for WebSockets (with `redis-cli ping` healthcheck) |
| `prometheus` | `prom/prometheus:v2.55.1` | `9090` | Metrics scraper & alerting rules evaluator |
| `grafana` | `grafana/grafana:11.3.0` | `3000` | Dashboards & visualization served at `/grafana/` |
| `node-exporter` | `prom/node-exporter:v1.8.2` | `9100` | Host CPU, memory, disk, and network metrics |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | `8080` | Per-container CPU and memory metrics |

---

## Directory Structure

```text
.
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
└── infrastructure/
    ├── entrypoint.sh
    ├── nginx/
    │   ├── nginx.conf
    │   ├── gen-certs.sh
    │   └── certs/                         # cert.pem + key.pem (git-ignored)
    └── monitoring/
        ├── prometheus/
        │   ├── prometheus.yml
        │   └── alerts.yml
        └── grafana/
            ├── dashboards/
            │   └── campus-hub.json
            └── provisioning/
                ├── dashboards/
                │   └── dashboard.yml
                └── datasources/
                    └── datasource.yml
```

---

## Reverse Proxy, HTTPS & Security (`infrastructure/nginx/`)

- **HTTP to HTTPS redirect:** All traffic on port `80` returns `301 https://$host$request_uri`.
- **TLS:** Port `443` terminates SSL using `TLSv1.2` and `TLSv1.3` with certificates in `infrastructure/nginx/certs/`.
- **Self-signed cert generation:** `infrastructure/nginx/gen-certs.sh` generates a 2048-bit RSA certificate (`365` days) with SANs `DNS:localhost`, `DNS:campushub.ma`, and `IP:127.0.0.1`.
- **Routing rules (`infrastructure/nginx/nginx.conf`):**
  - `/static/` -> served directly by Nginx from `/app/staticfiles/` (`static_data` volume)
  - `/media/` -> served directly by Nginx from `/app/media/` (`media_data` volume)
  - `/grafana/` -> proxied to `http://grafana:3000` (with WebSocket upgrade support)
  - `/api/auth/callback/` -> proxied to `frontend` with brute-force rate limiting
  - `/api/auth/` -> proxied to `frontend` (Auth.js routes)
  - `/api/` -> proxied to `django_backend` with API rate limiting
  - `/admin/` -> proxied to `django_backend`
  - `/ws/` -> proxied to `django_backend` (`Upgrade` + `$connection_upgrade`, `3600s` read/send timeouts)
  - `/` -> proxied to `frontend`
- **WebSocket connection handling:** Uses `map $http_upgrade $connection_upgrade` so regular HTTP requests close cleanly (`'' -> close`) while WebSocket requests upgrade (`default -> upgrade`).
- **Rate limiting (`429` on limit exceeded):**
  - `auth_callback_limit`: `5r/m`, `burst=5 nodelay` on `/api/auth/callback/`
  - `api_limit`: `10r/s`, `burst=10 nodelay` on `/api/`
- **Upload limit:** `client_max_body_size 10m`.

---

## Backend Container & Entrypoint

- **Base image:** `python:3.14-slim` (`Dockerfile`)
- **Startup script (`infrastructure/entrypoint.sh`):**
  1. Runs `python manage.py migrate --noinput`
  2. Runs `python manage.py collectstatic --noinput`
  3. Starts `daphne -b 0.0.0.0 -p 8000 backend.asgi:application`
- **Startup ordering:** `backend` waits on `db` (`service_healthy`) and `redis` (`service_healthy`) before booting.

---

## Monitoring & Alerting (`infrastructure/monitoring/`)

### Prometheus (`prometheus.yml` & `alerts.yml`)
- **Scrape interval:** `15s` (evaluation interval: `15s`)
- **Targets:** `localhost:9090` (`prometheus`), `node-exporter:9100` (`node_exporter`), `cadvisor:8080` (`cadvisor`)
- **Alert rules (`alerts.yml`):**
  - `InstanceDown` (`critical`): `up == 0` for `1m`
  - `HighCPUUsage` (`warning`): Host CPU usage `> 80%` for `2m`
  - `HighMemoryUsage` (`warning`): Host memory usage `> 85%` for `2m`

### Grafana (`grafana/`)
- Served behind Nginx at **`https://localhost/grafana/`** (`GF_SERVER_SERVE_FROM_SUB_PATH=true`, sign-ups and anonymous access disabled).
- **Auto-provisioned datasource (`datasource.yml`):** `Prometheus` (`http://prometheus:9090`, default, non-editable).
- **Auto-provisioned dashboard (`dashboards/campus-hub.json`):** *Campus Hub Infrastructure* (`15s` auto-refresh), containing 6 panels:
  1. **Targets Status** (`up`)
  2. **Host CPU Usage (%)** (`node_cpu_seconds_total`)
  3. **Host Memory Usage (%)** (`node_memory_MemAvailable_bytes` / `node_memory_MemTotal_bytes`)
  4. **Root Disk Usage (%)** (`node_filesystem_avail_bytes` / `node_filesystem_size_bytes`)
  5. **Container CPU Usage (cores/s)** (`container_cpu_usage_seconds_total`)
  6. **Container Memory Usage** (`container_memory_working_set_bytes`)

---

## Environment Configuration (`.env.example`)

- **Django & HTTPS:** `DJANGO_SECRET_KEY`, `DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `DJANGO_HTTPS_ENABLED`, `DJANGO_PUBLIC_MEDIA_BASE_URL`
- **Database & Cache:** `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `REDIS_URL`, `WS_AUTH_BACKEND`
- **Frontend & Auth:** `BACKEND_INTERNAL_KEY`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET`, `AUTH_DEV_LOGIN`, `BACKEND_URL`
- **Email (verification):** `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`
- **Grafana:** `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`

---

## Operations (`Makefile`)

| Command | Action |
|---|---|
| `make certs` | Generate self-signed SSL certificates in `infrastructure/nginx/certs/` if missing |
| `make up` / `make` | Generate certs and start the full stack in production mode (`docker compose up -d --build`) |
| `make dev` | Start with `docker-compose.dev.yml` for frontend live reload (`--renew-anon-volumes`) |
| `make down` | Stop and remove containers |
| `make lint` | Run ESLint inside a throwaway frontend dev container |
| `make typecheck` | Run `tsc --noEmit` inside a throwaway frontend dev container |
| `make build-check` | Build the production `frontend` image without starting the stack |
| `make clear-images` | Clear Next.js resized-image cache inside `frontend` |
| `make logs` | Stream logs from all services |
| `make clean` | Stop containers and remove volumes and orphans (`-v --remove-orphans`) |
| `make fclean` | `clean` + remove built/pulled images and prune Docker build cache |
| `make re` | Full reset and rebuild (`fclean` followed by `up`) |

---

## CI Pipeline (`.github/workflows/ci.yml`)

Triggered on `push` and `pull_request` to `Developer`:
1. **`backend_tests`:** Sets up Python `3.14`, installs `requirements.txt`, and runs `python manage.py test`.
2. **`frontend_build`:** Runs `docker build ./frontend` to verify the multi-stage production image compiles cleanly.