# 🏓 42 Transcendence — Infrastructure & Orchestration

> **Role & Scope:** DevOps & Infrastructure Lead (Member 5)
>
> **Status:** Production-Ready Base (SSL/TLS Termination, ASGI Daphne, WebSockets, Redis Pub/Sub, Postgres Healthchecks, Rate Limiting)

## 🏛️ System Architecture

The project is orchestrated using a multi-container Docker architecture connected via an isolated bridge network. All incoming client traffic enters through a hardened **NGINX** gateway that terminates TLS and proxies traffic internally.

```
                      Internet / Browser Client
                                  │
                                  │  Port 80 (HTTP -> 301 Redirect)
                                  │  Port 443 (HTTPS / WSS)
                                  ▼
                    ┌──────────────────────────┐
                    │       NGINX 1.25+        │
                    │  (Reverse Proxy + TLS)   │
                    └─────────────┬────────────┘
         ┌────────────────────────┼────────────────────────┐
         │ /static/               │ /                      │ /ws/
         │ /media/                │ /api/v1/public/ (Rate) │ (Upgrade: websocket)
         ▼                        ▼                        ▼
  ┌──────────────┐         ┌──────────────────────────────────────┐
  │ Shared       │         │             Daphne ASGI              │
  │ Docker       │         │        (Django + Channels)           │
  │ Volumes      │         │             Port 8000                │
  └──────────────┘         └──────────────┬───────────────────────┘
                                          │
                         ┌────────────────┴───────────────┐
                         ▼                                ▼
                ┌──────────────────┐             ┌──────────────────┐
                │   PostgreSQL 16  │             │     Redis 7      │
                │    (Database)    │             │  (Channel Layer) │
                │    Port 5432     │             │    Port 6379     │
                └──────────────────┘             └──────────────────┘

```

### Component Details

1. **NGINX (`nginx:alpine`)**:

   * Listens on `80` (redirects all traffic to HTTPS `443` via HTTP 301).

   * Terminates SSL using TLSv1.2 & TLSv1.3 (`cert.pem`, `key.pem`).

   * Serves `/static/` and `/media/` directly from persistent volumes.

   * Enforces a rate-limiting policy on `/api/v1/public/` capped at **60 requests/minute** with a burst limit of 10.

   * Proxies WebSocket handshakes via `/ws/` using HTTP 1.1 upgrade headers.

2. **Daphne Web Container (`python:3.11-slim`)**:

   * Replaces Django's development `runserver` with the production ASGI server Daphne (`config.asgi:application`).

   * Integrates Django Channels with `ProtocolTypeRouter` for HTTP and WebSocket demultiplexing.

   * Waits for PostgreSQL to become strictly `healthy` before booting up.

3. **Redis 7 (`redis:7-alpine`)**:

   * Serves as the high-speed Channel Layer (`channels_redis`) for inter-process real-time broadcast and chat message distribution.

4. **PostgreSQL 16 (`postgres:16`)**:

   * Persistent relational database equipped with native Docker healthcheck (`pg_isready`).

## 📁 Repository Infrastructure Layout

```
.
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env.example
├── README.md
└── infrastructure/
    ├── app/
    │   ├── manage.py
    │   └── config/
    │       ├── asgi.py
    │       ├── routing.py
    │       ├── consumers.py
    │       ├── settings.py
    │       ├── urls.py
    │       └── views.py
    └── nginx/
        ├── nginx.conf
        └── certs/
            ├── cert.pem
            └── key.pem

```

## ⚙️ Environment Configuration

Create a `.env` file in the root directory prior to starting the containers:

```
# PostgreSQL Settings
POSTGRES_DB=campus_plus
POSTGRES_USER=campus_user
POSTGRES_PASSWORD=secure_dev_password

# Django Settings
DEBUG=True
SECRET_KEY=dev-secret-key-change-me

```

## 🔑 SSL Certificate Generation (Local Development)

If the SSL certificates inside `infrastructure/nginx/certs/` need regeneration:

```
mkdir -p infrastructure/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/nginx/certs/key.pem \
  -out infrastructure/nginx/certs/cert.pem \
  -subj "/CN=localhost"

```

## 🚀 Quickstart & Lifecycle Commands

### 1. Build and Run Services

```
docker compose up -d --build

```

### 2. Verify Container Health

```
docker compose ps

```

All containers (`db`, `redis`, `web`, `nginx`) should report a status of `Up` (with `db` displaying `(healthy)`).

### 3. Run Database Migrations

```
docker compose exec web python manage.py migrate

```

### 4. Create an Admin Account

```
docker compose exec web python manage.py createsuperuser

```

### 5. Collect Static Files

```
docker compose exec web python manage.py collectstatic --no-input

```

### 6. View Logs

```
# Daphne ASGI logs
docker compose logs -f web

# NGINX access & error logs
docker compose logs -f nginx

```

### 7. Tear Down

```
docker compose down
# Or to wipe database volumes as well:
# docker compose down -v

```

## 🧪 Verification & Acceptance Tests

### 1. HTTP to HTTPS Auto-Redirect (Port 80 -> 443)

```
curl -I http://localhost/api/health/

```

**Expected Output:**

```
HTTP/1.1 301 Moved Permanently
Location: https://localhost/api/health/

```

### 2. HTTPS REST Health Endpoint

```
curl -k https://localhost/api/health/

```

**Expected Output:**

```
{"status":"ok","message":"API is running"}

```

### 3. Interactive OpenAPI / Swagger Documentation

Navigate to `https://localhost/api/docs/` in your browser (bypass self-signed certificate warnings) to view the auto-generated Swagger UI.

### 4. WebSocket Real-Time Handshake

Open your browser console on any `https://localhost` tab (`F12` -> Console) and run:

```
const ws = new WebSocket("wss://localhost/ws/health/");
ws.onopen = () => console.log("✅ WebSocket Connected!");
ws.onmessage = (e) => console.log("📩 Message received:", JSON.parse(e.data));
ws.onerror = (err) => console.error("❌ WebSocket Error:", err);

```

**Expected Output:**

```
✅ WebSocket Connected!
📩 Message received: {status: 'ok', message: 'WebSocket connected'}

```

### 5. Redis Channel Layer Pub/Sub

```
docker compose exec web python manage.py shell -c "
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

layer = get_channel_layer()
async_to_sync(layer.send)('test_channel', {'type': 'test.message', 'text': 'Ping Redis'})
msg = async_to_sync(layer.receive)('test_channel')
print('Redis Pub/Sub Status:', msg)
"

```

**Expected Output:**

```
Redis Pub/Sub Status: {'type': 'test.message', 'text': 'Ping Redis'}

```

### 6. Public API Rate Limiting (60r/m enforcement)

```
for i in {1..15}; do curl -k -s -o /dev/null -w "%{http_code}\n" https://localhost/api/v1/public/test/; done

```

**Expected Output:**
The initial 11 requests pass within the burst tolerance (HTTP 404/200), followed immediately by **HTTP 503** status codes triggered by NGINX's `limit_req` engine.