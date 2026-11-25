<!-- # [ahmed] Added documentation; all content in this file belongs to Ahmed's changes. -->

# Ahmed's learning journal

<!-- # [ahmed] Link the implementation roadmap to the learning resource. -->
See [real-time flow and tasks](FLOW_AND_TASKS.md) for the current phase,
connection/event flows, ownership boundaries, and ordered verification tasks.

<!-- # [ahmed] Verify JWT deadline enforcement through the running infrastructure. -->
## 2026-11-05 — JWT expiry through Docker, Nginx, Daphne, Redis, and WSS

### What was verified

The web image was rebuilt from the current code and its container recreated.
The running backend now reports `WS_AUTH_BACKEND=jwt`, PostgreSQL, and
RedisChannelLayer. Django checks passed. Running
`docker compose exec -T web python manage.py test -v 1` passed all 52 tests
in 43.505 seconds with zero failures/errors. Django created and destroyed a
temporary PostgreSQL test database. The socket unit tests still substitute an
in-memory channel layer; running them in Docker alone does not test Nginx/WSS.

We therefore ran `.venv/bin/python /tmp/campus_plus_wss_expiry_probe.py` on the
host as a separate integration probe. It created one uniquely named development
user with an unusable password in the running PostgreSQL database. Host-side
SimpleJWT used local development signing settings to mint two credentials for
that user: a 20-second access token and a 90-second observer token. Credentials
stayed in process memory and request headers, never command arguments, URLs,
printed results, or temporary token files. This is a synthetic development
fixture, not a new login or token-issuance implementation.

Both clients connected to `wss://localhost:8443/ws/calendar/`, sent the intended
HTTPS Origin and access cookie, and received `connection_established`. A harmless
`verification_probe` sent through the existing broadcast function and real
`calendar_updates` Redis group reached both clients. It did not create or change
calendar records. Existing local group subscribers could also receive these
probe messages; unique probe IDs distinguished the two test phases.

The short connection closed after 19.576 seconds, measured 0.018 seconds after
the integer JWT expiry timestamp, with close code 4401. Redis inspection showed
the short connection's group membership removed and the observer still present.
A second probe reached the observer; reading the expired connection reported
its 4401 closure rather than a broadcast. The probe then closed the observer,
verified both group memberships removed, and deleted the isolated user in a
`finally` cleanup path. No calendar records were created. A separate follow-up
database query checked the probe-user count.
It returned zero probe users and confirmed JWT mode remained active. The
19.576-second connection duration includes issuance/handshake timing and an
integer expiry boundary; the server did not close before the verified deadline.

### Why this proves more than the unit tests

An integration test connects real components. Here, a successful handshake
required TLS, Nginx upgrade forwarding, Daphne/ASGI routing, valid JWT verification,
and a PostgreSQL user lookup. The two broadcasts exercised real Redis group
delivery and consumer forwarding. The longer-lived observer is a control:
receiving the later probe shows that delivery continued to work when the short
connection stopped receiving. Removing the expired group member demonstrates
subscription cleanup as well as a closed client socket.

The test is specific: it proves deadline enforcement and transport delivery,
not event creation/update/deletion through HTTP. No source changes were needed.
The only project-file edits in this task are Ahmed's documentation.

### Expiration task in beginner-friendly terms

Think of each accepted JWT socket as having an alarm. Middleware verifies the
credential and gives the consumer its trusted expiry in `scope["jwt_exp"]`.
The consumer computes the number of seconds left and starts an asyncio task.
While that task awaits its timer, Python can serve other clients; it does not
block the server like a blocking sleep in a single-threaded C server would.

When the alarm fires, it sends an internal expiry event to the consumer. The
consumer leaves its calendar group and closes with 4401. Normal disconnect
cancels and awaits the alarm task so it does not wake later for a departed
client. A timestamp is not a thread, and the task does not continuously decode
the JWT or call the login service. Scheduling can introduce small delays: the
18 ms measurement is evidence from this run, not a universal timing guarantee.

### Certificate verification

