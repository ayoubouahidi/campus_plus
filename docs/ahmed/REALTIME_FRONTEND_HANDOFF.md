# Campus Plus realtime calendar handoff

Status: implemented backend contract, reviewed 2026-11-23.
Owner of this document: Ahmed (backend realtime).
Frontend implementation owner: Mouad.

This document describes behavior that exists now. Proposed frontend behavior is
explicitly labelled. It does not claim browser cookie handoff, the real Mouad
frontend, Nginx, or production deployment is complete.

## Endpoints

| Purpose | Endpoint | Current authentication |
|---|---|---|
| Calendar snapshot | `GET /api/club-events/` | Public |
| Event detail | `GET /api/club-events/{id}/` | Public |
| Obtain short-lived socket JWT | `POST /api/realtime/token/` | DRF `Authorization: Token …` |
| Calendar updates | `wss://<backend-host>/ws/calendar/` | `ws_access` cookie in JWT mode |

The event list is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

Default page size is 20 and `page_size` may be 1–200. A complete snapshot must
follow `next` until it is null; reading only the first page is not a full
calendar snapshot.

## Authentication and connection contract

### JWT issuance

`POST /api/realtime/token/` returns:

```json
{
  "access": "<signed access token>",
  "expires_in": 300
}
```

The response uses `Cache-Control: no-store`. Django returns the token but does
not set the browser cookie. The trusted frontend server is expected to set a
cookie named `ws_access` whose path includes `/ws/`, with `HttpOnly`, `Secure`,
an approved `SameSite` policy, and an expiry no later than the token. Do not put
the token in a WebSocket query string, browser log, or local storage.

Cookie issuance, DRF token acquisition, refresh and logout integration still
depend on Ayoub's authentication contract. The frontend must not treat an
Auth.js session token as if it were automatically a backend SimpleJWT token.

### Origin behavior

The ASGI WebSocket route is wrapped in `AllowedHostsOriginValidator`. Browser
requests need one Origin whose host is accepted by Django `ALLOWED_HOSTS`.
Missing and untrusted origins are rejected. This is currently host-based
validation; it is not a separately configured exact scheme-and-port allowlist.
Hamza and Mouad must agree the production hostname, TLS certificate and proxy
route before deployment.

Origin validation and authentication answer different questions:

- Origin validation asks which website opened the browser connection.
- JWT validation asks which user the credential represents.

Passing one check does not pass the other.

### Cookie and JWT validation

In `WS_AUTH_BACKEND=jwt` mode, the backend requires:

- exactly one HTTP `Cookie` header;
- exactly one nonempty `ws_access` value in that header;
- compact signed JWT syntax;
- a valid SimpleJWT signature and expiry;
- token type `access` (refresh tokens are rejected);
- an integer expiry claim;
- an existing active configured Django user.

Malformed, duplicate, expired, refresh, missing-user and inactive-user
credentials do not authenticate. Query-string tokens do not authenticate in
JWT mode. `token_dev` is a DEBUG-only legacy development mode and is rejected
when `DEBUG=False`.

### Successful connection

There is no separate subscribe request. A successful handshake automatically
joins the shared calendar group and the first JSON message is:

```json
{
  "type": "connection_established",
  "message": "Subscribed to calendar updates"
}
```

Only after receiving this acknowledgment should the frontend consider the live
subscription active.

### Rejection and closure

| Situation | Implemented behavior |
|---|---|
| Origin rejected before WebSocket upgrade | HTTP 403 handshake rejection |
| Missing/invalid/inactive authentication | Consumer rejection; ASGI test close code 4401, commonly surfaced as HTTP 403 before live upgrade |
| JWT expires after connection | Leave group, close WebSocket with code 4401 |
| Normal browser/client disconnect | Group membership removed; no application-level farewell message |
| Logout/revocation before JWT expiry | No active revocation today; socket remains valid until its JWT deadline |

Clients should treat 4401 as “obtain a fresh credential before reconnecting.”
For network failures and ordinary abnormal closure, retry with bounded
exponential backoff and jitter. Avoid an immediate infinite reconnect loop.

## Broadcast envelope

Every client-visible calendar message has this outer structure:

```json
{
  "type": "event_created | event_updated | event_deleted",
  "data": {}
}
```

The internal Channels event named `calendar.broadcast` is not part of the
frontend protocol.

### `event_created`

Produced after an authorized event creation is saved and its database
transaction commits.

