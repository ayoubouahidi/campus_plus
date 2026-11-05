<!-- # [ahmed] Added documentation; all content in this file belongs to Ahmed's changes. -->

# Ahmed's development changelog

<!-- # [ahmed] Real Docker/Nginx/Daphne/Redis/WSS expiry verification. -->
## 2026-11-05 — Verify JWT expiration through the local Docker WSS stack

### Scope and initial state

Branch `Ahmed` had existing uncommitted source/configuration/docs changes,
including the expiry consumer and 52 local passing tests. Inspected Git status,
consumer, JWT middleware, test coverage, Compose, Dockerfile/entrypoint, Nginx,
and the certificate. Rebuild/start of the existing local web service was
explicitly requested. No project source or teammate-owned files changed.

### Commands and actual results

Commands ran from `/home/ahlahfid/projects/campus_plus`. Docker commands used
`sg docker -c '...'` because the agent process needed the Docker group. Network
and Docker operations ran with the tool's outside-sandbox approval.

1. `git status --short` and `git branch --show-current`: VERIFIED `Ahmed`;
   existing modifications preserved. File inspection confirmed the expiry task,
   group cleanup, and current JWT cookie contract.
2. `sg docker -c 'docker compose up -d --build web'`: VERIFIED, exit 0. Built
   `campus_plus-web`, recreated/started `web`; db and Redis were healthy. Build
   installed the declared SimpleJWT dependency. No configuration files edited.
3. `openssl x509 -in infrastructure/nginx/certs/cert.pem -noout -subject -dates
   -ext subjectAltName`: VERIFIED localhost certificate, SAN localhost/127.0.0.1,
   valid 2026-11-04 through 2027-11-04.
4. Inside `sg docker -c`, ran `docker compose exec -T web python manage.py shell
   -c 'from django.conf import settings; from django.db import connection;
   from channels.layers import get_channel_layer;
   from realtime.consumers import CalendarConsumer;
   print("WS_AUTH_BACKEND:", settings.WS_AUTH_BACKEND);
   print("Database:", connection.vendor);
   print("Channel layer:", type(get_channel_layer()).__name__);
   print("Expiry handler:", hasattr(CalendarConsumer, "jwt_expired"));
   assert settings.WS_AUTH_BACKEND == "jwt"'`: VERIFIED output `jwt`,
   `postgresql`, `RedisChannelLayer`, expiry handler `True`.
5. `sg docker -c 'docker compose exec -T web python manage.py check'`:
   VERIFIED, no issues. Executed in the same command chain as configuration
   inspection and the full suite.
6. `sg docker -c 'docker compose exec -T web python manage.py test -v 1'`:
   VERIFIED, 52 discovered/passed, 0 failures/errors, 43.505 seconds, exit 0.
   Temporary PostgreSQL test database destroyed. Socket unit tests use an
   in-memory channel layer; these tests alone do not establish Redis/WSS.
7. `curl --cacert infrastructure/nginx/certs/cert.pem --silent --show-error
   --output /dev/null --write-out 'API HTTPS status: %{http_code}\n'
   https://localhost:8443/api/departments/`: VERIFIED HTTP 200, exit 0.
8. `.venv/bin/python /tmp/campus_plus_wss_expiry_probe.py`: VERIFIED, exit 0.
   Temporary host-side harness; not added to application source. Used existing
   Django/SimpleJWT/websockets dependencies and container Python subprocesses.
   See the sequence and measured results below.
9. Follow-up `sg docker -c` with `docker compose exec -T web python manage.py
   shell -c 'from django.contrib.auth import get_user_model;
   from django.conf import settings;
   count = get_user_model().objects.filter(username__startswith="ahmed_wss_expiry_").count();
   print("Remaining WSS probe users:", count);
   print("WS_AUTH_BACKEND:", settings.WS_AUTH_BACKEND);
   assert count == 0; assert settings.WS_AUTH_BACKEND == "jwt"'`:
   VERIFIED zero probe users and JWT mode still active, exit 0.

### Live probe sequence and results

- Created one unique PostgreSQL test user with an unusable password. Issued
  synthetic 20-second and 90-second access JWTs using the host's matching local
  development signing configuration, entirely in memory. No secret output.
- Connected two clients to `wss://localhost:8443/ws/calendar/`, Origin
  `https://localhost:8443`, access cookie in headers. Both received
  `connection_established`. TLS certificate and hostname verification stayed
  enabled, explicitly trusting only the local development certificate.
