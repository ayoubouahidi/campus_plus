<!-- # [ahmed] Real-time flow, ownership, verification status, and task roadmap. -->
# Ahmed's real-time flow and tasks

Updated: 2026-11-05. Branch: `Ahmed`. Role: Member 3, Real-Time Engine.

## Where I am now

We are at **Phase 5: integration verification** of the JWT task in `AGENTS.md`.
Phase 2, agreement on the team's authentication contract, is still incomplete.
JWT verification works in local automated tests; full browser login and calendar
integration are not complete. Passing tests does not mean every component is
connected or that I have independently mastered the concepts.

| Phase | Status | Evidence or remaining work |
| --- | --- | --- |
| 1. Audit | Performed for inspected code | Recheck when teammate code changes. |
| 2. Authentication contract | Incomplete | Agree on issuer, signing configuration, user mapping, cookie issuance, refresh, and logout. |
| 3. Secure JWT verification | Implemented locally | Access-cookie verification, user checks, origin validation, and no query-token fallback in JWT mode. |
| 4. Authentication tests | Verified locally and in Docker | Docker full run: 52 passed, 0 failures/errors, including JWT expiry lifecycle. |
| 5. Integration verification | Expiry path verified; broader integration pending | Verified TLS/WSS acceptance, Redis broadcast, expiry close 4401, post-expiry non-delivery, and cleanup. Real API CRUD and login/browser flow remain unverified. |
| 6. Documentation | Updated, ongoing | Keep results and limitations current after each test. |

<!-- # [ahmed] Current Docker and WSS verification supersedes the old-image audit. -->
The backend has now been rebuilt and recreated, and its running setting is
`WS_AUTH_BACKEND=jwt`. The Docker full suite passed 52 tests in 43.505 seconds
using a temporary PostgreSQL test database; socket unit tests still use an
in-memory channel layer. A separate real WSS probe used the running PostgreSQL,
Redis, Nginx, and Daphne services with certificate/hostname verification enabled.
The 20-second JWT connection closed 0.018 seconds after its expiry with code
4401. The live observer received a post-expiry calendar broadcast; the expired
client received none. Test group memberships and the isolated user were removed.
These results do not verify real browser login, cookie issuance, or API CRUD.

## Flow 1: establish an authenticated calendar connection

```text
Login owner verifies the user and issues a backend-compatible access cookie
  | This issuance step is not implemented in Ahmed's current checkout
  v
Browser opens wss://localhost:8443/ws/calendar/ with ws_access cookie
  v
Nginx terminates HTTPS/WSS and forwards the upgrade to Daphne
  v
backend.asgi -> AllowedHostsOriginValidator
  | Checks the website opening the connection against allowed hosts
  v
get_websocket_auth_stack -> JWTAuthMiddleware when WS_AUTH_BACKEND=jwt
  | Requires one unambiguous ws_access cookie
  | Verifies signature, expiry, access type, configured issuer/audience
  | Loads the Django user through database_sync_to_async
  v
CalendarConsumer checks authenticated + active user
  | Rejected users do not join the group
  v
Join calendar_updates through the Redis channel layer
  v
Accept socket -> send connection_established -> forward calendar messages
  v
Disconnect -> discard group membership
```

**Why these boundaries:** origin checks identify the connecting website;
JWT verification identifies the user. Keeping verification in middleware lets
the consumer focus on connection and message handling. Database work runs in
a worker so it does not block the asynchronous event loop. Authentication runs
at connection time. JWT connections now have a timer that closes at the verified
expiry with code 4401 and removes group membership. Normal disconnect cancels
and awaits the timer. Logout, revocation, and account disablement still do not
close an existing socket before its JWT deadline.

`ws_access` is the current experimental interface, not proof of an agreed login
contract. A NextAuth session credential must not be assumed to be a SimpleJWT
access token. HttpOnly/Secure/SameSite attributes are set by the issuing HTTP
response, not by WebSocket middleware.

## Flow 2: create, update, or delete a calendar event

```text
Organizer sends an HTTP request with API credentials
  | POST   /api/club-events/       -> create
  | PATCH  /api/club-events/<id>/  -> update
  | DELETE /api/club-events/<id>/  -> delete
  v
Existing API authentication, permissions, and serializer validation
  v
Database save/delete -> successful commit
  v
transaction.on_commit -> broadcast_calendar_event
  v
Redis group calendar_updates
  v
CalendarConsumer.calendar_broadcast -> connected clients receive JSON
  v
Frontend applies event_created / event_updated / event_deleted
  | Frontend integration is still pending in the inspected teammate calendar
```

The API currently uses DRF tokens; enabling JWT for sockets does not enable
JWT authentication for API writes. Socket access does not grant edit rights.

Broadcasts use this envelope:

```json
{
  "type": "event_deleted",
  "data": { "id": 123 }
}
```

Creation and update messages contain the serialized backend event in `data`.
They use fields such as `name`, `starts_at`, and `ends_at`. The inspected frontend
expects `title`, `start_time`, and `end_time`, so integration requires an agreed
mapping. Do not fabricate missing category, attendee, or RSVP information.

**Why this flow:** HTTP keeps validation and edit permissions in the existing
API. Broadcasting after commit avoids announcing changes that were rolled back.
Database success does not guarantee subsequent broadcast delivery. Redis
messages are not durable history: after reconnecting, a client must fetch current
API state. Subscribe before fetching and reconcile messages received during the
fetch so an initial snapshot cannot overwrite a newer live update.

