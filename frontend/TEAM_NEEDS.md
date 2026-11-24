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

## 1f. Merge checklist: everything into `Developer` (Mouad, 2026-11-22)

**Decision:** the team merges into Hamza's **`Developer`** branch (it has the CI pipeline, `.github/workflows/ci.yml`), not into `Ahmed`. Order: backend (Ahmed + Ayoub, today on `Ahmed`), then the student site (`Mouad`), then the dashboard. Each item says who and what. Tick them off here.

**Student site (`Mouad`): no code change is needed.** Every page, RSVP, search and live updates read Django as soon as `BACKEND_URL` is set (DOCS §14–15, tested against branch `Ahmed` at `e04d4a3`). What the merge needs on the frontend side is configuration, listed below (M1–M4).

| # | Who | What | Why |
|---|---|---|---|
| M1 | Mouad + Hamza | **Frontend environment in `Developer`'s `docker-compose.yml`** (today the `frontend` service has none): `BACKEND_URL=http://web:8000`, `BACKEND_INTERNAL_KEY` (same value as Django's), `AUTH_SECRET` (random, ≥ 32 bytes), `AUTH_URL=https://<host>`, `AUTH_42_SCHOOL_ID` / `AUTH_42_SCHOOL_SECRET` (Ayoub's 42 app), and `AUTH_DEV_LOGIN` unset. Values in `.env` (git-ignored), names in `.env.example` | Without `BACKEND_URL` the site can't reach Django; without `AUTH_SECRET` nobody can log in; without the same internal key, 42 login fails |
| M2 | Mouad (+ Hamza: take the files as they are) | ✅ **Done (Mouad, 2026-11-23, DOCS §19):** `frontend/Dockerfile` is multi-stage. `make up` builds the **production** image (`next build`, standalone server, non-root user, healthcheck, 346 MB instead of 1.16 GB); `make dev` uses its `dev` stage (`next dev`, source mounted, `docker-compose.dev.yml`, image `transcendence-frontend-dev`). `make lint` / `make typecheck` now run in a throwaway dev container, so they work in both modes; new `make build-check`. **Hamza:** when merging, keep `Mouad`'s `frontend/Dockerfile`, `frontend/.dockerignore`, `docker-compose.dev.yml` and the Makefile targets | The evaluation runs `make up`: it must not be the dev server (slow, verbose, dev tools inside) |
| M3 | Mouad | ✅ **Done (2026-11-23, DOCS §19):** production image run against Ahmed's Django (`236494f`) through nginx/HTTPS. Every page 200 in 12–120 ms; `/test` and unknown pages 404; `/profile` signed out → login; email login, `/profile`, RSVP on/off, realtime cookie (`ws_access`: `Path=/ws/; Secure; HttpOnly; SameSite=strict`), notifications and search actions all work; Django stopped → error page, `/privacy` still up, frontend stays healthy; static assets cached 1 year; image resizing works; dev login off in production | Proof that `make up` gives a working site |
| M4 | Everyone | **Git conflicts in `frontend/`:** `Developer` (and `Ahmed`) still contain the October placeholder `frontend/` folder. **Keep `Mouad`'s version of every file in `frontend/`** | The placeholder is the old Next.js starter (BE7) |
| M5 | Hamza | **nginx in `Developer`:** `/api/auth/` → frontend (Auth.js login, must come before `/api/`), `/api/` → Django, `/ws/` → Django with the `Upgrade` / `Connection` headers, `/media/` → Django's media files, `/` → frontend. `Mouad`'s `infrastructure/nginx/nginx.conf` already does this | Login, API, live updates and images each go to the right service |
| M6 | Hamza | **Pipeline:** `ci.yml` only runs Django's tests (`infrastructure/app`, which is the old backend; after the merge the backend lives at the repo root). Point it at the merged backend, and optionally add a frontend job: `npm ci`, `npx tsc --noEmit`, `npm run build` (lint has 6 known findings, DOCS lint table L.1–L.4) | A green pipeline should mean the merged project builds |
| M7 | Ahmed + Hamza | **BE4, images:** serve `/media/` through nginx and build image URLs from a public base. Otherwise every flyer and logo is a broken image | The most visible gap; untested so far (the test data has no images) |
| M8 | Ahmed + Hamza | **Django for the real run:** `DEBUG=false`, real host in `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_HTTPS_ENABLED=true`, `WS_AUTH_BACKEND=jwt`, real `DJANGO_SECRET_KEY` / `POSTGRES_PASSWORD`, 42 campus allow-list = 1337 campuses (BE3) | Production settings; the allow-list enforces "1337 only" (§1d) |
| M9 | Ahmed + Ayoub | Real data instead of the seed: departments (1337 only), clubs with slugs (BE5), events created from the dashboard | The student site shows whatever Django has |
| M10 | Everyone, after the merge | **End-to-end pass** on the merged stack (`make up`): sign up, email login, 42 login, RSVP / cancel / full, a board member creates → edits → cancels → deletes an event while a student watches the feed (live), logout, French and Arabic | One run of the real flows before the evaluation |
| M11 | Hamza | **nginx `Connection` header:** `location /` sends `proxy_set_header Connection "upgrade"` on **every** request, so connections from browsers stay open to the frontend (measured: `docker stop` of the frontend waits the full 10 s; 0.14 s with nginx stopped). Use the standard map so only WebSocket requests upgrade: `map $http_upgrade $connection_upgrade { default upgrade; '' close; }` in `http {}`, then `proxy_set_header Connection $connection_upgrade;` in `location /` and `/ws/` | Restarts and deploys of the frontend take 10 s instead of instant; open connections also tie up workers |

Still open but **not blocking the merge**: BE1 (club contact), BE2 (`/api/me/rsvps/`), BE9 (doc fix), BE10 (notifications in FR/AR), BE11 (club members). BE8 is answered.

## 1h. Profile page: what the backend must add (Mouad, 2026-11-23)

The student profile (`/profile`) still has two "Soon" placeholders: **Edit profile** and **Change photo**. **Decision (Mouad, 2026-11-23): the profile shows neither the student's club nor their campus.** The "Clubs" stat and the campus chip were removed (DOCS §21.1), so no club-membership work is requested for the profile. Checked against `feat/ahmed-final-requirements` (`792ac56`):

| Placeholder | Backend today |
|---|---|
| Edit profile | `PATCH /api/me/` changes the **phone only**, and accepts any text up to 30 characters |
| Change photo | **No endpoint.** `avatar_url` is only the 42 link, rewritten at every 42 login |

The frontend builds each part as soon as its endpoint exists (Edit profile starts now, against what's already there). Please answer under each row or in the team chat.

| # | Who | What we need (contract) | Why |
|---|---|---|---|
| BE12 | Ayoub | **Validate the phone on `PATCH /api/me/`.** Accept Moroccan numbers, `+2126XXXXXXXX` / `+2127XXXXXXXX` or `06…` / `07…` (10 digits), spaces allowed; store them normalized as `+212XXXXXXXXX`; `""` clears the number. Invalid → **400** `{"phone": ["Enter a valid Moroccan mobile number."]}` (DRF field-error shape) | Subject (mandatory): every form is validated in the frontend **and** the backend. Today `"abc"` is saved as a phone number. The student site applies the same rule in the browser |
| BE13 | — | ~~Student club join requests (see / cancel)~~ **Dropped:** the profile doesn't show clubs (decision above) | — |
| BE14 | — | ~~Leave a club~~ **Dropped** (same decision) | — |
| BE15 | — | ~~Notify join decisions~~ **Dropped** (same decision) | — |
| BE16 | Ayoub (+ Ahmed for media) | **Profile photo upload (file upload module, 1 pt):** `POST /api/me/avatar/` multipart field `file`. Accept JPEG, PNG and WebP only, **≤ 2 MB**. **Check the real content** (Pillow `verify()`, not just the extension or `Content-Type`), resize to ≤ 512 × 512, strip metadata (EXIF can contain GPS), store under `/media/avatars/`, set `avatar_url` to the public media URL (`DJANGO_PUBLIC_MEDIA_BASE_URL`), return the user (`UserSerializer`). Errors **400** `{"file": ["…"]}`, too big **413**. `DELETE /api/me/avatar/` removes the file and falls back to the 42 picture (or `""`), returns the user. Allow 2 MB through nginx (`client_max_body_size 10m` already covers it) | The module asks for type and size validation, preview, progress and delete. The frontend does the browser side (picker, checks, preview, progress bar, delete); the server **must** re-check, or anyone can upload anything with a renamed file |
| BE17 | Ayoub | **Don't overwrite an uploaded photo on 42 login:** `/auth/sync` sets `user.avatar_url = imageUrl` at **every** login (accounts/views.py). Keep a flag (`avatar_is_custom`) or a separate `uploaded_avatar` field, and only copy the 42 picture when the student has none of their own | Otherwise a student's uploaded photo disappears the next time they log in with 42 |
| BE18 | Ayoub | *(Optional)* **Edit the name for email accounts:** `PATCH /api/me/` with `first_name` / `last_name` (1–150 characters, letters, spaces, `-` and `'`), refused (**403**) for 42 accounts, whose name comes from 42 | Students who signed up with email and made a typo can't fix their name today |

| BE19 | Ayoub | **Run Django's password validators on `POST /api/signup/`:** call `django.contrib.auth.password_validation.validate_password(password, user)` (common passwords, only digits, too similar to the name or email, minimum length), and return the messages as a 400 field error `{"password": ["…", "…"]}`. **Tested 2026-11-23:** `"password": "12345678"` → **201, account created** | Mandatory item: forms validated on both sides. The student site already refuses only-digit passwords and passwords containing the name or email, but anyone calling Django directly gets a weak password through |
| BE20 | Ayoub | **Stop accepting `club_id` at sign-up:** remove it from `SignupSerializer` entirely (decision §1i: students have no club relation). **Tested 2026-11-23:** sign-up with `"club_id": 1` → 201 and the new account is **immediately a member of LEET Dev**, with no board approval | Anyone can join any club by adding one field to the sign-up request, bypassing the join-request flow. The student site no longer sends it (decision: no club at sign-up, DOCS §23) |

**What the student site does meanwhile:**
- Edit profile (phone, browser-side validation with the BE12 rule) is built now.
- The profile reads `/api/me/` on the server, so a change shows at once (the login cookie keeps the values from login time).
- The photo upload is built behind a `hasAvatarUpload` switch and turned on when BE16 is merged.

## 1i. Sign-up for 1337 students only, with email verification (Mouad, 2026-11-24, owner Ayoub)

**Decisions (Mouad, 2026-11-24):**
1. **Students have no relation to clubs.** They see events and clubs, RSVP to events, and that's all: no joining, no membership, no club at sign-up. Club membership exists only for board members, managed in the dashboard. (The student site already has no join button; BE13–BE15 were dropped; BE20 removes the last way in.)
2. **Only 1337 students can have an account**, and there are two ways in, both ending in the same kind of account:
   - **"Continue with 42"**: one click, nothing to fill in. 42 proves who the student is and their campus (`ALLOWED_42_CAMPUSES` = the 1337 campuses, BE3).
   - **Email sign-up** (mandatory in the subject): only addresses ending in **`@student.1337.ma`**, and the address must be **verified** with a **6-digit code** sent to it before the account can be used (Mouad, 2026-11-24: a code, not a link; the student types it on the sign-up page).

**Why verification and not just a domain check:** anyone can type `someone.else@student.1337.ma`. Without proof that the person owns the mailbox, they could create an account in another student's name. Worse, today that also **locks the real student out**: their 42 login then gets `409 "This email is already linked to another account"` (`accounts/views.py`, 42 sync).

**What Django does today (checked on `Ahmed` `6a0ca1f`):** `POST /api/signup/` accepts any email domain, saves the account and returns a login token at once (no verification). No email sending is configured.

### Requests

| # | Who | What we need (contract) | Why |
|---|---|---|---|
| BE21 | Ayoub | **Only `@student.1337.ma` on `POST /api/signup/`.** In `SignupSerializer.validate_email`, after `strip().lower()`: the part after the last `@` must be **exactly** `student.1337.ma` (not "ends with": `x@evil-student.1337.ma` must fail). Otherwise **400** `{"email": ["Use your 1337 student email (…@student.1337.ma)."]}` | Only 1337 students; checked in Django because anyone can call the API directly. The student site checks the same rule in the browser |
| BE22 | Ayoub | **Sign-up doesn't log in any more; it sends a 6-digit verification code.** Add `email_verified` (bool, default `False`) to `User` (not `is_active`: that already means "account disabled", and the 42 login treats it so). `POST /api/signup/` creates the account with `email_verified=False`, sends the code by email (BE26) and returns **201** `{"detail": "verification-sent", "email": "<address>"}`, **no token**. The code: 6 digits from `secrets.randbelow(10**6)` (zero-padded), stored **hashed** (`make_password`, never in clear) with its expiry (**15 minutes**) and an attempts counter, e.g. an `EmailVerification(user, code_hash, expires_at, attempts)` model. New endpoint `POST /api/signup/verify/` `{"email", "code"}` → right code → `email_verified=True`, the code is deleted, **200** `{"token", "member"}` exactly like today's sign-up response (the student is logged in). Wrong code → **400** `{"code": ["Wrong code."]}` and `attempts + 1`; expired, no pending code, or **5 wrong attempts** (the code is then deleted) → **400** `{"detail": "code-expired"}` (the student asks for a new one, BE23). Unknown email → the same 400 as a wrong code (doesn't reveal accounts) | Proves the student owns the mailbox. A 6-digit code with 5 attempts can't be guessed (5 in a million); the student stays on the same page and types it |
| BE23 | Ayoub | **Send a new code:** `POST /api/signup/resend/` `{"email"}` → **always 200** `{"detail": "verification-sent"}`, whether or not an unverified account exists (don't reveal who has an account). A new code replaces the old one (new expiry, attempts back to 0). Throttle per email and per IP (e.g. 1 per minute, 5 per day; DRF `ScopedRateThrottle`) → **429** | Lost or expired codes, without becoming a way to spam a mailbox or list accounts |
| BE24 | Ayoub | **Login of an unverified account:** `POST /api/auth/login/` with the **right** password but `email_verified=False` → **403** `{"detail": "email-not-verified"}`. Wrong password → the usual 401 (so this answer never reveals anything to someone without the password) | The student site then shows the code field again ("Enter the code we sent you", with "Send a new code", BE23) |
| BE25 | Ayoub | **42 login with an address that already has an email account** (42 sync in `accounts/views.py`, today always 409): **verified** email account → **link it**: set `forty_two_id`, `campus`, `avatar_url` on that account and keep its password, so both ways log into the same account. **Unverified** email account → it was never proven, so **delete it** and create the 42 account as usual. Accounts created by 42 get `email_verified=True`. Keep 409 only for the real conflict (a *different* `forty_two_id` already owns the address) | The real student must never be locked out by someone who typed their address; one student = one account whichever way they come in |
| BE26 | Ayoub + Hamza | **Sending email.** In settings, from the environment: `EMAIL_BACKEND` (dev: `django.core.mail.backends.console.EmailBackend`, prints the email in `docker compose logs backend`; real run: SMTP), `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=true`, `EMAIL_HOST_USER=campushub.1337.team@gmail.com`, `EMAIL_HOST_PASSWORD` (a Gmail **app password**, never the account password, only in `.env`), `DEFAULT_FROM_EMAIL="Campus Hub <campushub.1337.team@gmail.com>"`. **Hamza:** add the names to `.env.example` with empty values. Email: plain text + simple HTML, subject "Your Campus Hub verification code", the code in large digits, "valid 15 minutes", "If you didn't sign up, ignore this email". `FRONTEND_URL` isn't needed (no link) | Without it nothing can be sent. The console backend lets everyone test without a real mailbox |
| BE27 | Ayoub | *(Optional)* **Clean up:** a management command that deletes accounts still unverified after 7 days (`python manage.py purge_unverified`), run at start or by hand | Abandoned sign-ups don't keep an address taken |

**Tests Ayoub should add:** other domain → 400; `x@evil-student.1337.ma` → 400; sign-up → 201 without token and one email in `mail.outbox` containing a 6-digit code; the code is not stored in clear; verify with the right code → 200 + token; the same code twice → 400; wrong code → 400 `code`; 5 wrong codes then the right one → 400 `code-expired`; code after 15 minutes → 400 `code-expired`; resend → the old code stops working; login before verifying → 403 `email-not-verified`, wrong password → 401; resend for an unknown email → 200 and nothing sent; 42 login over a verified email account → same user, linked; over an unverified one → that account deleted, 42 account created.

**What the student site does (Mouad):**
- Now (no backend needed): the sign-up form accepts only `@student.1337.ma` (browser and server action, same rule as BE21), with the hint "Use your 1337 student email".
- Done now: the sign-up page offers both ways: "Continue with 42 Intra" (optional, works once the 42 keys are in `.env`), then "or sign up with email" and the form. Intro: "Continue with your 42 account, or sign up with your 1337 student email: we'll send you a verification code."
- When BE22–BE24 are merged: after sign-up, the same page shows a 6-digit code field ("We sent a code to …", "Send a new code"); the right code logs the student in. The login form shows the code field too for an unverified account.
- The privacy policy will say we send verification codes to that address.

## 1g. Review of `Developer` (Hamza) and Ahmed's BE11 answer (Mouad, 2026-11-23)

### Re-check (Mouad, 2026-11-24)

- **Ahmed ✅:** `feat/ahmed-final-requirements` (PR #6) and `feat/ahmed-test-isolation` (PR #8, tests no longer depend on `.env.example` or `DJANGO_PUBLIC_MEDIA_BASE_URL`) are merged into `Ahmed` (`6a0ca1f`).
- **Hamza:** the fixes are split over two branches. `Developer` (`f50dd10`) has H1 and H8. `codex/infra-config-fixes` (`d741964`, **not merged into `Developer` yet**) adds H2, H3 and H5. Checked on that branch: `docker compose config` valid, `nginx -t` OK.

| # | Status |
|---|---|
| H1 Dockerfile `backend.asgi` | ✅ |
| H2 `.env.example` complete (`AUTH_*`, `BACKEND_URL`, `BACKEND_INTERNAL_KEY`, media, CSRF, HTTPS; `NEXT_PUBLIC_API_URL` removed) | ✅ on `codex/infra-config-fixes` |
| H3 placeholder secret + generate command, `DEBUG=false`, `DJANGO_HTTPS_ENABLED=true` | ✅ on `codex/infra-config-fixes` |
| H4 Grafana dashboard | ❌ `campus-hub.json` still 0 bytes; images still `:latest` |
| H5 rate limit on `/api/auth/callback/` (5 r/min, burst 5) | ✅ on `codex/infra-config-fixes` (a leftover `/api/v1/public/` block is harmless) |
| H6 | note only, nothing to do |
| H7 dashboard in compose | ❌ not yet (needs Ayoub's AY1 answer) |
| H8 Makefile `dev`, `lint`, `typecheck`, `build-check` | ✅ (`docker-compose.dev.yml` comes from `Mouad` at the merge) |
| H9 per-IP limit | open, not blocking |

**Hamza: merge `codex/infra-config-fixes` into `Developer`, then do H4.** `Developer` has no `frontend/` or backend code: they come in from `Mouad` and `Ahmed` at the merge (M4).

- **Ayoub:** no new push since 2026-11-23 00:54 (`Ayoub` `54c28b4`, `Ayoub-backend` `e05d94b`). The 42 keys are secrets, so they never appear in git: he sends `AUTH_42_SCHOOL_ID` / `AUTH_42_SCHOOL_SECRET` privately for `.env`, with the redirect URI `https://localhost/api/auth/callback/42-school` registered in the 42 app. Still not in `Ahmed`: BE12 (phone accepts any text), BE16/BE17 (photo upload), BE19 (no `validate_password` on sign-up), BE20 (`SignupSerializer` still takes `club_id`).

### Re-check, evening (Mouad, 2026-11-24 18:15)

- **Hamza ✅:** `Developer` is now at `43580e5`, so `codex/infra-config-fixes` is merged and that branch is deleted. Checked: `docker compose config` valid (with `.env.example` copied to `.env`), `nginx -t` OK.
  - **H2, H3, H5 are in `Developer`.** `.env.example` also has the BE26 email settings (`EMAIL_*`, console backend by default).
  - **H4 done:** `grafana/dashboards/campus-hub.json` is provisioned from `/var/lib/grafana/dashboards`. It has 6 panels: targets up, host CPU, memory, disk, container CPU, container memory. The images are pinned: Prometheus `v2.55.1`, Grafana `11.3.0`, node-exporter `v1.8.2`, cAdvisor `v0.49.1`.
  - **Optional for the demo:** a panel for HTTP requests or errors. Today Prometheus scrapes only itself, node-exporter and cAdvisor; nginx and Django don't expose metrics.
  - **Still open:** H7 (dashboard not in compose, needs AY1) and H9 (not blocking).
- **Ayoub:** still no push since 2026-11-23 00:54.
  - **Dashboard (`dashboard_campus`), read only:** pages `admin`, `admin/events`, `admin/members`, `admin/registrations`, `admin/announcements` and `super_admin`. They read Django (`/api/board/*`, `/api/superadmin/*`) but **never write**: no create, edit or delete of users, roles, clubs or members.
  - **Backend (in `Ahmed`):** `/api/superadmin/users/` and `/organizations/` are GET + PATCH only, with no create or delete.
  - **So:** both User Mgmt majors (permissions, organization) need the CRUD screens and endpoints.
  - **Remove:** `api/clubs/<slug>/join/` (`dashboard/urls.py`) goes against the 2026-11-24 decision that students have no club relation.
  - **Still missing:** the 42 keys (private, for `.env`), BE12, BE16/BE17 (photo upload), BE19, BE20 and BE21–BE27 (1337 sign-up with code).

### Ayoub's push of 2026-11-24 evening (Mouad, 21:30)

`Ayoub-backend` `1777905` ("42 files done") and `Ayoub` `de79aff` (dashboard). Read from the diff; his tests were not run here.

**Backend (`Ayoub-backend`)**
| Request | Status |
|---|---|
| BE12 phone validation | ✅ Moroccan mobile only (`+2126/7…` or `06/07…`), spaces removed, stored as `+212…`, `""` clears it; `phone` now in `UserSerializer` |
| BE16 photo upload | ✅ `POST /api/me/avatar/` (multipart `file`): ≤ 2 MB, JPEG/PNG/WebP checked by content (Pillow), EXIF rotation applied then metadata stripped, resized to ≤ 512 px, random file name, `avatar_url` = public media URL. `DELETE` removes it. Differences from the request: too big → **400** (not 413), `DELETE` sets `avatar_url` to `""` instead of going back to the 42 photo. Both fine for the frontend |
| BE17 keep an uploaded photo at 42 login | ❌ `/auth/sync` still sets `avatar_url = imageUrl` at **every** 42 login (`accounts/views.py` ~line 176), so a 42 student's uploaded photo is replaced at their next login |
| 1337 only for 42 | ✅ `ALLOWED_42_CAMPUSES` defaults to `Benguerir,Khouribga,Tetouan,Rabat` (also in compose); names compared case-insensitively, a leading "1337 " ignored. **An empty list now refuses every campus** (was: allow all) |
| New: `GET`/`PATCH /api/board/club/` | ✅ the board member's own club settings (name, description, contact email, meeting day/time/location), audit-logged |
| BE19 password validators at sign-up | ❌ |
| BE20 remove `club_id` from sign-up | ❌ still in `SignupSerializer` |
| BE21–BE27 1337 sign-up with a 6-digit code | ❌ nothing yet |
| `api/clubs/<slug>/join/` | ❌ still there (students have no club relation) |
| Superadmin users / organizations | ❌ still `GET` list + `PATCH` detail only. **No `POST` (create) or `DELETE`** |

**Dashboard (`Ayoub`)**: big step. New super-admin pages `users`, `organizations`, `approvals`, `analytics`, `audit-logs`, `settings`; board pages `events` (create/edit/delete through `EventsManager`) and `settings` (profile, phone, photo upload, club settings). Calls go through a server proxy `app/api/backend/[...path]`. Mock data files removed.
- **Mismatch:** `SuperAdminResourceManager` sends `POST` and `DELETE` to `api/superadmin/users/` and `api/superadmin/organizations/`, which Django doesn't have yet → those buttons fail with **405**. Ayoub: add create + delete for users and organizations, and add/remove board members of a club. This is what the permissions and organization majors (4 pts) need.

**Merge state:** `Ayoub-backend` is **17 commits behind `Ahmed`**, and merging it into `Ahmed` conflicts in `accounts/views.py`, `accounts/tests.py`, `dashboard/views.py` and `dashboard/serializers.py`. **Ayoub + Ahmed:** merge `Ahmed` into `Ayoub-backend` (or open a PR into `Ahmed`), solve the 4 conflicts, run the whole test suite. Until then the student site's test stack (Ahmed's backend) has no `/api/me/avatar/`, so "Change photo" waits.

### Photo upload tested against `Ayoub-backend` (Mouad, 2026-11-24 22:00)

Ayoub's branch runs locally as `ayoub-web`. His `POST`/`DELETE /api/me/avatar/` passes 12/12 direct checks, and the student site's "Change photo" passes 15/15 end to end (DOCS §26). Found:

| # | Who | Request |
|---|---|---|
| BE28 | Ayoub | **Delete the old file when a photo is replaced.** `me_avatar` sets `member.image_path = normalized_image` without deleting the previous file. After 3 uploads, 3 files stay in `media/avatars/`. Call `member.image_path.delete(save=False)` before assigning the new one |
| BE17 | Ayoub | **Confirmed by Mouad in the browser (2026-11-24):** upload a photo, log out, log in with 42 → the 42 picture is back. The uploaded file is still in `media/avatars/`, but `/auth/sync` (`accounts/views.py`, the `else:` branch for an existing user) runs `user.avatar_url = identity.get("imageUrl") or ""` at every login. Fix: only take 42's picture when no photo was uploaded: `has_upload = UserMember.objects.filter(user=user).exclude(image_path="").exists()` then `if not has_upload: user.avatar_url = identity.get("imageUrl") or ""`. Add a test: upload, sync again, `avatar_url` unchanged |
| BE30 | — | ~~Password for 42 accounts~~ **Decided by Mouad (2026-11-24): 42 accounts log in with 42 only.** `/auth/sync` keeps `set_unusable_password()`; nothing to do. The login page's wrong-password message says "If you joined with 42, your account has no password: use 'Continue with 42 Intra'" |
| BE29 | Ayoub + Ahmed | **Merge `Ayoub-backend` into `Ahmed`** (4 conflicts, see above). Until then the real stack has no `/api/me/avatar/`. Note: `Ayoub-backend` still returns `GET /api/club-events/` as a bare array; `Ahmed`'s paginated shape is the contract |
| H10 | Hamza | Keep `client_max_body_size 10m` in `Developer`'s nginx (it's there). Without it nginx refuses photos over 1 MB before the app sees them |

### Merge into `Developer`: dry run (Mouad, 2026-11-24 23:45)

`git merge-tree` of each branch into `Developer` (`43580e5`). Nothing is merged yet.

| Order | Merge | Conflicts | How to resolve |
|---|---|---|---|
| 1 | `Ayoub-backend` → `Ahmed` (BE29) | 6 blocks in 4 files | See the BE29 guide below. **New (21:55):** Ayoub's "merging" commit `8ad51cc` doesn't merge `Ahmed`; it **removes** his 1337 campus default (`ALLOWED_42_CAMPUSES`), so an empty value allows every 42 campus again. Put it back, or set `ALLOWED_42_CAMPUSES=Benguerir,Khouribga,Tetouan,Rabat` in `.env.example` and compose |
| 2 | `Ahmed` → `Developer` | 11 files | `Dockerfile`, `docker-compose.yml`, `.env.example`, `.vscode/settings.json`: keep **Developer's** (Hamza already took Ahmed's fixes, H1–H3), then add any Ahmed variable that's missing. `requirements.txt`, `.gitignore`: **union** of both. `README.md`: keep one, rewritten at the end. **`frontend/` in `Ahmed`** is an old copy (57 files from 2026-11-04): Ahmed should `git rm -r frontend` before merging. Otherwise it collides with the real one from `Mouad` (4 conflicts already) |
| 3 | `Mouad` → `Developer` | 76 files | **71 are modify/delete:** Hamza's "Remove all files" deleted `frontend/` in `Developer`. Keep Mouad's: `git checkout --theirs -- frontend && git add frontend`. 4 content conflicts: `Dockerfile` (root, Django) → Developer's; `docker-compose.yml` → Developer's (it has the `frontend` service with `BACKEND_URL`, `AUTH_*`); `infrastructure/nginx/nginx.conf` → Developer's (it has `/api/auth/callback/` rate limit and `client_max_body_size 10m`); `Makefile` → Developer's + Mouad's `dev`, `lint`, `typecheck`, `build-check` targets (H8). Keep `docker-compose.dev.yml` from Mouad. Mouad deletes the root leftovers first: `package-lock.json` (empty), `infrastructure_documentation copy.md` |
| 4 | `Ayoub` (dashboard) → `Developer` | 0 | Merges cleanly (`dashboard_campus/` only), but **H7**: it's not in `docker-compose.yml`. It uses Auth.js too, so it can't share `/api/auth/` with the student site: run it on its own port (e.g. `https://localhost:8443`) or a subdomain, with its own `AUTH_URL` and 42 redirect URI |

**After the merge, before calling it done:** `cp .env.example .env` + secrets → `make re` on a **fast connection** (it re-downloads everything) → 42 login, email login, RSVP, live update in two browsers, notifications, photo upload, dashboard event shows on the student site, Grafana → then `master`.

### BE29 merge guide: `Ahmed` + `Ayoub-backend` (Mouad, 2026-11-24 22:30)

`git merge-tree origin/Ahmed origin/Ayoub-backend`: **6 conflict blocks in 4 files**. No migration clash: Ayoub adds none, Ahmed adds `core_data` 0007–0012 and `notifications` 0001–0002. In every block **both sides are wanted**:

| File | Conflict | Keep |
|---|---|---|
| `accounts/views.py` (imports) | Ahmed imports `phone_reconciliation`; Ayoub imports `ALLOWED_IMAGE_FORMATS`, `validate_file_size`, `validate_image_content` | Both import lines |
| `accounts/views.py` (before `logout`) | Ahmed added `@extend_schema(...)` (Swagger) on `logout`; Ayoub inserted `me_avatar` at the same place | `me_avatar` first (give it its own `@extend_schema`), then Ahmed's decorator + `logout` |
| `accounts/tests.py` | Ahmed's 5 phone-reconciliation tests vs Ayoub's `test_me_rejects_invalid_phone_and_allows_clearing_it` | All 6 tests |
| `dashboard/views.py` (imports) | `BoardStatsSerializer` vs `BoardClubSettingsSerializer` | Both |
| `dashboard/views.py` (before `board_registrations_weekly`) | Ahmed's `@extend_schema` vs Ayoub's new `board_club_settings` | `board_club_settings` (with an `@extend_schema`), then Ahmed's decorator |
| `dashboard/serializers.py` `get_status` | Ahmed: no linked user → `"active"`, with `-> str`; Ayoub: no linked user → `"inactive"` | **Decide together** what a member row without an account means; keep the `-> str` hint |

**Breaks after the merge even without a text conflict (fix before pushing):**
1. **Phone tests:** Ahmed's `test_me_only_updates_phone` (line 298) saves `"+123456"`; Ayoub's BE12 validation now refuses it (400). Use a Moroccan number (`"+212612345678"`). Also check that the validation runs **before** Ahmed's `classify_phone_pair` in `me`.
2. **Campus list:** Ayoub's `get_campus_allow_list()` now **refuses every campus when the list is empty**, with a default of `Benguerir,Khouribga,Tetouan,Rabat` in settings. Ahmed's sync tests use `"Benguerir"`, so they should pass; any test that syncs a user from another campus (or with no campus) now gets 403. Use a 1337 campus, or `override_settings(ALLOWED_42_CAMPUSES=...)`.
3. **Swagger:** Ahmed documents every view with `@extend_schema`; Ayoub's 2 new views (`me_avatar`, `board_club_settings`) need it too, or `/api/docs/` shows them without schemas.
4. **README:** both edited it; read the merged text once.

**Steps:** Ayoub (or Ahmed), on `Ayoub-backend`: `git merge origin/Ahmed` → solve the 6 blocks as above → fix points 1–3 → `python manage.py makemigrations --check` (must say "No changes") → `python manage.py test` (all green) → push → PR `Ayoub-backend` → `Ahmed`, reviewed by the other one. Then Mouad re-runs the photo tests (DOCS §26.7) on the merged backend.

### 42 keys received (Mouad, 2026-11-24 19:45)

Ayoub sent `env.local.download` privately; the keys are in the root `.env` only, never in git. Checked:

- **Keys valid:** 42's `/oauth/token` (client credentials) answers 200 with scope `public`.
- **Secret renewed (2026-11-24 20:42):** Ayoub sent a new secret, valid until **2026-12-22 20:25 UTC**; the old one is revoked (401). If the evaluation is after Dec 22, renew it again. His new file also has `NEXTAUTH_URL=https://localhost`.
- **Sign-in start works:** the 42 button on `https://localhost` sends the browser to `api.intra.42.fr/oauth/authorize` with the real `client_id`, `redirect_uri=https://localhost/api/auth/callback/42-school`, scope `public` and state/PKCE.
- **Sync works:** the frontend server's `POST /auth/sync` with the shared `BACKEND_INTERNAL_KEY` returns 200 `{token, user}`. A wrong key gets 403. The test user was deleted afterwards.
- **Ayoub's file is for his own dev setup.** Its `NEXTAUTH_URL=http://localhost:3000` and `BACKEND_URL=http://127.0.0.1:8000` don't fit our compose stack. Its `AUTH_SECRET` and `BACKEND_INTERNAL_KEY` are his own values, so we keep ours.
- **Ayoub: register `https://localhost/api/auth/callback/42-school`** in the 42 app's redirect URIs (one per line, next to `http://localhost:3000/...`). **Confirmed 2026-11-24 by a real login from `https://localhost`: 42 answers "The redirect uri included is not valid".** Ayoub must add this URI in the 42 app (Settings → Redirect URI, one per line); the keys don't change.
- **Ayoub (new, from the first real login):** 42's image CDN refuses our requests (403, Cloudflare), so `avatar_url` pointing at `cdn.intra.42.fr` may not display. With BE16–BE17, download the 42 photo once at `/auth/sync` into `/media/` and return that URL (DOCS §25.2).
- **Ayoub + Hamza: set `ALLOWED_42_CAMPUSES`** to the 1337 campuses (it's empty today, so any 42 campus can log in) and add it to `.env.example`.

### Ahmed: `feat/ahmed-final-requirements` at `792ac56`, BE11 answered ✅

- **Decision:** "new event" notifications now go to **every active student and board member**. Staff, superusers and inactive accounts are excluded; club membership no longer matters. Changes, cancellations and deletions still go only to students who RSVP'd.
- **Ran it locally:** 338 of 340 Django tests pass.
  - The 2 errors read `.env.example`, which the Docker image leaves out on purpose.
  - 3 more tests fail only when `DJANGO_PUBLIC_MEDIA_BASE_URL` is set in the environment. **Ahmed:** use `override_settings(PUBLIC_MEDIA_BASE_URL='')` in those tests so they don't depend on the machine.
- **Live check:** a board member created an event and `peer0`, a student in no club, got "New campus event" with `event_title`.
- **Student site:** the bell now says "New campus event" in the 3 languages (DOCS §15.3).
- **Still needed from Ayoub:** reliable 1337-only accounts (`ALLOWED_42_CAMPUSES` and the email sign-up path), because every student account now gets these notifications.
- **To do: merge `feat/ahmed-final-requirements` into `Ahmed`.**

### Hamza: `Developer` at `2957bfa`, good work, mergeable after the fixes below

**Done well** (checked: `docker compose config` valid, `nginx -t` OK):

| Item | Status |
|---|---|
| M1: frontend `environment` block in compose (`BACKEND_URL` defaults to `http://backend:8000`) | ✅ |
| M5: `/api/auth/` → frontend, `/api/` → Django, `/ws/` with upgrade, `/media/`, `/static/`, `/admin/` | ✅ |
| M11: `map $http_upgrade $connection_upgrade` used in `/` and `/ws/` | ✅ |
| M7: `DJANGO_PUBLIC_MEDIA_BASE_URL=https://localhost`, `/media/` served from the volume | ✅ |
| M6: CI runs the root Django tests (`manage.py test`, Python 3.14 like Ahmed) **and** a `frontend_build` job (`docker build ./frontend`) | ✅ |
| Certificates generated by `make` (`certs` target) | ✅ |
| Database and Redis healthchecks; Django waits for them | ✅ |
| Same `requirements.txt` as Ahmed | ✅ |
| Monitoring stack (Prometheus, Grafana behind `/grafana/` with login, node-exporter, cAdvisor, alert rules): the DevOps "monitoring" major module (2 pts) | 🟡 see H4 |

**To fix before or during the merge:**

| # | What | Why |
|---|---|---|
| H1 | **Backend `Dockerfile`: keep Ahmed's version.** `Developer`'s runs `daphne … config.asgi:application`; Ahmed's project is `backend.asgi:application` | With `config.asgi` the backend container crashes at start (module not found) |
| H2 | **`.env.example` is incomplete:** add `AUTH_SECRET`, `AUTH_URL`, `BACKEND_URL`, `BACKEND_INTERNAL_KEY` (same value for frontend and backend), `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET`, `AUTH_DEV_LOGIN=false`, `DJANGO_PUBLIC_MEDIA_BASE_URL`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_HTTPS_ENABLED`. Remove `NEXT_PUBLIC_API_URL` (the frontend doesn't use it) | Whoever creates `.env` from the example (the evaluators!) gets a site where nobody can log in |
| H3 | **Secret key and `DEBUG`:** `.env.example` has `DJANGO_SECRET_KEY=8858859` and `DEBUG=True`. Ahmed's settings **refuse to start** with `DEBUG=false` unless the key is strong (≥ 50 characters, not a template). Put a clear placeholder and the command to generate one, e.g. `python -c "import secrets; print(secrets.token_urlsafe(64))"`, and use `DEBUG=false` with `DJANGO_HTTPS_ENABLED=true` for the real run (M8) | With the example as is, Django either runs in debug mode (shows code and settings on errors) or doesn't start |
| H4 | **Grafana dashboard is empty:** `provisioning/dashboards/campus-hub.json` is 0 bytes, and the provider reads `/var/lib/grafana/dashboards`, mounted from `infrastructure/monitoring/grafana/dashboards/`, a folder that doesn't exist. Put a real dashboard JSON (CPU, memory, containers, requests) in that folder. Also pin image versions instead of `:latest` (Prometheus, Grafana, node-exporter, cAdvisor) | The monitoring module asks for custom dashboards; today Grafana opens empty. `:latest` can change under us before the evaluation |
| H5 | **Rate-limit zones on paths that don't exist:** `/api/v1/auth/login/`, `/api/v1/auth/register/`, `/api/v1/public/…`. Django's are `/api/auth/login/` (Ayoub), `/api/signup/`, `/api/club-events/`… Brute-force protection should be on what browsers really call to log in: `location /api/auth/callback/` (our email login through Auth.js), e.g. `limit_req zone=…login burst=5` | Today no login path is actually rate-limited |
| H6 | **`/api/auth/` collision, keep in mind:** Django also has `/api/auth/login/` and `/api/auth/logout/` (Ayoub). nginx sends all of `/api/auth/` to the frontend. Fine as long as Django is called on its **internal** address (`BACKEND_URL=http://backend:8000`), which is what the student site and Ayoub's dashboard (`dashboard_campus/auth.ts`) do. Never point a `BACKEND_URL` at `https://localhost` | Otherwise the call reaches Next.js and fails |
| H7 | **Ayoub's dashboard is not in the compose file.** Decide where it runs (AY1): its own port or subdomain, or a `basePath`. It also uses Auth.js, so it **can't** share `/api/auth/` with the student site on the same host | `make up` must start the whole project, dashboard included |
| H8 | **Makefile:** keep `Mouad`'s `dev`, `lint`, `typecheck`, `build-check` targets next to Hamza's `certs`, `up`, `down`, `logs`, `clean`, `re` (see DOCS §19) | Developers still need the dev server and the checks |
| H9 | **The 10 r/s limit on `/api/`** is per IP. On campus many students share one public IP (NAT). Fine for the evaluation; raise it or key it differently for real use | Avoids 429 errors for a whole classroom |

**Verdict:** merge into `Developer` is OK. Do H1–H3 and H8 during the merge (otherwise the backend doesn't start, or nobody can log in). H4 is needed for the monitoring module points. H5–H7 and H9 can follow.

## 1e-bis. Ahmed's answers (Mouad, 2026-11-23, branch `feat/ahmed-final-requirements` at `236494f`, not merged into `Ahmed` yet)

Thank you Ahmed: almost every row of §1e is answered.

| # | Answer | Student site |
| --- | --- | --- |
| BE1 | ✅ `president_email` / `president_phone` in `GET /api/clubs/{slug}/` for signed-in users only (`Cache-Control: private, no-store`) | Nothing to change: the mapper already copies them when present |
| BE2 | ✅ `GET /api/club-events/?rsvped=true` (signed in; past and upcoming; `attendees_preview` empty) instead of `/api/me/rsvps/` | `/profile` switches to it (small change, Mouad) |
| BE3 | ✅ Docs say 1337 only. The 42 campus allow-list (`ALLOWED_42_CAMPUSES`) is still Ayoub's | Nothing |
| BE4 | ✅ Django side: `DJANGO_PUBLIC_MEDIA_BASE_URL` builds image URLs from a public origin. **Hamza:** set it to the site's HTTPS origin (`https://localhost` locally, not the `http://localhost:8080` of `.env.example`) and serve `/media/` in nginx (already in `nginx.conf`) | Check images after the merge |
| BE5 | ✅ Migration `core_data.0012` fills missing club slugs and makes them required; new clubs get a slug from their name | Nothing (the "no slug" guard stays, harmless) |
| BE8 | ✅ Stored notifications (PR #5) | Done, DOCS §15.3 |
| BE9 | ✅ Handoff fixed: `rsvps_count` is a real public count in broadcasts; `has_user_rsvpd` always false, `attendees_preview` always empty | Nothing: pages reload RSVP state from Django (DOCS §15.2) |
| BE10 | ✅ `event_title` on notifications (REST and socket), kept after the event is deleted; null on older rows | Nothing: the bell already translates the sentence when `event_title` is there (DOCS §15.3) |
| BE11 | ⏳ Not answered: "new event" notifications still go to club members only | Open question for Ahmed + Ayoub |

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
| BE8 | Ahmed | ~~Notifications: which design?~~ **Answered (2026-11-22, `Ahmed` at `67e9a08`, PR #5): design (b), stored.** `GET /api/notifications/` (20 per page, newest first, `?unread=`), `GET /api/notifications/unread-count/`, `POST /api/notifications/{id}/read/`, `POST /api/notifications/read-all/`, and a private socket `/ws/notifications/` (same `ws_access` cookie, close 4401 on expiry) sending `notification.unread_count` and `notification.created`. Who gets one: club members for a new event, students who RSVP'd for a change, a cancellation or a deletion, and the student themself for RSVP confirmed or cancelled. Thank you! The student site connects the bell to it in DOCS §15.3 | Done |
| BE10 | Ahmed | **Notifications in French and Arabic:** `title` and `message` are written in English by Django (`"Event updated"`, `An event you registered for, "…", changed.`). Please add **`event_title`** (the event's name at the time, kept even after the event is deleted) to the REST result and the `notification.created` data. The student site then writes the title and the sentence itself in the visitor's language from `notification_type` + `event_title`, and shows Django's English text only when `event_title` is missing | Students who chose Français or العربية would otherwise see English sentences in the bell, on a site that is fully translated (DOCS §12) |
| BE11 | Ahmed + Ayoub | **Who is a club member?** `new_event` notifications go only to users linked to the club through `UserMember.club_id`. The student site has no "join a club" action, so today only people the dashboard assigns to a club get them. Is that the intended rule (members only), or should every 1337 student be told about new events (or students who follow a club, which would need a follow endpoint)? | The notifications module asks for alerts on create, update and delete. With members only, most students never get a "new event" alert. We need to know what to say in the demo |
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
| Multi-user: many users at once, no conflicts, real-time across users | ✅ **Tested (Mouad, 2026-11-23, DOCS §22):** 20 students against Ahmed's Django (`792ac56`) + 10 simultaneous Next.js sessions: race for 5 places → exactly 5 in, 15 "full"; double clicks and rapid toggles never corrupt counts; 10 live sockets all receive the new event; each student gets only their own notification; 10 simultaneous `/profile` pages never mix students. 4 runs, 52/52 checks, no server error. **Redo once on the merged stack** | Ahmed (RSVP), Mouad (tests) |
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
| Web Minor: custom design system (≥10 components, palette, typography, icons) | 1 | ✅ **Done (2026-11-23):** `/design-system` shows everything by Atomic Design level (foundations, atoms, molecules, organisms, templates & pages) with the real components (DOCS §17) |
| User Mgmt Minor: OAuth 2.0 (42) | 1 | ✅ **Done (2026-11-24):** real 42 login on `https://localhost` creates the Django account (`monajjar`, Benguerir, STUDENT), DOCS §25.1. Secret valid until 2026-12-22 |
| Web Major: real-time WebSockets | 2 | ✅ **Done (2026-11-22):** Ahmed's `/ws/calendar/` + the student site's live pages (DOCS §15.1–15.2). Show it on the merged stack |
| Web Minor: notification system (all create/update/delete) | 1 | ✅ **Done (2026-11-23):** Ahmed's stored notifications (PR #5, `event_title` in his final branch) + the live bell (DOCS §15.3). BE11 fixed (every active student gets "new event", merged in `Ahmed` 2026-11-23) |
| Web Minor: advanced search (filters, sorting, **pagination**) | 1 | ✅ **Done (2026-11-23):** `/search`, opened from the navbar search: words, category, date, club; 4 sorts; 12 per page with page links; every result list has its own URL (DOCS §18) |
| User Mgmt Major: advanced permissions (user CRUD, roles, views per role) | 2 | ⚠️ Ayoub: roles and per-role views exist (`board` vs `super_admin`); user **create/delete** endpoints and dashboard screens to create, edit and delete users and change roles are missing (today read-only, PATCH only) |
| User Mgmt Major: organization system (clubs: create/edit/delete, add/remove members) | 2 | ⚠️ Ayoub: dashboard reads clubs and members from Django but has no create/edit/delete club or add/remove board member screens; `/api/superadmin/organizations/` is GET + PATCH only |
| Web Minor: file upload & management (types, validation, preview, progress, delete) | 1 | 🟡 **Student site done (2026-11-24, DOCS §26):** "Change photo" with checks on both sides, preview, progress, cancel, remove; tested 15/15 against `Ayoub-backend`. Counts once `Ayoub-backend` is merged into `Ahmed` (BE29) |
| A11y Minor: RTL (Arabic) | 1 | ✅ **Student site done (2026-11-22, DOCS §12):** `dir="rtl"` in Arabic, every layout uses logical sides, mirrored drawer, icons and arrow keys. ⚠️ Ayoub's dashboard is a separate app: if evaluators open it, it has no RTL yet |
| A11y Minor: ≥3 languages + switcher | 1 | ✅ **Student site done (2026-11-22, DOCS §12):** English, French, Arabic, switcher in the navbar and phone menu, choice kept in a cookie, every page and message translated (274 messages × 3), dates in each language. ⚠️ Same dashboard caveat: decide whether the dashboard needs languages too, or whether we present the module on the student site only |
| Web Major: public API (API key, rate limiting, docs, GET/POST/PUT/DELETE) | 2 | ⚠️ Swagger docs exist; no API key, no throttling |
| DevOps Major: monitoring (Prometheus + Grafana) | 2 | ✅ **Done (Hamza, 2026-11-24, `Developer` `43580e5`):** Prometheus + alert rules, Grafana behind `/grafana/` with login, a provisioned 6-panel dashboard, pinned images (H4). Show it live on the merged stack |
| A11y Major: WCAG 2.1 AA | 2 | Possible (student site built with ARIA), risky: whole app incl. dashboard must pass |

**Count (Mouad, 2026-11-24, 21:00):** ✅ done = **14** (frameworks 2, ORM 1, SSR 1, design system 1, WebSockets 2, notifications 1, advanced search 1, RTL 1, 3 languages 1, monitoring 2, OAuth 1). Minimum to pass: **14** reached. Next: + file upload (BE16–17) = 15 · + Ayoub's permissions and organization majors (CRUD screens) = 19 · + public API = 21. Modules only count if they work at the demo, on the merged stack; aim for 16+ as a safety margin.

**Not for us:** game-dependent modules, chat/friends ("User interaction" major, "Standard user management" major both require friends).

