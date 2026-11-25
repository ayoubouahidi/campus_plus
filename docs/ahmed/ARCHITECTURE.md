<!-- # [ahmed] Added documentation; all content in this file belongs to Ahmed's changes. -->

# Campus Plus architecture — Ahmed

Audited 2026-11-05 on branch `Ahmed`. Code inspection establishes the flow
below; local tests verify middleware/consumer behavior with an in-memory
channel layer. The later Docker expiry probe verified the real Nginx/Daphne/WSS
and Redis broadcast path; browser login and real API CRUD remain unverified.

```text
Browser
  | HTTPS request / WSS handshake
  v
Nginx (Compose HTTPS port 8443)
  | /api/ -> HTTP application -> DRF TokenAuthentication -> views -> database
  | /ws/  -> Daphne / backend.asgi
  v
AllowedHostsOriginValidator
  v
get_websocket_auth_stack (WS_AUTH_BACKEND)
  | jwt: ws_access cookie -> signature/expiry/type -> database user lookup
  | token_dev: DRF query token (DEBUG only)
  v
CalendarConsumer: authenticated + active? otherwise close 4401
  | JWT: scope.jwt_exp -> managed expiry task -> jwt.expired -> close 4401
  v
calendar_updates group -> channel layer -> calendar_broadcast -> JSON clients
```

## Responsibilities and boundaries

- `backend/asgi.py`: initializes Django, routes HTTP/WebSocket protocols, and
  wraps WebSocket authentication in host-based origin validation.
- `realtime/authentication.py`: selects exactly one backend and rejects invalid
  settings. JWT failure never falls back to DRF authentication.
- `realtime/jwt_middleware.py`: extracts a unique cookie, validates an access
  credential with SimpleJWT, and resolves the Django user in a database worker.
  Client-controlled malformed identifiers become anonymous; database outages
  are not swallowed as bad credentials.
- `realtime/consumers.py`: checks user eligibility, joins the shared calendar
  group, sends the welcome message, forwards broadcasts, and removes membership
  on disconnect. Membership is authorization for the shared calendar only.
- `realtime/broadcast.py` and `core_data/views.py`: calendar changes produce
  broadcasts; views schedule them after successful database commit.
- `backend/settings.py`: Redis channel layer; SQLite locally, PostgreSQL when
  `POSTGRES_HOST` is set; API DRF token authentication remains unchanged.

Redis carries messages between processes. It does not store a durable history
for clients that disconnect. The database stores application records; clients
need API retrieval to recover state after reconnecting.

## JWT contract found in this checkout

SimpleJWT defaults: HS256 signature using Django's secret key, five-minute
access lifetime, `token_type=access`, and `user_id` resolving Django `User.id`.
No issuer/audience overrides or blacklist app are configured. Tests also check
issuer/audience rejection with an explicitly configured test token backend;
that fixture is not a production issuer integration.

`ws_access` is a proposed cookie interface already present in the experimental
middleware. No service currently issues it. Signup returns a DRF database
token. Frontend `SessionProvider` stores mock React state, with no NextAuth
dependency in `package.json`. OAuth identity exchange, JWT issuance, cookie
ownership, refresh, and logout remain team integration decisions.

## Infrastructure from configuration

Compose: Nginx -> `web:8000` / `frontend:3000`; Django -> `db:5432` and
`redis:6379`. PostgreSQL uses `postgres_data`; static/media have shared volumes.
The Dockerfile installs requirements and starts Daphne through the entrypoint.
Nginx forwards upgrade and proxy headers for `/ws/` and terminates TLS.
Only a trusted proxy should be able to supply trusted forwarded HTTPS headers.
<!-- # [ahmed] Distinguish configured JWT mode from the running image. -->
Compose sets `WS_AUTH_BACKEND: jwt` for `web`. After rebuilding/recreating on
2026-11-05, the running setting was confirmed as `jwt`, with PostgreSQL and
RedisChannelLayer. All 52 tests passed inside Docker. Separately, two signed
development access credentials connected through `wss://localhost:8443/ws/calendar/`
with the local certificate explicitly trusted and hostname verification enabled.
Both received a Redis group broadcast. The short-lived socket closed with 4401
at expiry, left the calendar group, and received no subsequent broadcast while
the control client did. Both memberships and the isolated user were cleaned up.
This verifies the real expiry transport path, not browser cookie issuance or
frontend integration. Source code did not change during this verification.

## Remaining security work (proposed)

Agree on backend-issued access credentials and a secure cookie issuance endpoint.
Define exact origin/scheme/port policy, credential lifetimes, refresh/logout,
and when open sockets must close after revocation. JWT identity checks run at
the handshake; CalendarConsumer now schedules disconnection at the validated
`exp` timestamp, leaves the group before closing, and checks expiry before
forwarding a broadcast. Its timer sends `jwt.expired` to the consumer's own
channel so lifecycle handlers run in sequence. Disconnect cancels and awaits
the timer. Development-token connections have no expiry task. Logout,
revocation, and account disablement do not yet close existing sockets early.
Add private user groups with ownership checks
before implementing private notifications. Review rate limits and reconnect
behavior. Real Redis-to-WSS expiry and probe broadcasting have been verified;
API mutation broadcasts, browser login, and frontend behavior need their own
end-to-end checks.