## Ownership rules

| Classification | Files or subsystem | Rule |
| --- | --- | --- |
| OWNED | `realtime/`, `docs/ahmed/` | Modify for authorized real-time tasks; explain, test, and document. |
| SHARED | `backend/asgi.py`, `backend/settings.py`, `backend/urls.py`, `requirements.txt` | Explain minimal integration changes and obtain explicit approval. |
| TEAMMATE-OWNED | Frontend, login/OAuth, models, unrelated APIs, Docker, Nginx | Inspect; modify only with explicit authorization. |

Previous approval for a specific change does not authorize unrelated changes.
Never commit, push, merge, discard work, or delete database volumes without
the required permission. Keep credentials out of logs, examples, and URLs.

## Next tasks in order

### 1. Verify the current backend in Docker

- [x] Rebuild/recreate `web` to apply the already authorized JWT configuration.
- [x] Confirm the running setting is `jwt`, not merely the local Compose value.
- [x] Run Django checks and tests against the rebuilt image.
- [x] Record which database and channel layer the tests actually use.

Commands for the existing local development stack:

```bash
docker compose up -d --build web
docker compose exec web python manage.py check
docker compose exec web python manage.py shell -c 'from django.conf import settings; print(settings.WS_AUTH_BACKEND)'
docker compose exec web python manage.py test -v 1
```

An image packages source at build time. Restarting an old container does not
copy new local Python files into it. Recreating applies changed environment
variables; rebuilding includes changed source/dependencies.

### 2. Agree on the authentication interface with the login owner

- [ ] Inspect the actual teammate implementation, not just its description.
- [ ] Agree who issues the access token and `ws_access` cookie.
- [ ] Agree signature verification, claims, user IDs, lifetime, issuer/audience.
- [ ] Agree cookie scope and HttpOnly/Secure/SameSite settings.
- [ ] Agree refresh, logout, revocation, and existing-socket behavior.
- [ ] Document incompatible interfaces and ownership; do not build another login.

This contract can proceed in parallel with infrastructure verification. A
temporary synthetic test credential can verify the socket independently, but
does not establish real login integration. Never print real credentials.

### 3. Verify JWT WSS through Nginx

- [x] Use the HTTPS origin `https://localhost:8443` and matching WSS endpoint.
- [x] Valid test access cookie: accepted and receives connection_established.
- [x] Automatically close a connected socket at JWT expiry with code 4401.
- [x] Verify expired group removal and post-expiry non-delivery against a live observer.
- [x] Clean up temporary users and both test connection memberships.
- [ ] Missing, invalid, expired, refresh, and ambiguous credentials: rejected.
- [ ] Missing or untrusted Origin: rejected under the intended host policy.
- [ ] Confirm rejection leaves no calendar group membership behind.
- [x] Record results without logging cookies or tokens.

### 4. Verify real create/update/delete broadcasting

- [x] Connect two authenticated test clients through Nginx.
- [ ] Create an isolated test event through the existing API: both receive event_created.
- [ ] Update it: both receive event_updated with the new fields.
- [ ] Delete that test event: both receive event_deleted with its ID.
- [ ] Verify database state and rejection of unauthorized mutations.
- [ ] Clean up only test-owned fixtures; leave real user data untouched.

The API tests mock broadcast delivery. Socket unit tests use an in-memory
channel layer. The expiry integration probe verified the real group-broadcast
transport using harmless `verification_probe` messages, not event mutations.
The remaining CRUD tasks must prove API writes and their event broadcasts
together; do not mark them complete from the transport-only probe.

### 5. Hand off the calendar contract to the frontend owner

- [ ] Confirm which teammate branch is intended; `Mouad` was inspected separately.
- [ ] Agree the event field mapping and API credential handling.
- [ ] Replace mock calendar data with API retrieval (frontend owner).
- [ ] Apply live create/update/delete messages (frontend owner with Ahmed's interface).
- [ ] Fetch again after reconnect and reconcile snapshot/live-message ordering.
- [ ] Test two browser windows and refresh persistence together.

Do not merge or edit teammate frontend code without explicit authorization.

### 6. Finish connection security and documentation

- [x] Implement JWT deadline enforcement and cancellation on normal disconnect.
- [ ] Agree and implement logout/revocation behavior within ownership.
- [ ] Review explicit origin scheme/port requirements with the configuration owner.
- [ ] Review runtime dependency compatibility with the team.
- [ ] Update journal, architecture notes, and changelog with actual outcomes.
- [ ] Add private notifications only after recipient authorization is agreed.

## How to verify my own work

```bash
.venv/bin/python manage.py check
.venv/bin/python manage.py test realtime.test_jwt -v 1
.venv/bin/python manage.py test realtime.tests.AutomaticEventBroadcastTests -v 1
.venv/bin/python manage.py test -v 1
```

Read failures by layer: HTTP status/permissions, cookie/token validation, Origin,
ASGI routing, Redis delivery, and finally frontend rendering. A handshake timeout
can also be an environment restriction. Report VERIFIED, FAILED, NOT TESTED, or
BLOCKED with exact commands and counts; never infer end-to-end success from
unit tests alone.

## Learning checkpoint

Explain the difference between token issuance, token verification, and permission
to edit an event. Then trace one event update from HTTP request to two clients.

Exercise: identify which tasks above Ahmed owns and which require a teammate.
Completion of implementation is separate from evidence of understanding.