The client used `ssl.create_default_context(cafile=local_certificate_path)`.
This explicitly trusts the project's self-signed certificate while requiring
certificate and hostname verification. The certificate includes localhost in
its subject alternative names. No `CERT_NONE`, unverified context, or curl
`--insecure` was used. For ordinary deployments, use the normal trusted CA chain.

### Limits and next learning tasks

Logout, revocation, and disabling an account still do not immediately disconnect
an already connected socket. Cookie issuance, browser HttpOnly/Secure/SameSite
behavior, OAuth, refresh/reconnect, negative handshakes through Nginx, API CRUD,
and frontend updates were not verified by this probe. Shared settings and
teammate systems were not changed. Production deployment was not tested.
Timer notifications depend on the channel layer; Redis outage/queue saturation
and clock adjustments were not exercised. The previous dependency compatibility
review is still outstanding.

Question: why is a live observer stronger evidence than checking only that the
expired client's socket closed? Exercise: trace the probe from the host through
TLS/Nginx to Django, then its message through Redis back to the observer. Next:
API mutation broadcasts and the authentication owner's logout/revocation contract.
These explanations do not establish independent mastery.

<!-- # [ahmed] JWT expiration and asynchronous task lifecycle. -->
## 2026-11-05 — Enforcing JWT expiry on an open socket

### Problem and ownership

A JWT that was valid at connection time can expire while the socket stays open.
We now enforce its expiration deadline in `realtime/consumers.py`, with tests
in `realtime/test_jwt.py`. Login, credential issuance, Docker, shared settings,
models, APIs, and frontend code were not changed. This entry supersedes the
earlier handshake-only expiry limitation. Understanding remains unassessed.

### What an asyncio task does

An asyncio task schedules a coroutine on Python's event loop. A coroutine is
an async function that can pause at `await` while other work continues. Here,
`asyncio.create_task(self.wait_for_jwt_expiry())` starts a timer for one socket.
`await sleep(...)` pauses that timer without blocking the server or other
connections. This is cooperative scheduling, not a new operating-system thread
per socket. For a C analogy, think of an event loop tracking several sockets
and timers rather than blocking all clients in a single `sleep()` call.

The consumer stores the task in `self.expiration_task` so it can stop and await
it later. Creating an untracked background task would lose that cleanup handle.

### Why put expiry in scope?

`scope` is Channels' per-connection dictionary. The existing JWT middleware
sets `scope["user"]` and `scope["jwt_exp"]` after cryptographic verification.
The latter is a Unix timestamp: seconds since the Unix epoch. The middleware
accepts an integer expiry and rejects other types, including booleans.

The consumer reads the verified timestamp instead of decoding JWTs again or
trusting a timestamp supplied in a socket message. Signature verification stays
in middleware; connection scheduling stays in the consumer. Development-token
authentication does not populate a JWT deadline, so it starts no expiry task.

### Execution flow

1. `connect()` initializes the timer handle and reads the verified deadline.
2. It checks user eligibility and rejects a JWT already expired by this point.
3. It joins `calendar_updates`, accepts, and sends the existing welcome message.
4. If a JWT deadline exists, it schedules `wait_for_jwt_expiry()`.
5. The timer computes `max(0, self.jwt_exp - time())`. If expiry is 12:05 and
   current time is 12:02, it sleeps for 180 seconds. Zero handles a deadline
   reached between the initial check and timer startup.
6. The timer sends `{"type": "jwt.expired"}` to this consumer's own channel.
   Channels dispatches it to `jwt_expired()`. Using the event stream keeps group
   cleanup in sequence with other consumer handlers rather than mutating it
   concurrently from the timer. This uses the configured channel layer; it is
   not a durable independent scheduler or a Redis-outage guarantee.
7. `jwt_expired()` removes calendar group membership and sends close code 4401.
   That code represents an application-specific unauthorized close.
8. `calendar_broadcast()` also checks the deadline before forwarding data. This
   prevents a queued event from bypassing a delayed expiry notification. Once
   group membership is cleared, later queued broadcasts are ignored.
9. When Channels receives the socket disconnect, `disconnect()` cancels and
   awaits the task and clears its reference. Group cleanup is shared and
   idempotent: running it again does not discard membership twice.

### Why cancellation must be awaited

