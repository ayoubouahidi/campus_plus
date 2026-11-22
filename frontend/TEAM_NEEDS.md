# What the frontend needs from the team

> Written 2026-11-08 by the frontend (Mouad) after reading each teammate's branch. Every item says **who**, **what**, and **why the frontend needs it**. Tick items off here as they land. How the frontend works: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Per-component detail: [`DOCS.md`](./DOCS.md).

**The contract:** the frontend's data shapes are in `frontend/src/types/api.ts` (`EventItem`, `Club`, `User`, `ApiResponse<T>`). The backend can name things its own way; the frontend maps them in one place. But every *piece of information* below has to come from somewhere.

---

## 0. Team rules (everyone)

| # | Rule | Why |
| --- | --- | --- |
| 0.1 | **Push only to your own branch** and merge through a PR. Never push to someone else's branch. | `Mouad` received an infra commit (`7a0c578`) on 2026-11-06 that pointed Docker at a backend that isn't on that branch, so `web` couldn't start. It was reverted on 2026-11-08 (still safe on the `Hamza` branch). |
| 0.2 | **Merge order to `master`:** infra + backend (Hamza + Ahmed + Ayoub) → frontend (Mouad) → dashboard (Ayoub) | Each layer needs the one below it to run. |
| 0.3 | One `.env.example` at the repo root listing **every** variable (never real secrets). **Started on `Mouad` (2026-11-19)**: DB, Django and login variables; add yours to it. | Today variables are spread across branches with different names (`SECRET_KEY` vs `DJANGO_SECRET_KEY`, `REDIS_HOST` vs `REDIS_URL`). |
| 0.4 | Times in the API are **ISO 8601 UTC** (`2026-11-05T17:00:00Z`). The frontend converts to campus time (`Africa/Casablanca`). | Ahmed's settings already use `TIME_ZONE='UTC'`, `USE_TZ=True`. Keep it. |

---

## 1. Backend API & data: split between Ahmed and Ayoub (from 2026-11-18)

The new teammate announced on 2026-11-16 is **not joining**. DASH's role is split by what each one's code already does (full plan with tasks A0–A10 / B1–B9, endpoint owners, JSON shapes, milestones and production checklist: Mouad's Desktop `README_BACKEND_AHMED_AYOUB.md`; the older `README_BACKEND_TEAMMATE.md` is obsolete):

| | Ahmed | Ayoub |
| --- | --- | --- |
| Django apps | `core_data` (events, clubs, departments, **RSVP**) + `realtime` | new `accounts` (`/auth/sync`, `/api/me/`, roles, permission classes) + new `dashboard` (announcements, join requests, audit log) |
| Endpoints | public read API, filters, pagination, uploads, RSVP, `/api/realtime/token/`, `/api/health/` | `/auth/sync`, `/api/me/`, logout, `/api/board/*`, `/api/superadmin/*`, `/api/clubs/{slug}/join/` |
| Why | wrote the models, serializers and the broadcasts (the broadcast payload *is* the event serializer) | his `auth.ts` already calls `/auth/sync`, his middleware defines the roles, his dashboard screens define the board/admin data |

**Migrations rule:** only Ahmed migrates `core_data`, only Ayoub migrates `accounts` / `dashboard`. All `core_data` field changes (below) go into **one day-1 migration** agreed together.

Sections 1.1–1.5 below are the student website's needs; owner: **Ahmed** (RSVP, events, clubs, pagination, uploads). Login (§1b.1) moves to **Ayoub** (`/auth/sync`, `/api/me/`); Ahmed issues the WebSocket JWT (`POST /api/realtime/token/`, the website's server sets the `ws_access` cookie).

**Security, fix first:** `/api/clubs/` allows anonymous PUT/PATCH/DELETE (only `create` is protected), and `/api/departments/` has no permissions at all (DRF default `AllowAny`).

What exists today (on `Ahmed`): `/api/clubs/`, `/api/club-events/`, `/api/departments/`, `/api/members/`, `/api/signup/` (DRF token), Swagger at `/api/docs/`, WebSocket `/ws/calendar/` with JWT.

### 1.0 Ahmed's push of 2026-11-20 (`cb0057f`, checked by Mouad)

Spec: `API_SPEC.md` on `Ahmed` (Swagger `/api/docs/`). Blocked part: `AYOUB_DEPENDENCIES.md` (AY-01…AY-06).