```json
{
  "type": "event_created",
  "data": {
    "id": 42,
    "title": "AI Hackathon",
    "name": "AI Hackathon",
    "description": "Build an edge AI project.",
    "parent_id": 1,
    "club": 2,
    "club_id": 2,
    "club_name": "LEET Dev",
    "club_slug": "leet-dev",
    "parent": "1337 Coding School",
    "department_name": "1337 Coding School",
    "department_slug": "1337",
    "flyer_url": "https://example.test/media/events_pics/example.webp",
    "starts_at": "2026-12-01T09:00:00Z",
    "ends_at": "2026-12-01T17:00:00Z",
    "start_time": "2026-12-01T09:00:00Z",
    "end_time": "2026-12-01T17:00:00Z",
    "location": "Agora Hall",
    "category": "Tech",
    "status": "planned",
    "capacity": 150,
    "rsvps_count": 0,
    "has_user_rsvpd": false,
    "attendees_preview": [],
    "created_at": "2026-11-21T10:00:00Z",
    "updated_at": "2026-11-21T10:00:00Z"
  }
}
```

Recommended frontend action: normalize the item and insert or upsert it by
numeric `id`. Upsert is safer than blindly appending if a snapshot already
contains the same event.

### `event_updated`

Produced after an authorized update is saved and its transaction commits. It
contains the complete current event serializer shape, not only changed fields.

```json
{
  "type": "event_updated",
  "data": {
    "id": 42,
    "title": "AI Hackathon — Main Hall",
    "name": "AI Hackathon — Main Hall",
    "description": "Build an edge AI project.",
    "parent_id": 1,
    "club": 2,
    "club_id": 2,
    "club_name": "LEET Dev",
    "club_slug": "leet-dev",
    "parent": "1337 Coding School",
    "department_name": "1337 Coding School",
    "department_slug": "1337",
    "flyer_url": "",
    "starts_at": "2026-12-01T09:00:00Z",
    "ends_at": "2026-12-01T17:00:00Z",
    "start_time": "2026-12-01T09:00:00Z",
    "end_time": "2026-12-01T17:00:00Z",
    "location": "Main Hall",
    "category": "Tech",
    "status": "planned",
    "capacity": null,
    "rsvps_count": 87,
    "has_user_rsvpd": false,
    "attendees_preview": [],
    "created_at": "2026-11-21T10:00:00Z",
    "updated_at": "2026-11-21T11:00:00Z"
  }
}
```

Recommended frontend action: replace/upsert the local event with the same ID.
Do not merge only the visually changed field; the server message is the current
serialized representation.

### `event_deleted`

Produced after an authorized deletion commits.

```json
{
  "type": "event_deleted",
  "data": {
    "id": 42
  }
}
```

Recommended frontend action: remove that numeric ID from local state. Keep a
temporary deletion tombstone while reconciling an in-flight snapshot so a
stale response cannot reinsert the deleted item.

## Event field mapping

Creation and update broadcasts use exactly the same serializer as the REST
event item.

| Backend field | Frontend use | Notes |
|---|---|---|
| `id` | Stable event key | Integer; required |
| `name` | Legacy/write API name | Canonical writable request field today |
| `title` | Frontend display alias | Read-only alias of `name`; same value |
| `starts_at` | Legacy datetime | ISO 8601 or null on historical records |
| `start_time` | Frontend datetime alias | Read-only alias of `starts_at` |
| `ends_at` | Legacy datetime | ISO 8601 or null on historical records |
| `end_time` | Frontend datetime alias | Read-only alias of `ends_at` |
| `parent_id` | Department numeric ID | Required relationship |
| `parent` | Department display name | Legacy alias |
| `department_name` | Department display name | Same conceptual value as `parent` |
| `department_slug` | Department route/filter key | May be null until A0 backfill |
| `club` | Club numeric ID | Writable relationship; may be null |
| `club_id` | Club numeric ID alias | Read-only; may be null |
| `club_name`, `club_slug` | Club display/routing | Null only for department-only events; persisted Clubs have a non-null slug after `core_data.0012` |
| `description`, `location` | Display text | May be empty string |
| `flyer_url` | Image URL | Empty string when no flyer |
| `category` | Seven-value category | Historical rows may be null; new events require it |
| `status` | `planned`, `ongoing`, `completed`, `cancelled` | Always use backend value |
| `capacity` | Participant limit | Nonnegative integer; null means unlimited |
| `created_at`, `updated_at` | Reconciliation metadata | ISO 8601; legacy values may be null |

The backend currently exposes both legacy names and frontend aliases. Mouad
should choose one normalized frontend shape and map once at the API boundary.
For event writes, use the documented writable backend fields (`name`,
`starts_at`, `ends_at`, `parent_id`, and optionally `club`); `title`,
`start_time`, and `end_time` are read-only response aliases.

`rsvps_count` is a public aggregate and is present. `has_user_rsvpd` is always
sanitized to `false`, and `attendees_preview` is always sanitized to `[]`,
because a shared calendar message cannot carry caller-specific state or
attendee identities. President contacts, credentials, recipient IDs, delivery
IDs, and server sequence numbers are never present.

## Personal notification messages