`task.cancel()` requests cancellation; it does not synchronously finish the
coroutine. Awaiting it lets the cancellation complete. `CancelledError` is the
expected result and is suppressed specifically. Other task exceptions are not
silently hidden. A `finally` block still attempts group cleanup. If the timer
has already finished at expiry, awaiting the completed task is also safe.

Without cleanup, a timer could wake after the client disconnected, send an
irrelevant expiry event, and retain references to the old consumer until its
deadline. Canceling and awaiting prevents that resource leak on normal
disconnect. It does not revoke the user's credential.

### Deterministic tests and debugging

The lifecycle tests use a real signed token and middleware plus an in-memory
channel layer. They replace only the consumer's clock and sleep function with
controlled values and an `asyncio.Event`. This lets a test connect successfully,
observe a pending timer, advance to the exact deadline, release the timer, and
assert a 4401 close without waiting for actual minutes to pass. A one-second
timeout is a failure guard, not the simulated token lifetime.

The tests assert normal-disconnect cancellation, completed timer cleanup,
group removal exactly once, no forwarding after expiry, handshake-boundary
rejection, zero remaining lifetime, unchanged development-token broadcasting,
and rejection of malformed expiry values. Existing tests cover valid/rejected
credentials and two-client delivery. Exact commands/results are in the changelog.

Actual verification for this implementation:

- `.venv/bin/python manage.py check`: VERIFIED, no issues.
- `.venv/bin/python manage.py test realtime.test_jwt -v 1`: VERIFIED, final
  28 tests passed in 18.115 seconds, 0 failures, 0 errors.
- `.venv/bin/python manage.py test -v 1`: VERIFIED, 52 tests passed in
  31.938 seconds, 0 failures, 0 errors.

Both test runs used the local virtual environment outside the restricted
sandbox to allow local sockets, temporary SQLite, and an in-memory channel
layer. They did not run inside Docker. Temporary test databases were destroyed.

For debugging, distinguish "timer created", "timer woke", "expiry event
handled", "group left", and "close sent". Inspect close codes and task state;
never log the token or cookie. Do not patch `asyncio.sleep` globally: tests patch
the consumer module's imported sleep so Channels and test infrastructure retain
their real scheduling functions.

### What remains unfinished

Expiry now closes connections at their credential deadline. Logout, token
revocation, and disabling an account still do not immediately close existing
sockets. Those need the login owner's agreed contract and a separate mechanism
to notify or revalidate active connections. A newly refreshed token also does
not extend an existing connection's deadline; reconnect with the new cookie.
These changes have not verified real browser WSS or Docker expiry behavior.

Questions: Why does `cancel()` need a following `await`? Why must the consumer
use the middleware's verified expiry rather than a client message timestamp?

Exercise: trace what happens when a user disconnects one minute before expiry,
then explain which resources are released. Next study: coroutine cancellation,
consumer event dispatch, reconnect recovery, and revocation contracts.

## 2026-11-05 — WebSocket JWT verification

Historical entry: the later JWT expiration lifecycle entry below supersedes
the earlier limitation that expiry is checked only during the handshake.

Progress: implementation and examples provided; Ahmed's comprehension and
independent implementation have not yet been assessed. No mastery claimed.

### Authentication, authorization, and JWTs

Authentication answers “Who is this student?” Authorization answers “May this
student access this data?” A JWT is signed data containing claims, such as a
user identifier and expiry. A signature proves it was signed by a trusted key;
decoding its JSON alone proves nothing. Signing does not encrypt the contents.

Campus Plus uses SimpleJWT verification in `realtime/jwt_middleware.py`.
`get_validated_token()` checks the credential before `get_user()` looks up the
database account. A deleted or disabled student cannot establish a connection.
The consumer then grants access to the shared calendar. A private notification
channel would need a separate recipient ownership check.

Issuance creates credentials after login; verification checks credentials
already received. We implemented verification hardening, not login. OAuth
exchanges authorization with an identity provider; it does not automatically
make that provider's token a Campus Plus access token. A NextAuth session also
requires an explicit backend trust contract.