| Our ask | Status |
| --- | --- |
| Security: anonymous club/department writes | ✅ Club + Department writes return 405; `/api/members/` needs auth (writes: admin) |
| §1.2 event fields: `title`, `start_time`/`end_time`, `flyer_url` (absolute, `''`), `category` (our 7), `club_name` + `club_slug`, `department_name` + `department_slug`, `status` | ✅ all (old names kept as aliases); also `capacity` |
| §1.2 query params `from`, `to`, `upcoming`, `club`, `department`, `category`, `search` | ✅ (+ `status`, `page`, `page_size` ≤ 200, 400 on bad values). Ordering fixed to `starts_at` (no `ordering` param) |
| §1.3 club `slug` + `GET /api/clubs/{slug}/`, `logo_url`, `banner_url`, `department_name`, `president_name`, counts, meeting fields | ✅ (slug still nullable until migration A0) |
| §1.3 president email/phone only for signed-in users | ⚠️ Never returned now (safe). Needs Ayoub's auth to return them to signed-in users |
| §1.4 pagination | ✅ events (`{count,next,previous,results}`); ❌ clubs and departments are bare arrays |
| §1.5 uploads: UUID file names, 2 MB, real-image check, absolute URLs | ✅; pixel limit not seen |
| §1.1 RSVP | ⚠️ `Rsvp` model exists (unique user+event); **no endpoints, no `rsvps_count` / `has_user_rsvpd` / `attendees_preview`**: blocked on Ayoub's `accounts.User` (AY-01, AY-04) |
| Health | ✅ `/api/health/` (JSON) + `/api/health/live` (text) |

**Ahmed's questions to the frontend (API_SPEC "Unresolved compatibility questions"), Mouad's answers:**
1. *Clubs are a bare array, frontend types say paginated.* → **OK for now** (few clubs, the frontend can take an array). Paginate later only if the "advanced search" module needs it.
2. *Frontend `Club` type requires president email/phone, API hides them when anonymous.* → **Done on `Mouad` (2026-11-20):** `president_email?` / `president_phone?` are optional in `types/api.ts`, and `ClubContactCard` shows each line only when present (it was already signed-in only). Ahmed returns them when the request has a valid token (after AY-04).
3. *Health route for Hamza's probes* → Hamza: use `/api/health/live`.
4. IDs are numbers in the API, strings in our types → frontend converts in its mapping layer (Phase 7); no change needed.

### 1.1 RSVP: missing entirely (blocks the main feature)

| Need | Detail |
| --- | --- |
| A model | `Rsvp(user, event, created_at)`, unique per user+event |
| `POST /api/club-events/{id}/rsvp/` and `DELETE` the same URL | Signed-in only: anonymous requests get **401** (the UI shows "Log in to RSVP" since 2026-11-21, but the API is the real lock). Return the new `rsvps_count` and `has_user_rsvpd`. |
| On every event in lists and detail: `rsvps_count`, `has_user_rsvpd` (false when signed out), `attendees_preview` (≤ 3 `{id, full_name, avatar_url}`, newest first) | The event cards show the count, the "Going" state and an avatar stack. |
| `GET /api/club-events/{id}/attendees/` | The full list on the event page. **Decided (2026-11-20): signed-in only.** Anonymous requests get 401/403 here, and events in lists/detail carry `rsvps_count` but an **empty `attendees_preview`** (names and pictures never leave the server for signed-out visitors). Same rule as the president's contact details |

### 1.2 Events (`ClubEvent`): fields the UI shows