Personal messages use a separate per-user group at `/ws/notifications/`.
`notification.created` contains `id`, `notification_type`, English fallback
`title` and `message`, nullable `event_title`, read state, creation time, and
nullable `event_id`. It never contains another recipient's identity or club
president contacts.

For English, French and Arabic UI text, render from `notification_type` and
`event_title`. Fall back to `title` and `message` when the snapshot is null.
Fetch `/api/notifications/` after reload/reconnect: PostgreSQL is durable
history while Redis only delivers live messages.

## Reconnection and snapshot reconciliation

Redis/Channels delivery is transient. A disconnected browser is not sent the
messages it missed. The socket has no replay cursor and the server stores no
WebSocket history. The database/REST API is the source of truth.

Recommended client workflow:

1. Obtain a valid access credential through the approved server-side flow.
2. Open `/ws/calendar/` and wait for `connection_established`.
3. Start buffering every calendar broadcast in arrival order.
4. Fetch every page of `GET /api/club-events/`.
5. Replace the local snapshot with the REST result.
6. Replay the buffered broadcasts in arrival order: upsert creates/updates and
   apply deletion tombstones.
7. Switch from buffering to applying future messages directly.
8. On disconnect, mark live state stale and reconnect with bounded backoff.
9. For close 4401, obtain a fresh access token before reconnecting.
10. After every reconnect, repeat the full snapshot-and-replay process.

### The snapshot/broadcast race

An event can change after the socket subscribes but while REST pages are being
fetched. If the frontend simply writes the REST response after already applying
live messages, a slower snapshot can overwrite a newer update or resurrect a
deletion. Buffering during the fetch and replaying afterward preserves the
observed broadcast order. `updated_at` can prevent replacing a newer local item
with an older one, but deletion has no timestamp, so tombstones and ordered
replay still matter.

There is no absolute gap-free guarantee: a Redis outage, process crash or
network loss may drop a broadcast. A final REST refetch is the recovery method.
Do not promise exactly-once delivery, permanent history, acknowledgments or
delivery while disconnected.

## Layer responsibilities

| Layer | Responsibility | Not responsible for |
|---|---|---|
| Nginx | TLS termination and WebSocket upgrade proxying | JWT validation or calendar authorization |
| Daphne/ASGI | WebSocket protocol and application routing | Durable message history |
| Origin validator | Reject untrusted/missing browser origins | Identifying the user |
| JWT middleware | Cookie parsing, signature/type/expiry/user checks | Event write permission |
| `CalendarConsumer` | Eligibility check, group join, acknowledgment, forwarding, expiry/disconnect cleanup | Persisting missed messages |
| Redis/Channels | Cross-process fan-out to active group members | Durable queues, client acknowledgment, reconnect replay |
| REST event API | Current persisted snapshot and write validation/permissions | Guaranteed broadcast delivery after Redis failure |

## Known limitations and required decisions

### Ayoub

- Server-side `ws_access` cookie handoff contract with Mouad.
- Whether logout needs active socket revocation before JWT expiry.

### Mouad

- Normalize legacy/alias event fields once.
- Implement buffering, pagination, upsert/delete and reconnect reconciliation.
- Decide UI behavior while the live connection is stale or reconnecting.
- Keep access credentials out of client-visible storage and logs.

### Hamza

- Confirm production hostname, trusted Origin/host policy and CA-signed TLS.
- Preserve `/ws/` upgrade routing and trusted proxy boundaries.
- Provide dependency readiness/monitoring without treating HTTP liveness as
  proof that Redis and PostgreSQL are healthy.

### Ahmed

- Redis delivery failure is logged and does not erase committed notification
  history; there is no retry/outbox.
- Production rollout requires forward migrations and a populated-data rehearsal.
- The shared calendar group is appropriate only for public calendar data; do
  not place private per-user data in this payload.

## Frontend acceptance tests

Mouad can consider the integration verified only after these tests pass against
an isolated integrated environment:

1. Valid login/session obtains a backend realtime token without exposing it to
   JavaScript and the browser receives `connection_established` over verified
   WSS.
2. Missing/invalid/expired credentials and an untrusted Origin are rejected.
3. Create, update and delete one isolated event through authorized HTTP calls;
   two browser windows each apply one corresponding broadcast.
4. Aliases and nullable values render correctly, including no flyer, null club,
   null capacity and historical null dates/category.
5. A late browser fetches the REST snapshot and does not expect past broadcasts.
6. An update and deletion occurring during a deliberately delayed snapshot do
   not get overwritten or resurrected.
7. Disconnect one window; the other continues receiving updates.
8. Reconnect after a network interruption, refetch all pages, and converge to
   REST state without duplicate events.
9. Let the JWT expire; observe 4401, obtain a fresh token, reconnect and refetch.
10. Verify no token, cookie value, signing key or password appears in browser,
    frontend, Nginx or application logs.

These tests require coordinated authentication/frontend fixtures and are not
proved by backend unit tests alone.