Session cookies, DRF tokens, and JWTs are different credential designs. DRF
tokens here reference database rows. A JWT carries signed claims, but our
verifier still loads a database user to check current account state. This costs
a query per connection and lets us reject disabled/deleted accounts at connect.

### Important function walkthrough

1. `JWTAuthMiddleware.__call__(scope, receive, send)` receives connection
   metadata (`scope`, a Python dictionary) and ASGI input/output functions.
   Like a C struct, the dictionary groups values; unlike a struct, keys and
   value types can change dynamically.
2. It sets `scope["user"]` to `AnonymousUser()`. Failure therefore leaves no
   authenticated identity, even if an earlier wrapper populated the scope.
3. It requires exactly one Cookie header. `get_access_cookie()` splits cookie
   pairs and uses `SimpleCookie` to parse them individually. A whole-header
   parser can overwrite duplicate names, like assigning a C array slot twice.
4. A compact-JWT pattern checks syntax only. It never proves authenticity.
5. `await get_jwt_user(token)` waits for verification and database lookup.
   `@database_sync_to_async` wraps the synchronous function, runs it in a worker
   thread, and manages database connection cleanup. A decorator is a function
   wrapper; this resembles calling a C function through a wrapper, but Python
   replaces the callable object at definition time.
6. SimpleJWT validates the signature, expiry, and configured claims. Our explicit
   type check accepts only access credentials even if API settings broaden.
   Expected credential or identifier errors return an anonymous user.
7. `await super().__call__(...)` passes control to routing and the consumer.
   The consumer rejects anonymous/inactive users before subscribing to a group.

`async` does not make blocking work nonblocking. An event loop schedules work
when awaited operations yield, much like coordinating nonblocking descriptors
with `poll`; a synchronous database query can still stall that loop. This is
why database access is wrapped rather than called directly in the consumer.

### Cookies and connection security

A cookie is a browser-stored name/value sent on matching requests. It lets a
browser deliver credentials on a WebSocket handshake. The issuing HTTP endpoint
must choose `Secure` (HTTPS transmission), `HttpOnly` (script cannot read it),
`SameSite` (cross-site sending policy), and path/domain scope. Incoming headers
do not reveal those settings. We have no issuance endpoint yet.

Automatic cookie delivery makes origin checks essential: an untrusted website
could try to open a socket using a student's browser credentials. Origin checks
and authentication solve different problems. Current origin validation uses
allowed hostnames; production needs an agreed scheme/port policy as well.

Expiry is checked during the handshake, not continuously. A socket is a
long-lived connection, so rejecting an expired token at connect does not close
a connection opened before expiration. Logout and revocation need a separate
connection policy. Refresh tokens must never authenticate calendar sockets.

### Testing and debugging

Run `.venv/bin/python manage.py test realtime.test_jwt -v 1` for JWT cases and
`.venv/bin/python manage.py test -v 1` for regressions. `WebsocketCommunicator`
simulates ASGI messages without a browser. The in-memory channel layer isolates
application logic; it cannot establish Redis or Nginx correctness.

Read a traceback from the final exception upward to the first project line.
`TimeoutError` at `client.connect()` says no handshake response arrived; it does
not by itself prove bad authentication. This session's sandbox timed out even
for anonymous clients. Existing JWT cases passed outside the sandbox without
application changes, isolating an environment restriction.

Common mistakes: decoding without signature verification; accepting refresh
tokens; logging raw credentials; treating `HttpOnly` as a middleware guarantee;
trusting a duplicate-cookie parser; claiming in-memory tests verify Redis;
assuming a valid token authorizes every private channel.

### Exercise and next concepts

Exercise: add a missing-Origin rejection test around the actual origin wrapper.
Then explain why that test differs from a missing-JWT test. Use an isolated
channel layer and clean up the communicator after either acceptance or rejection.

Comprehension questions: Why do we load the user after verifying the signature?
Why can a socket remain open after its JWT expires?

Next study: Python dictionaries, exceptions and decorators; ASGI scope and
middleware ordering; secure cookie issuance; access versus refresh lifecycle;
Redis delivery limits and database-backed recovery after reconnecting.

<!-- # [ahmed] Calendar integration audit and origin security exercise. -->
## 2026-11-05 — Calendar integration boundaries and runtime verification