| Frontend field | Backend today | Ask |
| --- | --- | --- |
| `title` | `name` | fine, frontend maps it |
| `start_time` / `end_time` | `starts_at` / `ends_at` | fine. Make them **required** (calendar can't place an event without a start). |
| `flyer_url` | `image_path` exists on the model but **isn't in the serializer** | Add it as an absolute URL (`''` or `null` when none) |
| `category` | missing | Add `category` with choices `Tech, Media, Music, Sports, Business, EventsOrganization, Gaming` (filters, colours, calendar) |
| `club_id`, `club_name` | `club` (id only) | Add `club_name` (and ideally `club_slug`) so the feed needn't fetch every club |
| `department_name` + **campus** | missing on events | Add `department_name`. ~~`department_slug` for the campus filter~~: no longer needed, 1337 only (§1d). |
| `status` (`planned`/`ongoing`/`completed`/`cancelled`) | exists | Keep it. Frontend will show a "Cancelled" badge. |

**Query parameters** (so the frontend doesn't download everything): `?from=&to=` (date range for the calendar month), `?upcoming=true`, `?club=<slug>`, `?department=<slug>`, `?category=`, `?search=` (title/description/club/location).

### 1.3 Clubs

| Frontend field | Backend today | Ask |
| --- | --- | --- |
| `slug` | missing | **Required.** Pages are `/clubs/<slug>`. Unique, URL-safe, and `GET /api/clubs/<slug>/` (or `?slug=`). |
| `logo_url`, `banner_url` | missing | Two optional `ImageField`s, returned as absolute URLs |
| `department_name` | `department` (id) | Add the name (or nest `{id, title, slug}`) |
| `president_name`, `president_email`, `president_phone` | `president` (id), `contact_email` | Add name + phone. **Privacy:** return these **only to signed-in users**, enforced by the API (the frontend already hides them, but data that leaves the server is public). |
| `member_count`, `event_count`, `meeting_*`, `is_active` | exist | Good, the frontend will start showing them |

### 1.4 Lists and pagination

The frontend expects DRF pagination: `{count, next, previous, results}` (`ApiResponse<T>`). Today no `DEFAULT_PAGINATION_CLASS` is set, so lists are plain arrays. Add `PageNumberPagination` (page size ~20).

### 1.5 Uploads (flyers, logos, avatars)

- **Unique file name per upload** (UUID in `upload_to`). Replacing an image must give a **new URL**, otherwise caches keep showing the old one (ARCHITECTURE §7.5).
- **Reject huge files**: Ahmed's validators already cap at **2 MB** (JPEG/PNG/WebP, real-image check); add a pixel limit (≤ 4000 px). A single 77 MB photo once timed out the image service.
- Return **absolute** URLs.

---

## 1b. Login (Ayoub) + real-time (Ahmed)

Ahmed owns `realtime` (Channels, Daphne, Redis, WebSocket JWT, `POST /api/realtime/token/`). Ayoub owns the Django side of **authentication** (§1b.1). Split details: §1.

### 1b.1 Auth: Django side of login (Phase 5, owner Ayoub: `accounts` app)

| Need | Detail |
| --- | --- |
| `POST /auth/sync` (internal) | Called by the Next.js server after a 42 login, with header `x-internal-key: $BACKEND_INTERNAL_KEY`. Body: the 42 profile (`login`, `email`, `first_name`, `last_name`, `image`, campus). **Creates or updates** the user and returns `{ user, token }`. |
| `user` shape | `id, email, full_name, avatar_url, role ('STUDENT' \| 'BOARD_MEMBER' \| 'SUPERADMIN'), club_id` (`types/api.ts → User`) |
| `token` | One token the frontend sends as `Authorization: Token …` for RSVP and private data. Plus the **WebSocket JWT** for the same user: Ahmed's socket code (JWT mode) reads it from a `ws_access` cookie, never from the URL. Someone must set that cookie (HttpOnly, Secure, SameSite) and refresh it (5-minute lifetime by default). |
| Public reads | `GET` on events, clubs and departments must work **without** a token (`AllowAny` for safe methods); writes need auth |
| `GET /api/me/` | The current user from the token |
| 42 app keys (Step 5.2 is ready, DOCS §7.5) | Share `AUTH_42_SCHOOL_ID` / `AUTH_42_SCHOOL_SECRET` for the student site (or create a second 42 app), and add the redirect URIs **`https://localhost/api/auth/callback/42-school`** (dev) and `https://campusplus.ma/api/auth/callback/42-school` (prod). |
| Email/password | **Decided: mandatory (subject).** Frontend built on `Mouad` (DOCS §11, 2026-11-21): the login form calls `POST /api/auth/login/` (`Ayoub-backend`: `{email, password}` → `{token, user}` / 401), the sign-up page calls `POST /api/signup/` then logs in. See §1b.3 for what is still needed. |

### 1b.3 Email sign-up & login: what the frontend needs (2026-11-21, owners Ayoub + Ahmed)

| Need | Why |
| --- | --- |
| **Refuse a second sign-up with the same email** (case-insensitive): 400 `{ "email": ["A user with this email already exists."] }` | Today `SignupSerializer` doesn't check. Two accounts with one email → `POST /api/auth/login/` finds 2 users and answers 401 forever: that student can never log in. The frontend already shows "An account with this email already exists → Log in instead" for any `email` error containing "already exists". |
| **One sign-up endpoint**: `POST /api/signup/` is on both `Ahmed` and `Ayoub-backend`. Agree which one is merged | The frontend calls one URL. Body we send: `first_name, last_name, email, password, year_of_study (1–7), department_id, club_id \| null`. We only need `201`; the login right after gives us `{token, user}`. |
| `POST /api/auth/login/` merged to `master` | Without it the email login answers "temporarily unavailable" (locally a dev fallback is used, DOCS §11.1). |
| 400 bodies in DRF's usual shape `{ field: ["message"] }` | Shown under the matching field. Field names = the request's. |
| Optional: run Django's password validators (`validate_password`) in `SignupSerializer` | The frontend asks for ≥ 8 characters; Django is the place to refuse common passwords like `password123`. Its messages show under the password field. |

### 1b.2 Real-time (WebSocket `/ws/calendar/`), Phase 6

Message: `{ "type": "event_created" | "event_updated" | "event_deleted", "data": <event in the same shape as the API> }`. For `event_deleted`, `data` can be `{ "id": … }`. The frontend already uses these three names (`WebSocketEventType`).

---

## 1e. Backend merge review (Mouad, 2026-11-22, branch `Ahmed` at `e04d4a3`, PR #4 `integration/ahmed-ayoub-final`)

Ahmed and Ayoub merged accounts, dashboard, RSVP and realtime. **Thank you: most of what the student site waited for is there**, with our field names (`title`, `start_time`, `rsvps_count`, `has_user_rsvpd`, `attendees_preview`…). The student site now builds its data layer against this API (DOCS §14). What is still missing or different:

| # | Who | What | Why the student site needs it |
| --- | --- | --- | --- |
| BE1 | Ahmed | **Club contact for signed-in requests:** `president_email` and `president_phone` (or `contact_email`) in `GET /api/clubs/{slug}/` when the request has a valid token; absent for anonymous requests (already the privacy rule in `API_SPEC.md`) | The club page's contact card shows them to signed-in students (DOCS §6.13). Today the API never sends them, so the card would always be empty |
| BE2 | Ahmed | **`GET /api/me/rsvps/`** (or `GET /api/club-events/?rsvped=true` with the token): the signed-in user's RSVP'd events, upcoming and past | `/profile` lists "Going" and "Went to". Without it the profile can only show mocks. `API_SPEC.md` lists it as unavailable on purpose: tell us the plan |
| BE3 | Ahmed + Ayoub | **Drop EMINES and UM6P from the seed and the docs** (`README_BACKEND_AHMED_AYOUB.md` still plans departments `1337, emines, um6p`). Set the 42 campus allow-list (`auth_sync`) to the 1337 campuses | Decision §1d: Campus Hub is for 1337 only |
| BE4 | Ahmed + Hamza | **Media URLs the browser can load:** `flyer_url` / `logo_url` / `banner_url` are built from the request host. When Next.js calls Django inside Docker (`http://web:8000`), that host is `web:8000`, which no browser can reach. Serve `/media/` through nginx and build URLs from a public base (e.g. `PUBLIC_MEDIA_URL=https://localhost/media/`) | Every flyer and logo would be a broken image on the student site |
| BE5 | Ahmed | Confirm **club slugs are never null** after the A0 backfill (AH6) | Club pages are `/clubs/{slug}`; the frontend hides clubs without a slug until then |
| BE6 | Hamza | Merged compose: `BACKEND_URL=http://web:8000` and the same `BACKEND_INTERNAL_KEY` for `frontend` and `web` (HZ2) | Login, sign-up and every page read Django through these |
| BE7 | everyone | **Merging `Mouad`:** the `Ahmed` branch still has the old placeholder `frontend/` folder from October (Hamza, `fa2151a`). Git will report conflicts in `frontend/` when the student site is merged: **keep `Mouad`'s version of every file in `frontend/`** | The October folder is the old Next.js starter, not the student site |
| BE8 | Ahmed | **Notifications: which design are you building?** (a) **derived**: no storage, the student site shows "New event / Event changed / Event cancelled" from the realtime messages it already receives (a feed that starts empty on each visit); or (b) **stored**: a Django model with a per-student list and read state, plus endpoints, e.g. `GET /api/notifications/` (paginated, newest first), `POST /api/notifications/{id}/read/`, `POST /api/notifications/read-all/`, and a realtime message `notification_created` sent to that student only. For (b), send us the JSON of one notification (we use `id, title, body, created_at, is_read, event_id`) and say who gets one (everyone? only students who RSVP'd to the changed event?) | The bell and its panel are built and translated (DOCS §3, §12.2) and wait only for the data. The notifications module (1 pt) needs "all create/update/delete actions" to notify: tell us if (a) is enough for you or if you're building (b). Until then the bell stays empty with the real backend (DOCS §14.4) |
| BE9 | Ahmed | **Small doc fix:** `REALTIME_FRONTEND_HANDOFF.md` says broadcasts carry no RSVP fields, but `event_created` / `event_updated` do include `rsvps_count`, `has_user_rsvpd` and `attendees_preview`, with anonymous values (0 / false / []), since no user is attached when the serializer runs. Either remove them from the broadcast or document them as "always anonymous" | The student site ignores them (it keeps its own RSVP state, DOCS §15.1), so nothing breaks; the doc should just match |

New on the API that the student site will use (no action needed): `capacity` and **409 "Event capacity has been reached"** on RSVP (the site will show "Event full"), `status` (`cancelled` events get a badge), numeric ids (the site maps them to strings), `member_count` / `upcoming_event_count` on clubs.

## 1d. Decision: Campus Hub is for 1337 only (Mouad, 2026-11-22)

**EMINES and UM6P are not partners.** The student site no longer mentions them: no campus switch (All / 1337 / EMINES) on the feed and the clubs page, no EMINES or UM6P links in the footer, legal texts and descriptions say 1337 only, mock clubs and events are 1337 ones (DOCS §13). What the rest of the team should do:

| Who | What |
| --- | --- |
| Ahmed | Seed / fixtures: only the `1337 Coding School` department (drop EMINES, FGSES, UM6P Central Campus). `department_slug` on events (§1.2) is no longer needed for a campus filter. |
| Ayoub | Dashboard: no EMINES / UM6P departments or clubs in forms and mock data. `/auth/sync` (and email sign-up) should refuse accounts that aren't 1337 (the login page says "Campus Hub is for 1337 students" on `AccessDenied`). |
| Everyone | README and presentation: describe Campus Hub as the 1337 platform. |

## 1c. Merge plan and open questions (2026-11-21)

**Decision (Mouad, 2026-11-21): no merge yet.** We wait until **Ayoub's dashboard endpoints** are finished and integrated, and **Ahmed gives his OK** on the final endpoints, then merge everything once into an integration branch (or `master`). Reason: the data flow is **dashboard → Django → student site**. Board members create clubs and events on the dashboard, Django stores them, the student site only reads them. Merging before those endpoints are final means merging twice and fixing conflicts twice.

Meanwhile the frontend keeps working on what doesn't need the backend (languages EN/FR/AR + RTL, search sorting/pagination, design-system page, lint and console checks, README part) and builds the API mapping layer against the shapes agreed below, so the merge is "switch the mocks off", not a rewrite.

**Please answer in the team chat or directly in this file (write your answer under the question).**

### 1c.1 Everyone

| # | Question | Why it matters |
| --- | --- | --- |
| E1 | **Dates:** when are the endpoints frozen (no more renames), and when do we merge? Proposal: freeze first, merge a few days later, leave a week before the evaluation for testing | "Real data + many users" is mandatory: without a date, waiting can eat the time we need to test |
| E2 | **Where do we merge:** a shared `integration` branch first, then `master`, or straight to `master`? | `master` has only a README today. An integration branch lets us fix conflicts without breaking `master` |
| E3 | Merge order (rule 0.2): infra + backend (Hamza, Ahmed, Ayoub) → student site (Mouad) → dashboard (Ayoub). Still OK? | Each layer needs the one below it to run |
| E4 | **Roles for the README** (subject): who is Product Owner, Project Manager, Tech Lead? | Mandatory README section, checked at the evaluation |
| E5 | Everyone writes their own part of the README (features, modules, contributions) by the merge date | Mandatory; the evaluators ask each member about their part |
| E6 | Set `git config user.name` / `user.email` to your real name and 42 email | The subject checks that every member committed. Mouad adds a `.mailmap` for his older commits |

### 1c.2 Ayoub (dashboard + accounts)

| # | Question | Why it matters for the student site |
| --- | --- | --- |
| AY1 | **Dashboard host: same domain (`/dashboard`) or another host (`admin.…` / `dashboard.…`)?** (also §2.3) | Same host: one certificate, no CORS, cookies need different names. Other host: second 42 redirect URL, CORS in Django, a second nginx `server` block (Hamza §3.7), separate logins |
| AY2 | **One login for both apps or two?** If one: same `AUTH_SECRET` and cookie, and the student site sends board members to the dashboard already logged in. If two: they log in again on the dashboard | Decides what "Manage my club" does on the student site |
| AY3 | **The list of dashboard endpoints** (create/edit/delete club, event, members, join requests, announcements), with request and response JSON. Which are done, which are left, and an ETA | The student site shows what the dashboard creates: we need to know every field an event and a club will have |
| AY4 | Do dashboard writes go into **Ahmed's tables** (`core_data` `Club`, `ClubEvent`) through the same serializers, or into separate tables? | Must be the same rows, or what board members create never appears on the student site |
| AY5 | When a board member creates/edits/deletes an event or a club, does Django **broadcast it** on `/ws/calendar/` (Ahmed's realtime)? | Real-time module (2 pts) + notifications module (1 pt): the student site updates live from those messages (§1b.2) |
| AY6 | Required fields when creating an event (§2.6): category from our 7, start/end, location, flyer ≤ size limit. Validated in the dashboard form **and** in Django? | The student site has no fallback for a missing category or dates. The subject requires frontend + backend validation |
| AY7 | **`accounts.User` and `GET /api/me/`**: ETA and final JSON (`id, email, full_name, avatar_url, role, club_id, club_slug, campus`) | `/profile`, roles, and Ahmed's RSVP (blocked on your User model, AY-01/AY-04) |
| AY8 | Email auth (§1b.3): `POST /api/auth/login/` merged, **unique email** on sign-up, and which `/api/signup/` we keep (yours or Ahmed's) | Login and sign-up pages are live and call these URLs |
| AY9 | When a superadmin changes someone's role, does the student site see it at the next `/api/me/` call, or only after logging in again? | Decides whether we re-read the role on each page |
| AY10 | The URL the student site should link board members to ("Manage my club" on `/profile`) | Board members need a way from one app to the other |

### 1c.3 Ahmed (core API + RSVP + realtime)

| # | Question | Why it matters for the student site |
| --- | --- | --- |
| AH1 | **Your OK on the final endpoint list** in `API_SPEC.md` (events, clubs, departments, RSVP, attendees, health), and the date after which names don't change | The student site's mapping layer is written once against these names |
| AH2 | **Sample JSON** for each endpoint (one list page, one detail, one error), as files or in `API_SPEC.md` | Mouad builds and tests the mapping layer on `/test` with them before the merge |
| AH3 | **RSVP endpoints** (`POST`/`DELETE /api/club-events/{id}/rsvp/`, 401 when signed out) and `rsvps_count` / `has_user_rsvpd` / `attendees_preview` on events: ETA once Ayoub's User exists (§1.1) | RSVP is the main feature and the "many users" proof |
| AH4 | `GET /api/club-events/{id}/attendees/`: signed-in only, anonymous → 401, empty `attendees_preview` for anonymous (decided 2026-11-20, §1.1) | The Privacy Policy promises it; the student site already hides names (DOCS §9.3) |
| AH5 | Clubs and departments: stay **bare arrays** or become paginated like events? (§1.0) | The mapping layer reads one shape; tell us which is final |
| AH6 | Club `slug` never null after migration A0? | Club pages are `/clubs/{slug}` |
| AH7 | Do events created by the dashboard (Ayoub) go through **your** serializer and validation, and trigger **your** broadcast? (same question as AY4–AY5, you two decide together) | One source of truth for events |
| AH8 | WebSocket: confirm `POST /api/realtime/token/` accepts the Django token we get at login, and the JWT lifetime (5 min?) | The student site's server sets the `ws_access` cookie and must refresh it (Phase 6) |

**Ahmed's answers (2026-11-22, checked against branch `Ahmed` at `9f55a6d`):**

| # | Answer | Status | What it means for the student site |
| --- | --- | --- | --- |
| AH1 | Events, clubs, departments, health and realtime are ready at the contract level. RSVP and attendees are still pending. Endpoint names are frozen **after our integration tests pass**. | 🟡 partly | Map events/clubs/departments now; RSVP/attendees stay on mocks. The freeze date depends on the integration tests (E1) |
| AH2 | Ahmed will send representative list, detail and error JSON from the integrated backend before the freeze. Current endpoints are documented in `API_SPEC.md`. | ⏳ waiting | Until the samples arrive, the mapping layer is written against `API_SPEC.md` and checked again with the samples |
| AH3 | The RSVP model exists, but its migration and endpoints are not done. Ahmed starts them once Ayoub's custom User model and the database integration are validated. | ⏳ blocked on Ayoub (AY7) | RSVP stays on the mock fallback (DOCS §9.4). It is the main feature, so AY7 is the critical path |
| AH4 | **Agreed:** attendee names and avatars for signed-in users only; anonymous visitors see the RSVP count. | ✅ agreed | Matches what the site already does (DOCS §9.3) and the Privacy Policy |
| AH5 | Events stay paginated. Clubs and departments stay **bare arrays** for now. | ✅ final for now | The mapping layer reads `{count, next, previous, results}` for events and a plain array for clubs/departments |
| AH6 | Migration `0008` adds **nullable** unique slugs. A safe backfill and validation are still needed before every public club is guaranteed a slug. | 🟡 not yet | Until the backfill lands, the mapping layer must handle `slug: null` (fall back to an id-based link or hide the club link) |
| AH7 | **Agreed:** Ayoub's dashboard must use the shared `ClubEvent` records, validation and realtime broadcast. Checked during integration. | ✅ agreed (to verify) | One source of truth: what the dashboard creates appears on the student site and is broadcast live |
| AH8 | **Confirmed:** `POST /api/realtime/token/` takes the Django DRF token and returns a WebSocket JWT. Default lifetime **300 s (5 min)**. The student site's server handles the secure `ws_access` cookie, refresh and reconnection. | ✅ confirmed | Phase 6: the frontend server refreshes the token before 5 min and reconnects when it expires |

Also from Ahmed: migrations `0007`, `0008` and `0009` are pushed and passed isolated SQLite rehearsals. They are **not applied** to the shared database yet, because the custom-user integration with Ayoub comes first. **E2:** Ahmed supports a shared `integration` branch before `master`. **E1:** freeze and merge dates to be set from Ayoub's remaining dashboard work, with time left for end-to-end tests. **E5:** Ahmed writes his backend part of the README.

### 1c.4 Hamza (infrastructure)

| # | Question | Why it matters |
| --- | --- | --- |
| HZ1 | After AY1: does the dashboard need its own nginx `server` block and certificate (§3.7)? | Depends on Ayoub's answer |
| HZ2 | In the merged compose: `BACKEND_URL=http://web:8000` for the frontend container, and Django + the frontend share the same `BACKEND_INTERNAL_KEY` (§3.4) | Without it the student site can't reach Django (login, data) |
| HZ3 | Who sets up the integration branch (E2) and checks that `make up` still starts everything with one command after the merge? | Mandatory: one-command Docker start |

## 2. Ayoub (42 login + club dashboard, branch `Ayoub`)

| # | Need | Why |
| --- | --- | --- |
| 2.1 | The login files (`auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`, the login page) | Phase 5 integrates them into the student site (DOCS §7). |
| 2.2 | **Which 42 app** (client id) you use, and add the redirect URI `https://<host>/api/auth/callback/42-school` for the student site | 42 refuses logins whose redirect URI isn't registered. |
| 2.3 | Where the dashboard will live: **same domain** (`/dashboard`) or a **subdomain** (`admin.<host>`)? | Two Auth.js apps on one domain share cookie names and log each other out. `/admin` is already Django's admin in nginx, so your `callbackUrl: '/admin'` can't work as is. |
| 2.4 | **Upgrade the dashboard to Next 16.4.6** (the student site is on 16.4.6 since 2026-11-19) | 16.0–16.4.4 have critical advisories (RCE in image optimization and `use cache`, cache poisoning). `npm install next@16.4.6 eslint-config-next@16.4.6` works with React 19.2/19.3. |
| 2.5 | Use the same `types/api.ts` shapes and role names (`STUDENT`, `BOARD_MEMBER`, `SUPERADMIN`) | One contract with Ahmed instead of two |
| 2.6 | When board members create events in the dashboard, require **category**, start/end and a flyer within the size limit | The student site needs them (§1.2, §1.6). |
| 2.7 | Rename "CampusPulse" to **Campus Hub** in the shared login | One product name |

---

## 3. Hamza (infrastructure: Docker, nginx)

| # | Need | Why |
| --- | --- | --- |
| 3.1 | Keep your Docker changes on `Hamza` until Ahmed's backend is merged, then apply them together | The new `Dockerfile` runs `backend.asgi`, which only exists with Ahmed's code. |
| 3.2 | **nginx: send `/api/auth/` to the frontend**, before the `/api/` → Django rule. **Done on `Mouad` (2026-11-19, Step 5.2)**: keep this `location` block when you merge your nginx changes. | Auth.js (the 42 login) lives at `/api/auth/*` in Next.js. nginx sent all of `/api/` to Django, so login broke. |
| 3.3 | Keep the `frontend` service, `docker-compose.dev.yml` and the `make dev / lint / typecheck / clear-images` targets when you change compose or the Makefile | The frontend's live reload depends on them. |
| 3.4 | Frontend container env vars: `AUTH_SECRET`, `AUTH_URL` (public address, e.g. `https://campusplus.ma`), `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET`, `AUTH_TRUST_HOST=true`, `BACKEND_URL=http://web:8000`, `BACKEND_INTERNAL_KEY` (same value as Django's), `AUTH_DEV_LOGIN` (**never `true` on a shared server**). **Wired on `Mouad` (2026-11-19)** in `docker-compose.yml` → keep the `environment:` block; values in the root `.env`. | Phase 5 login (DOCS §7.5). Without `AUTH_URL` the 42 callback URL gets the container port `:3000`. |
| 3.5 | `/media/` served by nginx from the `media_data` volume, with long cache headers | Uploaded flyers and logos (§1.6) |
| 3.6 | The root `.env.example` (rule 0.3) | New teammates can start the stack |
| 3.7 | If the dashboard gets a subdomain (§2.3): an nginx `server` block and certificate for it | |

---

## 4. Decisions the team has to make together

| Question | Options | Frontend's suggestion |
| --- | --- | --- |
| Who can see who's going to an event? | ~~Everyone / signed-in students / nobody but the count~~ | **Decided 2026-11-20: signed-in students only.** Signed-out visitors see the count. Enforced by the API (Ahmed, §1.1) and written in the Privacy Policy (DOCS §9) |
| ~~EMINES~~ students without a 42 account (1337 only since §1d) | ~~Email sign-up / campus SSO / 42 only~~ | **Decided by the subject (§5): email + password sign-up and login are mandatory for everyone.** 42 stays as the OAuth module |
| Dashboard location | `/dashboard` on the same domain / `admin.` subdomain | Subdomain (no cookie clash, clean nginx) |
| When to merge | Now / after the dashboard endpoints | **Decided 2026-11-21 (Mouad): after Ayoub's dashboard endpoints are integrated and Ahmed OKs the endpoints.** Dates still to set (§1c, E1) |
| Event categories | The 7 above / editable list in the DB | Fixed list for now |
| Languages | English + Arabic (RTL) / + French | English + Arabic + **French**: the "multiple languages" module needs 3 (§5) |

---

## 5. Subject check (ft_transcendence v21.2, read 2026-11-20)

Mouad compared every branch with the subject (`en.subject.pdf`, v21.2). **Any mandatory item missing = project rejected, whatever the module points.** We need **14 points** of modules; extra validated modules count as bonus (max +5).

### 5.1 Mandatory part

| Requirement | Status | Owner |
| --- | --- | --- |
| Frontend + backend + database | ⚠️ All exist, but on separate branches; `master` has only a README; the student site and the dashboard still use mock data | all (merge, Phase 7) |
| **Email + password sign-up and login, hashed + salted passwords** | 🟡 **Frontend done (2026-11-21, DOCS §11):** email form on `/auth/login`, `/auth/register` page. Waiting for Django `/api/auth/login/` + unique-email `/api/signup/` on `master` (§1b.3) | Ayoub (`accounts`) + Mouad (`/auth/register`, email form on `/auth/login`) |
| **Privacy Policy + Terms of Service pages**, real content, linked from the footer | ✅ **Live on `Mouad` (2026-11-20):** `/privacy`, `/terms`, footer links on every page. Contact `campushub.1337.team@gmail.com` (everyone: read it). **Team: read both texts once** | Mouad (DOCS §9) |
| Forms validated in frontend **and** backend | ⚠️ Not yet (sign-up, login, RSVP, dashboard event forms) | everyone on their forms |
| Multi-user: many users at once, no conflicts, real-time across users | ❌ Not demonstrable while data is mocked and RSVP has no API | Ahmed (RSVP, Rsvp model exists), Mouad (Phase 6–7) |
| HTTPS for every browser/API connection | ✅ nginx 443 (self-signed), HTTP 301 → HTTPS | Hamza |
| One-command start with Docker | ✅ `make up` (per branch); must still work after the merge | Hamza |
| `.env` git-ignored + `.env.example` | ✅ (root, `Mouad` and `Ahmed` branches: merge into one) | all |
| Clear DB schema with relations | ⚠️ Models exist (`Department`, `Club`, `ClubEvent`, `UserMember`, `Rsvp`); `accounts.User` not built; schema must be in the README | Ahmed + Ayoub |
| Tailwind / styling, responsive, accessible | ✅ | Mouad, Ayoub |
| No JS warnings/errors in the Chrome console | ⚠️ Not checked yet on every page | everyone |
| Git: commits from **all** members, clear messages, fair split | ⚠️ Ayoub has 4 commits; Mouad's commits use 5 identities (38 as "MAcbook Air M4"): set `git config user.name/email` and add a `.mailmap` | all |
| Roles PO / PM / Tech Lead / Developers, documented in README | ❌ Not assigned on paper | team |
| Root README: italic first line with logins, Description, Instructions, Resources + AI use, Team, Project Management, Tech Stack, DB Schema, Features (who did what), Modules (points + who), Individual Contributions | ❌ Root README is the backend's README | team (each writes their part) |

### 5.2 Modules (project type: "Event Management Platform", subject §V.3)

| Module | Pts | Status |
| --- | --- | --- |
| Web Major: frameworks front + back (Next.js + Django) | 2 | ✅ (once the site talks to Django) |
| Web Minor: ORM (Django ORM) | 1 | ✅ |
| Web Minor: SSR (Next.js Server Components) | 1 | ✅ |
| Web Minor: custom design system (≥10 components, palette, typography, icons) | 1 | ✅ 13 `ui/` components + tokens + `navIcons` (needs a showcase page) |
| User Mgmt Minor: OAuth 2.0 (42) | 1 | ⚠️ frontend done; 42 keys + `/auth/sync` missing |
| Web Major: real-time WebSockets | 2 | ⚠️ backend done (Ahmed); frontend Phase 6 |
| Web Minor: notification system (all create/update/delete) | 1 | ⚠️ popover UI done; needs WebSockets + backend |
| Web Minor: advanced search (filters, sorting, **pagination**) | 1 | ⚠️ filters + ⌘K on mocks; sorting/pagination missing |
| User Mgmt Major: advanced permissions (user CRUD, roles, views per role) | 2 | ⚠️ Ayoub: roles defined, superadmin user CRUD needed |
| User Mgmt Major: organization system (clubs: create/edit/delete, add/remove members) | 2 | ⚠️ Ayoub dashboard (mock data) + Ahmed |
| Web Minor: file upload & management (types, validation, preview, progress, delete) | 1 | ⚠️ flyers/logos/avatars, nothing built |
| A11y Minor: RTL (Arabic) | 1 | ✅ **Student site done (2026-11-22, DOCS §12):** `dir="rtl"` in Arabic, every layout uses logical sides, mirrored drawer, icons and arrow keys. ⚠️ Ayoub's dashboard is a separate app: if evaluators open it, it has no RTL yet |
| A11y Minor: ≥3 languages + switcher | 1 | ✅ **Student site done (2026-11-22, DOCS §12):** English, French, Arabic, switcher in the navbar and phone menu, choice kept in a cookie, every page and message translated (274 messages × 3), dates in each language. ⚠️ Same dashboard caveat: decide whether the dashboard needs languages too, or whether we present the module on the student site only |
| Web Major: public API (API key, rate limiting, docs, GET/POST/PUT/DELETE) | 2 | ⚠️ Swagger docs exist; no API key, no throttling |
| A11y Major: WCAG 2.1 AA | 2 | Possible (student site built with ARIA), risky: whole app incl. dashboard must pass |

**Count:** ✅ demonstrable today ≈ **5** · with the ⚠️ items in progress finished ≈ **15** · + RTL and 3 languages ≈ **17** · + public API ≈ **19**. Target: 14 for sure + 2–3 extra as a safety margin (modules that fail the demo count 0).

**Not for us:** game-dependent modules, chat/friends ("User interaction" major, "Standard user management" major both require friends).

