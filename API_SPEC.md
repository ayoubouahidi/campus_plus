# Campus Plus Public API Specification

Status: implemented contract snapshot for branch `Ahmed` on 2026-11-20.

This file documents current runtime behavior. It deliberately distinguishes
implemented public reads from planned authentication, RSVP, readiness, and
management work.

## OpenAPI access

- Machine-readable schema: `GET /api/schema/`
- Swagger UI: `GET /api/docs/`
- Offline validation:

  ```bash
  .venv/bin/python manage.py spectacular --file /tmp/campus-plus-schema.yaml --validate
  ```

OpenAPI normally omits HEAD and OPTIONS operations. Unless stated otherwise,
public GET resources also support HEAD. Club and Department OPTIONS remain
available through DRF.

## Public event API

### List events

`GET /api/club-events/`

Authentication: none.

Successful response:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 3,
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
      "starts_at": "2026-11-21T09:00:00Z",
      "ends_at": "2026-11-23T09:00:00Z",
      "start_time": "2026-11-21T09:00:00Z",
      "end_time": "2026-11-23T09:00:00Z",
      "location": "Agora Hall",
      "category": "Tech",
      "status": "planned",
      "capacity": 150,
      "created_at": "2026-11-01T10:00:00Z",
      "updated_at": "2026-11-02T10:00:00Z"
    }
  ]
}
```

`flyer_url` is an absolute URL when request context is available and `""` when
no flyer exists. Legacy and frontend aliases are both preserved.

### Event filters and search

All supplied filters combine with AND.

| Parameter | Contract |
| --- | --- |
| `category` | Exact allow-listed category: `Tech`, `Media`, `Music`, `Sports`, `Business`, `EventsOrganization`, or `Gaming`. |
| `club` | Exact Club slug. |
| `department` | Exact Department slug. |
| `status` | Exact `planned`, `ongoing`, `completed`, or `cancelled`. |
| `from` | ISO 8601 date/datetime lower overlap boundary; keeps events with `ends_at > from`. |
| `to` | ISO 8601 date/datetime upper overlap boundary; keeps events with `starts_at < to`. |
| `upcoming` | `true` keeps events whose `ends_at` is in the future; `false` adds no end-time filter. |
| `search` | Case-insensitive search across event name/title, description, Club name, and location; maximum 200 characters. |
| `page` | Page number. |
| `page_size` | Integer 1–200; default 20. |

Duplicate, empty, malformed, out-of-range, and unsupported values return 400
with field-specific messages. A reversed/equal `from`/`to` interval returns 400.

Ordering is fixed to `starts_at` ascending, nulls last, then primary key for
stable pages. Client `ordering` is not supported; sending it returns 400.

### Event detail

`GET /api/club-events/{id}/`

Authentication: none. The response uses the same event item shape as the list.
Unknown IDs return 404.

Every event list/detail item also includes:

- `rsvps_count`: public aggregate registration count.
- `has_user_rsvpd`: current authenticated user's state; always `false` for an
  anonymous request.
- `attendees_preview`: at most three newest attendees for authenticated users;
  always `[]` anonymously. Entries contain only `id`, `full_name`, and
  `avatar_url`.

### Register or cancel an RSVP

`POST /api/club-events/{id}/rsvp/` and
`DELETE /api/club-events/{id}/rsvp/` require authentication.

POST creates one registration and returns 201. Repeating POST is idempotent and
returns 200 without creating a duplicate. DELETE removes only the requesting
user's registration and is idempotent when no registration exists. Successful
responses contain `rsvps_count` and `has_user_rsvpd`.

Capacity is enforced transactionally. A full event returns 409 and creates no
RSVP. Unknown events return 404. Event-status restrictions remain a product
decision; this API does not currently invent a cancelled/completed-event rule.

### List attendees

`GET /api/club-events/{id}/attendees/` requires authentication and returns the
standard `{count, next, previous, results}` envelope, newest RSVP first. Each
entry contains only `id`, `full_name`, and `avatar_url`; email, phone, password,
token, and membership-private fields are never returned. Signed-in-student
visibility follows the frontend recommendation and still requires final product
owner approval.

## Public Club API

### List active Clubs

`GET /api/clubs/`

Authentication: none. Current response is a bare JSON array, not a paginated
envelope. Inactive Clubs are omitted for every caller while final superadmin
roles are unavailable.

### Club detail

`GET /api/clubs/{slug}/`

Authentication: none. Lookup is by slug, not numeric Club ID.

Current item fields:

```json
{
  "id": 3,
  "slug": "leet-dev",
  "name": "LEET Dev",
  "description": "A software engineering club.",
  "department": 1,
  "department_id": 1,
  "department_name": "1337 Coding School",
  "department_slug": "1337",
  "logo_url": "https://example.test/media/club_logos/example.webp",
  "banner_url": null,
  "president": 20,
  "president_name": "Yassine El Amrani",
  "member_count": 86,
  "event_count": 24,
  "upcoming_event_count": 3,
  "meeting_day": "Thursday",
  "meeting_time": "17:00:00",
  "meeting_location": "Innovation lab",
  "is_active": true,
  "created_at": "2025-01-12T10:00:00Z",
  "updated_at": "2026-11-20T10:00:00Z"
}
```

`logo_url` may be `""`. `banner_url` may be null. Slugs remain nullable in the
serializer until the A0 migration/backfill is complete, although a null Club
slug cannot be used for detail lookup.

Anonymous responses do not include `contact_email`, `president_email`, or
`president_phone`. The internal serializer still accepts `contact_email` as a
write-only field, but Club writes are temporarily disabled.

POST, PUT, PATCH, and DELETE are disabled for all Club callers and return 405.

## Public Department API

### List Departments

`GET /api/departments/`

Authentication: none. Current response is a bare JSON array.

Optional `search` performs case-insensitive matching against the historical
Department title.

### Department detail

`GET /api/departments/{id}/`

Authentication: none. Lookup remains by numeric ID.

```json
{
  "id": 1,
  "name": "1337 Coding School",
  "title": "1337 Coding School",
  "slug": "1337"
}
```

`name` is the frontend alias for the preserved `title`. `slug` can be null until
A0 migration/backfill. POST, PUT, PATCH, and DELETE are disabled for all callers
and return 405.

## Public health/liveness API

### Compatibility liveness

`GET /api/health/`

```json
{"status":"ok","message":"API is running"}
```

Content-Type: `application/json`.

### Minimal process liveness

`GET /api/health/live`

Body: `ok` with Content-Type `text/plain`.

Both endpoints are public, support GET/HEAD, and perform no database, Redis, or
Channels checks. Other methods return 405. A successful response means Django
can answer HTTP; it does not prove dependency readiness.

The planned superadmin-only component readiness response is not implemented.
Its route ownership, timeouts, 200/503 policy, and AY-03 permission dependency
must be resolved before implementation.

## WebSocket JWT issuance

### Issue a short-lived access token

`POST /api/realtime/token/`

Authentication: required using the project's configured DRF HTTP authentication
(`Authorization: Token …` at present).

Request body: none. Any submitted user ID, username, or role is ignored. The
token subject is derived exclusively from the authenticated `request.user`.

Successful response (`200`):

```json
{
  "access": "<signed SimpleJWT access token>",
  "expires_in": 300
}
```

The response has `Cache-Control: no-store`. `expires_in` is measured in seconds
from the token's issued-at claim to its expiry claim. Its value comes from
SimpleJWT's configured `ACCESS_TOKEN_LIFETIME`; the current default is five
minutes. The endpoint uses SimpleJWT's configured signing key, algorithm, user
ID field, and claim names. It does not create a refresh token or database row.

Failure behavior:

- Missing, invalid, revoked, or inactive DRF authentication is rejected before
  issuance (normally `401`). A defensive inactive-user check also returns `403`
  if an inactive authenticated user object reaches the view.
- If `WS_AUTH_BACKEND` is not `jwt`, the response is `503` with
  `{"detail":"WebSocket JWT authentication is disabled."}`.
- GET, PUT, PATCH, DELETE, and OPTIONS return `405`. Only POST is allowed.
- Failure responses are also marked `Cache-Control: no-store`.

The endpoint returns the JWT to a trusted HTTP caller; it does not set a browser
cookie. Mouad's Next.js server must call this endpoint server-to-server using
the current user's authenticated DRF credentials, then set `ws_access` on the
browser response with `HttpOnly`, `Secure`, an appropriate `SameSite` policy,
an expiry matching the JWT, and a path that includes the WebSocket request
(currently `/ws/`). The token must not be placed in a URL query parameter or
browser localStorage.

The browser then opens `/ws/calendar/` and sends the cookie automatically. In
JWT mode, Django's existing WebSocket middleware verifies the SimpleJWT
signature, token type, expiry, and user, and the consumer rejects unsuccessful
authentication. In development, the default `WS_AUTH_BACKEND=token_dev` keeps
this issuance endpoint disabled. Production must explicitly select
`WS_AUTH_BACKEND=jwt`; `token_dev` is already rejected when `DEBUG=False`.

The integrated backend also provides `/auth/sync`, email/password login,
`/api/me/`, and logout. Existing sockets remain valid until their JWT expires;
HTTP token logout does not maintain a WebSocket revocation list.

## Existing non-public/interim operations

Event POST/PUT/PATCH/DELETE operations exist at runtime and therefore remain in
OpenAPI. They are labeled **interim management API**. Their current permissions
are not Ayoub's final shared board/superadmin authorization contract and clients
must not treat them as stable public operations.

Club and Department writes are fail-closed with 405 and are absent from OpenAPI.

The legacy `POST /api/signup/` endpoint also exists and is documented in
OpenAPI. It is not Ayoub's unfinished custom-user `/auth/sync`, `/api/me/`, and
logout contract.

## Explicitly unavailable features

The schema intentionally does not claim the following:

- `/api/me/rsvps/`;
- final product approval for attendee visibility and cancelled/completed RSVP
  policy;
- protected database/Redis/Channels readiness;

## Unresolved compatibility questions

1. Frontend shared types describe a paginated Club response, but the current
   Club endpoint returns a bare array. Pagination must not be invented without
   an approved compatibility decision.
2. Frontend Club types currently require president email/phone strings, while
   the privacy contract requires those keys to be absent anonymously. The
   frontend should make them optional or define an authenticated response type.
3. Hamza's infrastructure documentation uses `/api/health/` for public
   liveness, while the newer team plan reserves it for protected readiness.
   Infrastructure should move probes to `/api/health/live` before repurposing
   the root health route.
4. Department and Club slug nullability is temporary pending an approved A0
   migration and backfill.
5. Database-backed response and query behavior remains unverified until A0 is
   resolved; OpenAPI/contract tests are database-free evidence only.