- Sent a uniquely identified `verification_probe` through the existing
  broadcast function and actual `calendar_updates` Redis group. Both clients
  received the pre-expiry probe. No event records were mutated; any other local
  group subscribers could also receive the harmless probe messages.
- Short connection closed with 4401 after 19.576 seconds, 0.018 seconds after
  its JWT expiry. Actual Redis group inspection confirmed its membership gone
  while the longer-lived observer remained subscribed.
- A post-expiry probe reached the observer. Reading the expired client's socket
  raised its 4401 closure instead of returning a broadcast. VERIFIED non-delivery.
- `finally` cleanup closed both sockets, checked both test memberships removed,
  deleted the isolated user, and verified zero matching records remained.
  No calendar records were created and no database volumes were touched.

### Documentation, boundaries, and remaining work

Updated this changelog, `docs/ahmed/LEARNING_JOURNAL.md`,
`docs/ahmed/FLOW_AND_TASKS.md`, and `docs/ahmed/ARCHITECTURE.md` with current
results, replacing the old-image limitation. No source-code fix was necessary.
No commit, push, frontend/model/API/issuance change, or production operation.

NOT TESTED here: browser login/cookie attributes, OAuth/refresh, negative WSS
handshakes through Nginx, real HTTP event CRUD broadcasts, frontend calendar
rendering, Redis-outage/queue-saturation behavior, or clock adjustments. Logout,
revocation, and account disablement still do not close existing sockets early.
The live test demonstrates the deadline policy for a synthetic credential,
not integration with the real authentication issuer or upstream runtime support.

<!-- # [ahmed] JWT expiration enforcement and resource cleanup. -->
## 2026-11-05 — Close calendar sockets when their verified JWT expires

### Goal and initial state

JWT middleware already returned the authenticated user and integer expiration
through `scope["jwt_exp"]`; the consumer only checked identity at handshake.
The recorded baseline was 45 tests. Existing uncommitted work was preserved.

### Changes and architectural decisions

- `realtime/consumers.py`: reject an expired deadline before joining; schedule
  an asyncio task for `max(0, exp - time())` after successful acceptance. The
  task sends `jwt.expired` to the consumer's own channel, so expiry handling
  is serialized with broadcasts. Remove group membership before closing 4401.
- Recheck expiry before forwarding broadcasts and ignore delivery after group
  removal. Share idempotent group cleanup between expiry and disconnect.
  Cancel and await the timer during disconnect; clear its reference and run
  group cleanup in `finally`. No timer is created for development tokens.
- `realtime/test_jwt.py`: add seven tests covering successful connection then
  expiry, normal-disconnect cancellation, group/task cleanup, a queued broadcast
  at expiry, handshake-boundary expiry, zero-delay scheduling, development-token
  compatibility, and malformed expiry values. Some tests cover several related
  assertions. Controlled clock/events replace minute-long sleeps. Removed
  explanatory comments from this test file as requested.
- `docs/ahmed/LEARNING_JOURNAL.md`: explain tasks, scope, delay calculation,
  event dispatch, cancellation, deterministic tests, and remaining work.
- `docs/ahmed/ARCHITECTURE.md` and `docs/ahmed/FLOW_AND_TASKS.md`: update current
  expiry behavior and roadmap. This changelog records exact verification.

Using a task allows the socket to remain responsive while waiting. Sending an
internal channel event preserves sequential lifecycle handling. Broadcast
deadline checks prevent delayed timer delivery from forwarding expired data.
This mechanism depends on the configured channel layer, not an independent
durable expiry service. JWT verification remains in middleware; the consumer
does not decode credentials. No new dependency was introduced.

### Commands and actual outcomes

- `.venv/bin/python manage.py check`: VERIFIED, no issues.
- `.venv/bin/python manage.py test realtime.test_jwt -v 1`, initial implementation:
  VERIFIED, 27 passed in 16.499 seconds, 0 failures/errors.
- Same targeted command after the final boundary test and lifecycle guards:
  VERIFIED, 28 passed in 18.115 seconds, 0 failures/errors.
- `.venv/bin/python manage.py test -v 1`: VERIFIED, 52 passed in 31.938 seconds,
  0 failures/errors. Includes the original 45 tests and seven new tests.
