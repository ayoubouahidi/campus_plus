# Campus Plus Public API Specification

Status: implemented contract snapshot for Ahmed's backend work on 2026-11-23.

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
| `rsvped` | `true` requires authentication and keeps only events for which the current user currently has an RSVP. |
| `search` | Case-insensitive search across event name/title, description, Club name, and location; maximum 200 characters. |
| `page` | Page number. |
| `page_size` | Integer 1–200; default 20. |

Duplicate, empty, malformed, out-of-range, and unsupported values return 400
with field-specific messages. A reversed/equal `from`/`to` interval returns 400.

Ordering is fixed to `starts_at` ascending, nulls last, then primary key for
stable pages. Client `ordering` is not supported; sending it returns 400.

### Current user's RSVP history

`GET /api/club-events/?rsvped=true` is the implemented profile-history
contract. Authentication is required. Ownership is always derived from
`request.user`; a submitted user ID is ignored. The normal bounded event
pagination and chronological ordering include both past and upcoming current
registrations. Cancelled registrations disappear. `attendees_preview` is `[]`
on this focused response so unrelated attendee identities are not returned.

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
  "president_email": "president@example.test",
  "president_phone": "+212600000000",
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

`logo_url` may be `""`. `banner_url` may be null. Migration
`core_data.0012_backfill_club_slugs` fills missing Club slugs deterministically,
rejects unsafe existing values, and makes the field non-null. New Clubs
generate unique URL-safe slugs from their names.

The two president contact fields are included only for authenticated active
users. Anonymous callers cannot see them; invalid or inactive credentials are
rejected. Missing values are empty strings for an authenticated caller.
`contact_email` remains write-only. Responses use `Vary: Authorization` and
`Cache-Control: private, no-store` to prevent shared-cache leakage.

POST, PUT, PATCH, and DELETE are disabled for all Club callers and return 405.

## Browser media URL contract

`flyer_url`, `logo_url`, and `banner_url` use
`DJANGO_PUBLIC_MEDIA_BASE_URL` when configured. It must be one explicit HTTP(S)
origin without credentials, path, query, fragment, or wildcard; production
HTTPS mode requires HTTPS. This avoids returning an internal host such as
`web:8000` and does not trust forwarded host headers. Without the setting,
request-derived absolute URLs remain the fallback.

Hamza must set the externally reachable origin and route its `/media/` path to
the shared media volume over HTTPS without exposing unrelated files. Backend
tests validate URL construction, not a real Nginx/browser request.

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

## Personal notification API

All endpoints in this section require the configured DRF authentication. They
derive the recipient exclusively from `request.user`; there is no public create
endpoint and no accepted `user_id` parameter.

### List personal notifications

`GET /api/notifications/` returns only the authenticated user's records, newest
first, in the standard `{count, next, previous, results}` page envelope. The
default page size is 20 and `page_size` accepts 1–100. `unread=true` returns
unread records and `unread=false` returns read records.

Each result has this shape:

```json
{
  "id": 12,
  "notification_type": "event_updated",
  "title": "Event updated",
  "message": "An event you registered for changed.",
  "event_title": "AI Hackathon",
  "is_read": false,
  "created_at": "2026-11-22T16:00:00Z",
  "read_at": null,
  "event_id": 24
}
```

Supported types are `new_event`, `event_updated`, `event_cancelled`,
`rsvp_confirmed`, `rsvp_cancelled`, and `club_announcement`. The announcement
type is a safe integration point; automatic dashboard announcement fanout is
not enabled because that publication flow is dashboard-owned.

### Unread and read-state operations

- `GET /api/notifications/unread-count/` returns `{"unread_count": 4}`.
- `POST /api/notifications/{id}/read/` idempotently marks one owned record read
  and returns that notification. Another user's ID returns 404.
- `POST /api/notifications/read-all/` updates only the caller's unread records
  and returns `{"updated_count": 3, "unread_count": 0}`. Existing `read_at`
  values are preserved.

Unsupported writes return 405. Anonymous requests return 401.

## Personal notification WebSocket

Connect to `/ws/notifications/` using the same origin validation and
authentication stack as `/ws/calendar/`. In production JWT mode the browser
sends the backend-issued access JWT only in the trusted `ws_access` cookie;
query-string JWTs are rejected. The server derives the private group from the
authenticated user ID, so clients cannot select a recipient or group.

After acceptance the server sends:

```json
{"type":"connection_established","message":"Subscribed to personal notifications"}
```

followed by the authoritative-at-connect-time count:

```json
{"type":"notification.unread_count","data":{"unread_count":4}}
```

New records use:

```json
{
  "type": "notification.created",
  "data": {
    "id": 12,
    "notification_type": "event_updated",
    "title": "Event updated",
    "message": "An event you registered for changed.",
    "event_title": "AI Hackathon",
    "is_read": false,
    "created_at": "2026-11-22T16:00:00Z",
    "event_id": 24
  }
}
```

Read operations may publish `notification.unread_count` to reconcile other open
tabs. The socket is server-to-client only; use REST for state changes. JWT
expiry closes with code 4401 and removes group membership, matching the calendar
consumer lifecycle.

PostgreSQL is authoritative and Redis delivery is best effort. On initial load,
reload, or reconnect, fetch the REST list and unread count. Deduplicate live
items by notification `id`. To avoid a fetch/message race, start the socket,
buffer live messages while fetching REST state, then merge by ID and apply the
newest count/state. A disconnected client loses live messages but not history.

### Automatic recipient policy

| Business action | Recipients | Duplicate rule |
| --- | --- | --- |
| New public event | Every active, non-staff, non-superuser account whose role is `STUDENT` or `BOARD_MEMBER`; Club membership is irrelevant | Once per event/user |
| Meaningful registered-event change | Active RSVP users | Once per saved change/user |
| Status transition to cancelled | Active RSVP users | Cancellation-specific alert |
| First successful RSVP | Registering user | Once per RSVP row |
| Successful RSVP cancellation | Cancelling user | Once per deleted RSVP row |
| Dashboard announcement | Not automatically enabled | Dashboard integration pending owner approval |

All notification rows are created inside the business transaction and live
messages are scheduled with `transaction.on_commit()`. Failed transactions send
nothing. Redis failures are logged without payload or recipient details and do
not roll back persistent history. Event deletion sets `event_id` to null so the
text history remains serializable without a dangling relationship.
`event_title` snapshots the event name at creation and survives event deletion.
Historical rows may contain null. Mouad should localize from
`notification_type` plus `event_title`, falling back to English `title` and
`message` when structured information is unavailable.

New-event fanout is campus-wide, while later changes/cancellation/deletion are
sent only to affected active RSVP attendees. The current account schema cannot
independently prove 1337 eligibility: `ALLOWED_42_CAMPUSES` is optional during
42 sync, and compatibility email registration has no campus enforcement. Ayoub
must make the approved 1337 policy reliable before campus-wide notification
deployment. Accounts classified with student/board roles are trusted by this
query; unrelated staff, superusers, `SUPERADMIN` users, and inactive accounts
are excluded.

Fanout remains synchronous. This is acceptable for the current expected campus
size, but delivery time grows with recipient count. A materially larger future
audience would require an approved background worker; this implementation does
not introduce Celery or another queue implicitly.

## Explicitly unavailable features

The schema intentionally does not claim the following:

- `/api/me/rsvps/` (use `GET /api/club-events/?rsvped=true`);
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
4. Department slug nullability remains a legacy-data concern. Club slug
   nullability is resolved by forward migration `core_data.0012`; Hamza must
   rehearse it against a disposable copy of populated deployment data.