Progress: explanations and an automated origin test added. Ahmed's independent
understanding has not been assessed; no mastery is claimed.

### A displayed calendar versus a connected calendar

A calendar can display hard-coded example events without contacting Django.
That proves the interface can render, but does not prove it can read or change
database records. The separate checkout of `origin/Mouad` at `1e07ad7` uses
`mockEvents` in `frontend/src/app/calendar/page.tsx`; no API fetch or WebSocket
connection was found in that frontend. That branch has not been merged into
Ahmed's checkout. Confirmation that this is the intended teammate branch is
still outstanding.

An API contract defines the fields and behavior that two components agree on.
The frontend expects `title`, `start_time`, and `end_time`; our serializer sends
`name`, `starts_at`, and `ends_at`. Merely pointing the frontend at the API
cannot resolve these differences. A future mapping function can translate the
shared fields, but category, RSVP, and attendee data also need an agreed source.
Inventing those values would hide missing functionality.

### Why keep HTTP writes and WebSocket delivery separate?

Our existing `ClubEventViewSet` handles create, update, and delete requests.
Its permission classes decide who may change an event. After a successful
database commit, `transaction.on_commit` calls `broadcast_calendar_event`.
Redis carries the message to connected consumers, which send JSON to browsers.

```text
Organizer -> HTTP API -> permission check -> database commit
                                             |
                                             v
                                  broadcast -> Redis -> WebSocket clients
```

Keeping this flow preserves the existing API, validation, and permissions.
Moving writes into the socket would require duplicating those rules. Socket
authentication identifies the connected user; it does not grant permission to
edit events. Redis broadcasts are transient: a reconnecting calendar must fetch
current records from the API to recover missed updates. A successful database
commit alone also does not guarantee subsequent message delivery.

### Why a valid JWT still needs an origin check

A browser may attach a cookie automatically. The Origin header identifies the
website opening the socket; it is separate from the credential identifying the
user. `AllowedHostsOriginValidator` remains outside authentication middleware,
so both checks must succeed. The new
`JWTWebSocketTests.test_missing_origin_is_rejected` uses a valid access token
but omits Origin, with explicit localhost hosts and `DEBUG=False`.

The test helper now accepts `include_origin=False` to model an absent header.
Using an empty string would not work because its existing `origin or ...`
expression substitutes the default origin. Explicit settings prevent DEBUG or
wildcard-host conveniences from hiding a regression. This is a test-only
change; production authentication behavior is unchanged.

Origin checking helps protect browsers; non-browser clients can forge headers,
so it never replaces JWT verification. Exact scheme/port policy and secure
cookie issuance remain unfinished integration work.

### Image, container, and configuration

An image is the packaged application; a container runs that package. This
Dockerfile copies source during build and Compose does not mount the backend
source directory. Editing local Python files therefore does not update a
running backend. Changing Compose also requires recreating the service.

Compose now specifies JWT mode, but inspection of the running container still
reported `WS_AUTH_BACKEND: NOT CONFIGURED`. PostgreSQL connected, and the actual
configured Redis channel layer successfully sent and received a test message
on a uniquely named channel. No user events were created or deleted by this
check. These results establish database/channel connectivity, not browser JWT
integration. No running services were rebuilt or restarted during this audit.

### Debugging and practice

Inspect the source of calendar data first: `mockEvents` versus an API request.
Then inspect field names in `ClubEventSerializer`, the browser Network panel,
and the WebSocket handshake. A passing mock-based broadcast test establishes
that application code requests a broadcast; it does not establish Redis or
browser delivery. Run tests with a temporary database rather than deleting
real events as test fixtures.

Exercise: sketch a mapping from `name`, `starts_at`, and `ends_at` to the
frontend fields. List which frontend fields the API cannot currently supply.

Questions: Why can the calendar render successfully while database changes
remain invisible? Why does changing Compose not change an already running
container's environment?

Next concepts: API contracts, initial data fetching, reconnect recovery,
transaction callbacks, and Docker build versus service recreation. Exact test
commands and final results for this audit are recorded in `CHANGELOG_AHMED.md`.