- Modified Python AST syntax checks and consumer diff whitespace check: VERIFIED.

Test suites ran with the local virtual environment outside the restricted
sandbox, temporary SQLite, and an in-memory channel layer. Test databases were
destroyed. Docker, PostgreSQL/Redis expiry integration, and browser WSS were
NOT TESTED in this task; no runtime service was restarted.

### Boundaries, remaining work, and learning

Only `realtime/` and Ahmed's documentation were changed. No middleware change
was necessary in this step. No shared settings, frontend, models, API, Docker,
Nginx, or issuance code changed. No commit or push.

Expiry is enforced for the credential used at connection time. Logout,
revocation, and account disablement do not immediately disconnect sockets;
agree their contract with the authentication owner. Refresh does not extend
an existing socket: it must reconnect using a new valid credential. No real
credentials are logged. Passing these application tests is not end-to-end
infrastructure verification. Explanations and exercises are provided, without
claiming Ahmed has independently mastered asynchronous cancellation.

<!-- # [ahmed] Real-time roadmap documentation. -->
## 2026-11-05 — Record real-time flow and task ownership

Created `docs/ahmed/FLOW_AND_TASKS.md` and linked it from the learning journal.
The roadmap separates implemented verification from unfinished authentication
and frontend integration, explains connection and event broadcast flows, and
lists ordered tasks with ownership and test criteria. No runtime code or team
infrastructure changed. Checked local Markdown links and trailing whitespace;
application tests were not rerun for this documentation-only change. The
45-test result in the roadmap is explicitly identified as a previous run.

<!-- # [ahmed] Follow-up calendar/JWT audit and origin test. -->
## 2026-11-05 — Calendar integration audit and missing-Origin regression test

- Goal: distinguish UI, API, JWT, and infrastructure readiness without replacing
  team interfaces or merging teammate work.
- Added `test_missing_origin_is_rejected` and a test-helper switch in
  `realtime/test_jwt.py`. A valid token must still fail when Origin is absent
  under explicit localhost hosts and `DEBUG=False`. No production-code change.
- Updated `README.md` and `docs/ahmed/ARCHITECTURE.md` to describe Compose JWT
  configuration separately from the older running backend image.
- Updated `docs/ahmed/LEARNING_JOURNAL.md` with architecture decisions, API field
  mismatches, commit/broadcast flow, Docker lifecycle, debugging, and exercises.
- `.venv/bin/python manage.py check`: VERIFIED, no issues.
- `.venv/bin/python manage.py test -v 1` outside sandbox, baseline: VERIFIED,
  44 passed, 0 failures/errors, 26.834 seconds.
- Same full-suite command after the new test: VERIFIED, 45 passed,
  0 failures/errors, 27.749 seconds. Temporary test database destroyed.
- Docker verification used `sg docker -c` with `docker compose exec -T web
  python manage.py shell -c ...`: PostgreSQL connection VERIFIED; unique-channel
  send/receive using the configured channel layer VERIFIED; running setting
  inspection returned `WS_AUTH_BACKEND: NOT CONFIGURED`.
- The local Compose file enables JWT, but the inspected running container
  still needs rebuilding/recreation. No services restarted during this audit.
- Teammate branch `Mouad` was inspected in a separate temporary clone; calendar
  uses mock events and has no API or WebSocket connection. Field names differ
  from our serializer. Intended teammate branch remains unconfirmed.
- Browser calendar CRUD and JWT WSS: NOT TESTED. Frontend build: NOT VERIFIED;
  the earlier dependency-install attempt failed with `LRU is not a constructor`.
- Security decision: preserve both origin checking and access-JWT verification;
  no query-token fallback, competing login, real-event mutation, or new package.
- No commit, push, merge, or changes to teammate branches. Learning explanations
  are recorded; independent comprehension has not been established.

## 2026-11-05 — Audit and harden experimental WebSocket JWT verification

### Goal and initial state

Prepare secure verification without replacing the team's login system.
Branch `Ahmed` contained existing uncommitted changes to `backend/asgi.py`,
`backend/settings.py`, and `requirements.txt`, plus untracked JWT middleware,
authentication adapter, five JWT tests, and empty documentation scaffolding.
Those changes were preserved and extended. No commit, push, or branch operation
was performed. `AGENTS.md` was empty and remains unchanged.

### Files modified in this session

- `realtime/jwt_middleware.py`: reject duplicate/malformed cookies, enforce
  access-only token type, handle malformed user identifiers as failed auth,
  and clarify that HttpOnly is an issuance responsibility.
- `realtime/test_jwt.py`: expand from 5 to 20 tests, including signature,
  refresh type, missing/deleted/malformed user, cookie ambiguity, wrong origin,
  query-only credentials, configured issuer/audience, fail-closed settings,
  ordinary cookie coexistence, and two-client JWT broadcasting.
- `README.md`: document actual runtime, authentication modes, commands,
  environment names, Compose limitations, and unfinished integration.
- `docs/ahmed/ARCHITECTURE.md`: current code flow, responsibilities, security
  boundaries, infrastructure configuration, and proposed future work.
- `docs/ahmed/LEARNING_JOURNAL.md`: explanations, function walkthrough,
  debugging guidance, questions, and exercise; no mastery claimed.
- `CHANGELOG_AHMED.md`: this audit and verification record.

### Approach and trade-offs

Reuse the existing SimpleJWT verifier and adapter; keep synchronous database
lookups inside `database_sync_to_async`. Parse cookies individually because
whole-header `SimpleCookie` parsing can overwrite duplicate names. Reject
malformed cookie input conservatively. Do not implement a competing login or
enable JWT in containers before agreeing on credential issuance. No dependency
installation or runtime version change was needed.

### Commands and actual outcomes

- `.venv/bin/python manage.py check`: VERIFIED, no issues, run before and after.
- `.venv/bin/python manage.py test -v 1` (initial sandbox run): FAILED,
  29 tests, 18 passed and 11 WebSocket timeout errors, no assertion failures.
- `.venv/bin/python manage.py test realtime.test_jwt.JWTWebSocketTests.test_valid_jwt_connects -v 2`
  (sandbox): FAILED, 1 timeout error.
- `.venv/bin/python manage.py test realtime.test_jwt -v 1` (outside sandbox,
  before changes): VERIFIED, all 5 existing tests passed.
- Same targeted command after initial hardening: VERIFIED, 18 tests passed.
- `.venv/bin/python manage.py test -v 1` (outside sandbox, final expanded
  suite): VERIFIED, 44 tests passed in 27.157 seconds, 0 failures, 0 errors.
  Includes all 20 final JWT/configuration tests and 24 existing tests.
- `.venv/bin/python manage.py makemigrations --check --dry-run`: VERIFIED,
  no changes detected.
- `.venv/bin/python -m compileall -q realtime/jwt_middleware.py realtime/test_jwt.py`:
  VERIFIED, successful compilation.
- `docker compose ps --format json`: BLOCKED by Docker socket permissions,
  including outside the sandbox. No container state or logs obtained.
- `git diff --check`: reported pre-existing trailing blank lines in
  `backend/asgi.py` and `requirements.txt`; preserved those existing edits.

No Docker tests were run. Redis/PostgreSQL integration, TLS, Nginx, and browser
WSS are NOT TESTED. Application tests use temporary SQLite and in-memory
channel layers; they do not establish infrastructure correctness.

### Security and remaining work

Reject ambiguous cookies, invalid signatures/expiry/type, missing accounts,
inactive users, and malformed user identifiers. Preserve origin checks and
avoid fallback to query tokens in JWT mode. Do not log raw credentials.
Issuer/audience tests use an explicitly configured test backend, not a real
external issuer. Production issuer/audience remain unconfigured.

JWT issuance, HttpOnly/Secure/SameSite cookie settings, refresh, logout,
revocation, and active-socket expiry enforcement remain unfinished. Frontend
sessions are mock state; signup issues DRF tokens. Compose does not pass
`WS_AUTH_BACKEND`. Coordinate the actual authentication contract with the login
owner, review the runtime support matrix, then verify the full browser flow.
SimpleJWT 5.5.1 metadata lists Django through 5.2 and Python through 3.13;
the tested runtime is Django 6.1.3/Python 3.14.10. Passing local tests is not
proof of upstream compatibility. Private-channel authorization is not yet
implemented because this consumer currently serves a shared calendar.

### Learning notes

Authentication differs from authorization. JWT verification differs from
issuance. Cookie flags are set by the issuing HTTP response. Async code must
delegate synchronous database work. A handshake timeout can be an environment
problem. In-memory broadcasting proves application flow, not Redis delivery.
