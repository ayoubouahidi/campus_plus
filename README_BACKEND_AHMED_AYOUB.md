# Campus Hub backend: the split between Ahmed and Ayoub

> Written 2026-11-18 by Mouad (frontend), after reading the code on the `Ahmed`, `Ayoub` and `Mouad` branches.
> The new backend teammate is not joining. DASH's role (**Backend API & data**) is split between **Ahmed** and **Ayoub**, so we can reach production as fast as possible.
> This file replaces `README_BACKEND_TEAMMATE.md` (same Desktop), which is now obsolete.

---

## Table of contents

1. [The split in one minute](#1-the-split-in-one-minute)
2. [Why this split (based on your code)](#2-why-this-split-based-on-your-code)
3. [Rules for two people in one Django project](#3-rules-for-two-people-in-one-django-project)
4. [Step 0, together: the shared database schema (day 1)](#4-step-0-together-the-shared-database-schema-day-1)
5. [Ahmed's tasks](#5-ahmeds-tasks)
6. [Ayoub's tasks](#6-ayoubs-tasks)
7. [Who waits for whom](#7-who-waits-for-whom)
8. [The full API contract (endpoint → owner)](#8-the-full-api-contract-endpoint--owner)
9. [JSON shapes the student website expects](#9-json-shapes-the-student-website-expects)
10. [Login and WebSocket flow, end to end](#10-login-and-websocket-flow-end-to-end)
11. [What you need from Hamza and from Mouad](#11-what-you-need-from-hamza-and-from-mouad)
12. [Milestones to production](#12-milestones-to-production)
13. [Production checklist (definition of done)](#13-production-checklist-definition-of-done)
14. [Decisions to take in the first meeting](#14-decisions-to-take-in-the-first-meeting)
15. [Where things are](#15-where-things-are)

---

## 1. The split in one minute

| | **Ahmed**: content API + real-time | **Ayoub**: identity + dashboard API |
| --- | --- | --- |
| Django apps | `core_data` (events, clubs, departments, **RSVP**) and `realtime` (already yours) | **new** `accounts` (login sync, `/me`, roles, permissions) and **new** `dashboard` (announcements, join requests, audit log, stats) |
| Owns | Models + **all migrations of `core_data`**, the public read API, filters, pagination, uploads, RSVP, WebSocket JWT, health check | `POST /auth/sync`, users and roles, permission classes, club-board API, super-admin API, wiring the dashboard UI to the real API |
| Main consumer | The student website (Mouad) | The dashboard (Ayoub's own Next.js app) |
| Already done | Models, ViewSets, Swagger, event broadcasts, JWT WebSocket auth | 42 login with Auth.js (`auth.ts`), `backendFetch`, role middleware, all dashboard screens with mock data |

**In one sentence:** Ahmed makes the **data** right (what events and clubs are, who is going), Ayoub makes the **people** right (who you are, what you're allowed to do, the dashboards that manage it).

---

## 2. Why this split (based on your code)

**Ahmed** wrote `core_data` and `realtime` on the `Ahmed` branch:

- `core_data/models.py`: `Department`, `Club` (with `head`), `ClubEvent` (with `image_path`, `starts_at`, `status`), `UserMember`.
- `core_data/views.py`: the ViewSets, `CanCreateClubEvent` / `CanModifyClubEvent`, and the `perform_create` / `perform_update` / `perform_destroy` hooks that broadcast through `realtime/broadcast.py`.
- `realtime/`: the Channels consumer, Redis group `calendar_updates`, `JWTAuthMiddleware` reading the `ws_access` cookie.

Every field the student site needs (category, flyer, slug, RSVP counts) lives in these models and serializers. The broadcast payload **is** the event serializer's output (`dict(serializer.data)`), so whoever owns the serializer must own the broadcast. One owner = no mismatch between the REST event and the WebSocket event.

**Ayoub** wrote the dashboard (`dashboard_campus/` on the `Ayoub` branch):

- `auth.ts` already calls **`POST {BACKEND_URL}/auth/sync`** with header `x-internal-key` and expects `{ token, user: { id, role } }`. That endpoint doesn't exist yet. Ayoub knows exactly what his client sends, so he builds the server side.
- `lib/api.ts` (`backendFetch`) sends `Authorization: Token …`, the same DRF `TokenAuthentication` Ahmed's settings use.
- `middleware.ts` checks roles `STUDENT` / `BOARD_MEMBER` / `SUPERADMIN`, so the role model and permission rules belong with him.
- `lib/mock-data.ts` and `lib/super-admin-data.ts` list exactly the data his screens need (stats, members, approvals, announcements, registrations, organizations, role assignments, audit log, system health). Nobody knows those screens better.

**Why separate Django apps:** two people changing the same `models.py` produce **conflicting migrations** (two `0005_…` files that Django refuses to apply). With `core_data` = Ahmed only and `accounts` + `dashboard` = Ayoub only, each person's migrations live in their own folder and never collide.

**Workload:** roughly equal. Ahmed has fewer new endpoints but RSVP, filters, uploads and the real-time hand-off. Ayoub has more endpoints but they are simpler (mostly lists and counts).

---

## 3. Rules for two people in one Django project

| # | Rule | Why |
| --- | --- | --- |
| 3.1 | **Only Ahmed creates migrations in `core_data`. Only Ayoub creates migrations in `accounts` and `dashboard`.** Need a field in the other person's model? Ask; they add it. | Avoids migration conflicts (see §2). |
| 3.2 | Both work from the **`Ahmed` branch** as the base. Each works on their own branch (`Ahmed`, `Ayoub-backend`) and merges through a PR. Rebase on the other's work at least daily. | One backend, two contributors. Never push to someone else's branch. |
| 3.3 | **Swagger (`/api/docs/`) is the contract.** Every endpoint has a serializer and shows up there with its fields. Mouad builds against Swagger, not against chat messages. | One source of truth for three people. |
| 3.4 | **Every endpoint has a test** (`APITestCase`): allowed user → 200, wrong user → 403, anonymous → 401/403 where relevant. | Permissions are the place where bugs are dangerous. |
| 3.5 | **Times are ISO 8601 UTC** (`2026-11-05T17:00:00Z`). Keep `TIME_ZONE='UTC'`, `USE_TZ=True`. The frontends convert to Morocco time. | Already in Ahmed's settings. |
| 3.6 | **Image URLs are absolute** (`https://host/media/…`), built with `request.build_absolute_uri`. | Next.js can't load relative media paths. |
| 3.7 | **No N+1 queries in lists.** Use `select_related`, `prefetch_related`, `annotate(Count…)`, `Exists(…)`. Check with `django-debug-toolbar` or `assertNumQueries` in a test. | Lists of 20 events must stay 2–4 queries, not 60. |
| 3.8 | **Pin versions.** `requirements.txt` today says `Django>=4.2` but the container runs **Django 6.1.3**. Run `pip freeze` in the working `web` container and pin exact versions before production. | A rebuild must give the same stack. |

Current versions (from the running stack): Python 3.14, Django 6.1.3, DRF 3.18.3, Channels 4.3.2, Daphne 4.2.3, channels-redis 4.3.0, SimpleJWT 5.5.1, PostgreSQL 16, Redis 7.

---

## 4. Step 0, together: the shared database schema (day 1)

Sit together for one hour, agree on this list, then **Ahmed writes it as one migration** in `core_data` and Ayoub reviews the PR. After that, both can work in parallel without touching each other's models.

### 4.1 `Department` (campus / school)

| Field | Type | Why |
| --- | --- | --- |
| `slug` | `SlugField(unique=True)` | `1337`, `emines`, `um6p`. The website's campus filter and the super-admin "tenant" column use it. Today the frontend guesses the campus from names. |

### 4.2 `Club`

| Field | Type | Why |
| --- | --- | --- |
| `slug` | `SlugField(unique=True)` | Website pages are `/clubs/<slug>` (e.g. `/clubs/leet-dev`). Data migration: fill from `slugify(name)`. |
| `logo` | `ImageField(upload_to=uuid_path('club_logos'), blank=True)` + same validators as events | Club cards and club page. |
| `banner` | `ImageField(upload_to=uuid_path('club_banners'), blank=True)` | Club page header. |

(`head` stays: it's the president. `contact_email`, `meeting_*`, `is_active` stay. `is_active=False` = "suspended" in the super-admin dashboard.)

### 4.3 `ClubEvent`

| Field | Change | Why |
| --- | --- | --- |
| `category` | **new** `CharField(choices=CATEGORY_CHOICES)` with `Tech, Media, Music, Sports, Business, EventsOrganization, Gaming` | Filters, colours, calendar. Today `?category=` searches the **name text**, which is wrong. |
| `capacity` | **new** `PositiveIntegerField(null=True, blank=True)` | The dashboard shows "128 / 150". `null` = unlimited. |
| `starts_at`, `ends_at` | make **required** (`null=False`); data migration fills existing nulls first; add a check `ends_at > starts_at` | The calendar can't place an event without a start. |
| `image_path` | `upload_to=uuid_path('events_pics')` | Unique name per upload, so a new flyer gets a new URL (browsers and Next.js cache images by URL). |
| `Meta.ordering` | `['starts_at']` instead of `['name']` | Lists are chronological. |

### 4.4 `UserMember` (the profile; one per person)

| Field | Change | Why |
| --- | --- | --- |
| `forty_two_id` | **new** `PositiveIntegerField(unique=True, null=True)` | Stable key for 42 users (logins can change). Used by `/auth/sync`. |
| `avatar_url` | **new** `URLField(blank=True)` | The 42 profile picture (`image.link`). `image_path` stays for uploaded avatars. |
| `campus` | **new** `CharField(max_length=100, blank=True)` | From the 42 profile, e.g. "Benguerir". |
| `phone` | **new** `CharField(max_length=30, blank=True)` | President's phone on club pages (shown to signed-in students only). |
| `role` | **change** to `CharField(choices=[STUDENT, BOARD_MEMBER, SUPERADMIN], default='STUDENT')` | Today it's free text. Data migration: map existing values, unknown → `STUDENT`. |

Note: `club_id` is a single foreign key, so a student belongs to **one club**. Fine for the first release; a many-to-many `Membership` model can come later.

### 4.5 `Rsvp` (new, in `core_data`)

```python
class Rsvp(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rsvps')
    event = models.ForeignKey(ClubEvent, on_delete=models.CASCADE, related_name='rsvps')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'event'], name='one_rsvp_per_user_event')]
        indexes = [models.Index(fields=['event', '-created_at'])]
```

### 4.6 The upload-name helper (in `core_data/models.py`)

```python
import uuid, os
from django.utils.deconstruct import deconstructible

@deconstructible
class uuid_path:
    def __init__(self, folder): self.folder = folder
    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()
        return f'{self.folder}/{uuid.uuid4().hex}{ext}'
```

### 4.7 Ayoub's own models (in his new `dashboard` app, his migrations)

```python
class Announcement(models.Model):
    club = models.ForeignKey('core_data.Club', on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=200)
    message = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MembershipRequest(models.Model):          # the "Pending approvals" card
    KIND = [('join', 'Join the club'), ('cohost', 'Event co-host'), ('room', 'Room booking')]
    STATUS = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    club = models.ForeignKey('core_data.Club', on_delete=models.CASCADE, related_name='requests')
    member = models.ForeignKey('core_data.UserMember', on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=KIND, default='join')
    note = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)

class AuditLog(models.Model):                   # the super-admin "Audit log" card
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50)    # 'role_changed', 'club_suspended', 'event_created', 'login'…
    target = models.CharField(max_length=200)   # human-readable: "LEET Dev", "s.lahlou"
    created_at = models.DateTimeField(auto_now_add=True)
```

Plus a one-line helper both of you can call: `dashboard.audit.log(actor, action, target)`.

### 4.8 Seed data

One `python manage.py seed` command (Ahmed) that creates the departments (`1337`, `emines`, `um6p`), a few clubs with slugs, and events in the next 30 days, so all three frontends show something right after `make up`.

---

## 5. Ahmed's tasks

In priority order. "Done when" = acceptance test.

### A0. The day-1 schema migration (§4)

Write it, with data migrations for slugs, required dates and roles. Ayoub reviews.
**Done when:** `migrate` runs on a copy of the current database without errors, and Swagger shows the new fields.

### A1. Security fixes (do these first, they are holes today)

| Problem today | Fix |
| --- | --- |
| `ClubViewSet`: only `create` is protected. **Anyone, even signed out, can `PUT`/`PATCH`/`DELETE` a club.** | Read: `AllowAny`. Update: superadmin or that club's board (Ayoub's `IsClubBoard`, B3). Create/delete: superadmin. |
| `DepartmentViewSet` has **no permissions** (DRF default = `AllowAny`): anyone can create/delete departments. | Read: `AllowAny`. Write: superadmin. |
| `UserMemberViewSet`: any signed-in user can **list every member** (names, emails). | List/retrieve: superadmin, or board of the same club. Students use `/api/me/` (Ayoub). |
| `CanCreateClubEvent` / `CanModifyClubEvent` only accept `is_staff` or `club.head`. | Also accept `role == BOARD_MEMBER` of that club and `SUPERADMIN` (use Ayoub's permission classes). |

**Done when:** a test proves anonymous `DELETE /api/clubs/1/` → 401/403, and so on for each row.

### A2. Event API in the website's shape

`ClubEventSerializer` returns (Django name → JSON name the frontends use, see §9):

`id`, `title` (←`name`), `description`, `club_id`, `club_name`, `club_slug`, `department_name`, `department_slug`, `flyer_url` (absolute URL of `image_path`, or `""`), `location`, `category`, `start_time` (←`starts_at`), `end_time` (←`ends_at`), `status`, `capacity`, `rsvps_count`, `has_user_rsvpd`, `attendees_preview`.

- Write the same names on input (`title`, `start_time`…) so the dashboard form and the API agree. Use `source=` in the serializer; don't rename the database columns.
- `has_user_rsvpd` is `false` for anonymous users.
- **The broadcast** (`perform_create`/`perform_update`) sends this same shape. Per-user fields (`has_user_rsvpd`) are **left out** of broadcasts: every client keeps its own.

**Done when:** `GET /api/club-events/` returns exactly the shape in §9.1.

### A3. Filters, ordering, pagination

| Query parameter | Meaning |
| --- | --- |
| `?from=2026-11-01&to=2026-12-01` | events overlapping that range (`starts_at < to AND ends_at > from`): the calendar month |
| `?upcoming=true` | `ends_at > now` (the feed) |
| `?club=leet-dev` | by club slug |
| `?department=1337` | by department slug (campus filter) |
| `?category=Tech` | **exact** category match (replace today's text search on name/description) |
| `?search=hack` | title, description, club name, location |

- Ordering: `starts_at` ascending by default.
- Pagination: `PageNumberPagination`, `page_size=20`, `?page_size=` up to `200` (the calendar asks for a whole month at once). Response `{count, next, previous, results}`.

**Done when:** each parameter has a test.

### A4. Clubs API in the website's shape

- `GET /api/clubs/<slug>/` works (`lookup_field = 'slug'`; the dashboard can use slugs too).
- Fields: `id`, `slug`, `name`, `description`, `department_id`, `department_name`, `department_slug`, `logo_url`, `banner_url`, `president_name`, `president_email`, `president_phone`, `member_count`, `event_count`, `upcoming_event_count`, `meeting_day`, `meeting_time`, `meeting_location`, `is_active`, `created_at`.
- **Privacy:** `president_email` and `president_phone` are returned **only to signed-in users** (drop them in `to_representation` when `request.user` is anonymous). The website hides them too, but data that leaves the server is public.
- Lists hide `is_active=False` clubs, except for superadmins.

### A5. RSVP (the main button of the student website)

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/club-events/{id}/rsvp/` | Signed-in only. Creates the RSVP (idempotent: already going → 200, not an error). Returns `{rsvps_count, has_user_rsvpd: true}`. **400** if the event has ended or is cancelled, **409** if `capacity` is full. |
| `DELETE /api/club-events/{id}/rsvp/` | Removes it (idempotent). Returns `{rsvps_count, has_user_rsvpd: false}`. |
| `GET /api/club-events/{id}/attendees/` | Signed-in only (decision §14). Paginated `[{id, full_name, avatar_url}]`, newest first. Also used by the dashboard's registrations page. |

- In lists: `rsvps_count` via `annotate(Count('rsvps'))`, `has_user_rsvpd` via `Exists(...)`, `attendees_preview` (≤ 3, newest first) via `Prefetch`. Lists must not do one query per event (rule 3.7).
- After an RSVP or cancel: broadcast `event_updated` with the new `rsvps_count` (so counts move live on everyone's screen).

### A6. Real-time: finish and hand off

Your own checklist (`docs/ahmed/FLOW_AND_TASKS.md`) items 3–6, plus:

- **`POST /api/realtime/token/`** (DRF `Token` auth): returns `{ "access": "<SimpleJWT access token>", "expires_in": 300 }` for the current user, with the claims your `JWTAuthMiddleware` checks. The website's server (Mouad) calls it and sets the `ws_access` cookie (HttpOnly, Secure, SameSite=Lax, `Path=/ws/`) on the same domain, then refreshes it before expiry. This answers the open question in your checklist ("who issues the access token and the `ws_access` cookie").
- **Logout:** when Ayoub's logout deletes the DRF token, existing sockets close at JWT expiry at the latest (≤ 5 min). Agree with Ayoub whether that's enough or whether logout should also broadcast a close to that user's group.
- Production setting: `WS_AUTH_BACKEND=jwt` (your code already refuses `token_dev` when `DEBUG=False`).

### A7. Health endpoint

`GET /api/health/` → `{"database": "ok", "redis": "ok", "channels": "ok"}` (each check with a short timeout), **superadmin only**. Plus `GET /api/health/live` → `200 "ok"` with no checks, public, for Docker/nginx health checks. Ayoub's "System health" card reads the first.

### A8. Uploads

- `uuid_path` on every `ImageField` (§4.6).
- Keep your validators (≤ 2 MB, JPEG/PNG/WebP, real image check). **Add a pixel limit** (e.g. ≤ 4000 × 4000): one 77 MB photo once froze Next.js's image optimizer.
- `flyer_url`, `logo_url`, `banner_url` are **absolute**.
- Media files are served by nginx from the `media_data` volume (Hamza), not by Django.

### A9. Seed command, tests, Swagger

- `python manage.py seed` (§4.8).
- Tests for A1–A8.
- Every endpoint documented in Swagger with request and response examples (`@extend_schema`).

### A10. Pin requirements (rule 3.8) and update `CHANGELOG_AHMED.md`.

---

## 6. Ayoub's tasks

### B1. `POST /auth/sync`: the bridge between 42 login and Django (blocks all logins)

Your `auth.ts` already calls it. Build the Django side in a new `accounts` app.

- **URL exactly `auth/sync`** (no `/api/`, no trailing slash: that's what `auth.ts` calls; `APPEND_SLASH` can't redirect a POST).
- **Internal only:** Next.js calls it at `BACKEND_URL=http://web:8000` inside Docker. Nginx must **not** forward `/auth/` to Django from the internet (ask Hamza to check, §11).
- **Check the key** with `hmac.compare_digest(request.headers.get('x-internal-key', ''), settings.BACKEND_INTERNAL_KEY)`. Wrong or missing → 403. Same value in both containers' env.
- **Body** (what `auth.ts` sends): `{ fortyTwoId, login, email, firstName, lastName, imageUrl, campus }`.
- **Logic:**
  1. Find `UserMember` by `forty_two_id`. If not found, create Django `User` (`username = login`, unusable password) + `UserMember`.
  2. Update `first_name`, `last_name`, email, `avatar_url`, `campus` every time (42 data can change).
  3. **Never change the role here** (a promoted board member must stay one). New users start as `STUDENT`. Bootstrap the first admins with env `SUPERADMIN_LOGINS=mouad,ahmed,ayoub`: those logins become `SUPERADMIN`.
  4. Optional campus allow-list (`ALLOWED_42_CAMPUSES`) → 403 for others.
  5. `Token.objects.get_or_create(user=…)`.
- **Response:** `{ "token": "<DRF token>", "user": <User shape §9.3> }`. Your `auth.ts` reads `user.id` and `user.role`; the student website needs the full shape (`full_name`, `avatar_url`, `club_id`…), so return it all.
- Write an `AuditLog` entry `login`.

**Done when:** a real 42 login on the dashboard creates the user in Django, and logging in twice doesn't duplicate it.

### B2. `/api/me/` and logout

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/me/` | The current user (§9.3). 401 without a token. |
| `PATCH /api/me/` | Edit own `phone` (and later preferences). Nothing else. |
| `POST /api/auth/logout/` | Deletes the user's DRF token (the next login creates a new one). Coordinate with Ahmed for open sockets (A6). |

### B3. Roles and permission classes (Ahmed needs these for A1: deliver early)

In `accounts/permissions.py`:

```python
class IsSuperAdmin(BasePermission): ...                # role == SUPERADMIN (or is_superuser)
class IsClubBoard(BasePermission): ...                 # SUPERADMIN, or role == BOARD_MEMBER with club_id == the object's club, or club.head
def user_club_id(user) -> int | None: ...              # the club a board member manages
```

Both of you import these; nobody re-implements role checks.

### B4. Club-board API (`/api/board/…`, for `/admin` pages of the dashboard)

All endpoints: `IsClubBoard`, and **always filtered to the caller's own club** (a board member must never see another club's data).

| Endpoint | Dashboard screen | Data |
| --- | --- | --- |
| `GET /api/board/stats/` | the 4 stat cards | total events, registrations (RSVPs) this month vs last month, active members, pending requests |
| `GET /api/board/registrations/weekly/` | the registrations chart | RSVPs per day for the last 7 days |
| `GET /api/board/members/` | Members page | name, role in club, joined date, status |
| `GET /api/board/requests/` · `POST /api/board/requests/{id}/approve/` · `…/reject/` | Pending approvals | approving a `join` request sets the member's `club_id`; write `AuditLog` |
| `GET/POST/PATCH/DELETE /api/board/announcements/` | Announcements page | `Announcement` CRUD for own club |
| Events | Events page, Registrations page | **Use Ahmed's endpoints**: `GET /api/club-events/?club=<slug>` (has `rsvps_count` + `capacity`), `POST/PATCH/DELETE /api/club-events/` (already permission-checked and broadcast live), `GET /api/club-events/{id}/attendees/` |

Students also need a way to create a join request: `POST /api/clubs/{slug}/join/` (signed-in) → creates a `MembershipRequest(kind='join')`. Yours.

### B5. Super-admin API (`/api/superadmin/…`, for `/super_admin` pages)

All endpoints: `IsSuperAdmin`. (Use `/api/superadmin/`, not `/api/admin/`: `/admin` is already Django's admin site in nginx.)

| Endpoint | Dashboard card |
| --- | --- |
| `GET /api/superadmin/stats/` | total users, clubs, events this month, pending requests |
| `GET /api/superadmin/organizations/` · `PATCH /api/superadmin/organizations/{id}/` (`is_active`) | Organizations table, suspend / reactivate a club |
| `GET /api/superadmin/users/?role=&search=` · `PATCH /api/superadmin/users/{id}/` (`role`, `club_id`) | Role assignments (promote a student to board member of a club) |
| `GET /api/superadmin/roles/distribution/` | Role distribution bars (real counts) |
| `GET /api/superadmin/events/weekly/` | Activity chart (events per week) |
| `GET /api/superadmin/audit-log/` | Audit log (paginated, newest first) |
| System health | **Use Ahmed's** `GET /api/health/` |

Every role change and suspension writes an `AuditLog` entry.

### B6. Wire the dashboard to the real API

- Replace `lib/mock-data.ts` and `lib/super-admin-data.ts` with `backendFetch` calls to B4/B5 and Ahmed's endpoints. Keep the mock files only for Storybook-style tests, or delete them.
- Event create/edit form: `title`, `description`, `category` (required), `start_time`/`end_time` (required, end after start), `location`, `capacity`, flyer (≤ 2 MB, JPEG/PNG/WebP; show the API's error message).
- Use the shared types (`types/api.ts`, same as the student website) and the role names `STUDENT` / `BOARD_MEMBER` / `SUPERADMIN`.

### B7. Dashboard fixes found while reading your branch

| Issue | Fix |
| --- | --- |
| `middleware.ts`: Next.js 16 renamed the file convention to **`proxy.ts`** (your own comment says so). | Rename it, run `next build` to confirm. |
| Your routes are `/admin/*`, but nginx sends `/admin` to **Django's admin**. | Decide the dashboard location (§14): subdomain `admin.<host>` (recommended) or `/dashboard/*`. |
| Two Auth.js apps on the same domain share cookie names and log each other out. | With a subdomain: set distinct cookie names or `cookies.sessionToken.name` per app. |
| Branding says "CampusPulse". | Rename to **Campus Hub**. |
| Next.js 16.4.2 here, 16.3.5 on the student site. | Mouad upgrades the student site to 16.4.2 during login integration. |
| 42 app | Register redirect URIs for **both** apps: `https://<host>/api/auth/callback/42-school` (student site) and the dashboard's. Share the client id with Mouad. |

### B8. Email sign-in for EMINES students (only if decided, §14)

If EMINES students (no 42 account) must log in: Ahmed's `POST /api/signup/` already exists; add `POST /api/auth/login/` (email + password → `{token, user}`) and add a Credentials provider in Auth.js. Otherwise skip for the first release.

### B9. Tests and Swagger for B1–B5.

---

## 7. Who waits for whom

```
Day 1   [A0 + §4 together] ─────────────┬────────────────────────────────────────────┐
                                         │                                            │
Ahmed   A1 security ◄── needs B3 ── A2 events shape ── A3 filters ── A4 clubs ── A5 RSVP ── A6 realtime ── A7 ── A8 ── A9/A10
                          ▲                                                                   ▲
Ayoub   B3 permissions ───┘  B1 /auth/sync ── B2 /me ── B4 board API ── B5 superadmin ── B6 wire dashboard ── B7 ── B9
                                   │                       │  (uses A2/A5)    (uses A7)
Mouad   login page UI ─────────────┴── student login ── API layer (needs A2–A5) ── WebSocket (needs A6)
```

- **Ayoub delivers B3 on day 2** so Ahmed's A1 isn't blocked.
- **B1 and A2 are the two that unblock Mouad**: login + real events on the student website.
- Ayoub's B4 events pages need A2 + A5, so do the non-event screens (members, requests, announcements) first.

---

## 8. The full API contract (endpoint → owner)

| Method + path | Owner | Auth | Used by |
| --- | --- | --- | --- |
| `POST /auth/sync` (internal) | Ayoub | `x-internal-key` | both Next.js apps' login |
| `GET/PATCH /api/me/` | Ayoub | Token | website, dashboard |
| `POST /api/auth/logout/` | Ayoub | Token | both |
| `GET /api/club-events/` (+ filters, pagination) | Ahmed | public | website feed + calendar, dashboard |
| `GET /api/club-events/{id}/` | Ahmed | public | event page |
| `POST/PATCH/DELETE /api/club-events/…` | Ahmed | board of that club / superadmin | dashboard |
| `POST/DELETE /api/club-events/{id}/rsvp/` | Ahmed | Token | website RSVP button |
| `GET /api/club-events/{id}/attendees/` | Ahmed | Token | event page, dashboard registrations |
| `GET /api/clubs/`, `GET /api/clubs/{slug}/` | Ahmed | public (contact fields signed-in only) | website, dashboard |
| `PATCH /api/clubs/{slug}/` | Ahmed | board / superadmin | dashboard |
| `POST /api/clubs/{slug}/join/` | Ayoub | Token | website (club page) |
| `GET /api/departments/` | Ahmed | public | campus filters |
| `/api/board/*` | Ayoub | board (own club only) | dashboard `/admin` |
| `/api/superadmin/*` | Ayoub | superadmin | dashboard `/super_admin` |
| `POST /api/realtime/token/` | Ahmed | Token | website server (sets `ws_access`) |
| `wss /ws/calendar/` | Ahmed | `ws_access` cookie (JWT) | website calendar + feed |
| `GET /api/health/`, `/api/health/live` | Ahmed | superadmin / public | dashboard, Docker |
| `POST /api/signup/` (exists), `POST /api/auth/login/` | Ahmed / Ayoub | public | only if email sign-in is decided |
| `/api/docs/` (Swagger) | both | public in dev, **off or protected in production** | everyone |

---

## 9. JSON shapes the student website expects

The student website (`frontend/src/types/api.ts` on the `Mouad` branch) already renders these with mock data. If the API returns exactly this, Mouad only swaps the data source.

### 9.1 Event

```json
{
  "id": 12,
  "title": "AI Hackathon",
  "description": "48 hours to build…",
  "club_id": 3,
  "club_name": "LEET Dev",
  "club_slug": "leet-dev",
  "department_name": "1337 Coding School",
  "department_slug": "1337",
  "flyer_url": "https://<host>/media/events_pics/3f2a….webp",
  "location": "1337 Benguerir, Cluster 2",
  "category": "Tech",
  "start_time": "2026-11-21T09:00:00Z",
  "end_time": "2026-11-23T09:00:00Z",
  "status": "planned",
  "capacity": 150,
  "rsvps_count": 87,
  "has_user_rsvpd": false,
  "attendees_preview": [{ "id": 41, "full_name": "Salma Idrissi", "avatar_url": "https://cdn.intra.42.fr/…" }]
}
```

### 9.2 Club

```json
{
  "id": 3, "slug": "leet-dev", "name": "LEET Dev", "description": "…",
  "department_id": 1, "department_name": "1337 Coding School", "department_slug": "1337",
  "logo_url": "https://<host>/media/club_logos/….png", "banner_url": null,
  "president_name": "Yassine El Amrani",
  "president_email": "…",  "president_phone": "…",
  "member_count": 86, "event_count": 24, "upcoming_event_count": 3,
  "meeting_day": "Thursday", "meeting_time": "17:00:00", "meeting_location": "Innovation lab",
  "is_active": true, "created_at": "2025-01-12T10:00:00Z"
}
```

(`president_email` / `president_phone` are absent for anonymous requests.)

### 9.3 User (`/api/me/`, `/auth/sync`)

```json
{ "id": 41, "email": "…", "full_name": "Salma Idrissi", "login": "sidrissi",
  "avatar_url": "https://cdn.intra.42.fr/…", "campus": "Benguerir",
  "role": "BOARD_MEMBER", "club_id": 3, "club_slug": "leet-dev" }
```

### 9.4 Lists

`{ "count": 120, "next": "https://…?page=2", "previous": null, "results": [ … ] }`

### 9.5 WebSocket message (`/ws/calendar/`)

`{ "type": "event_created" | "event_updated" | "event_deleted", "data": <Event §9.1 without has_user_rsvpd> }`. For `event_deleted`: `"data": { "id": 12 }`. Ahmed's `broadcast_calendar_event` already sends `{type, data}`.

### 9.6 Errors

DRF default: `{ "detail": "…" }` or `{ "field": ["message"] }`, with the right status (400, 401, 403, 404, 409). The frontends show `detail` to the user.

---

## 10. Login and WebSocket flow, end to end

```
Browser ──"Continue with 42"──► Next.js (Auth.js, /api/auth/*)  ──► 42 intra (OAuth)
                                     │  42 profile
                                     ▼
                     POST http://web:8000/auth/sync   (x-internal-key)        ← Ayoub B1
                                     │  { token, user }
                                     ▼
              Auth.js session cookie (encrypted JWT holding token + role)
                                     │
   Server components / server actions: Authorization: Token <token> ──► /api/…   ← Ahmed + Ayoub
                                     │
   Before opening the socket: Next.js server ──► POST /api/realtime/token/ ──► { access }   ← Ahmed A6
                              sets cookie ws_access=<access>; HttpOnly; Secure; SameSite=Lax; Path=/ws/
                                     │
   Browser ──wss://<host>/ws/calendar/ (cookie sent automatically)──► Daphne ──► JWTAuthMiddleware   ← Ahmed
```

- Same domain for everything (nginx in front): cookies just work, no CORS.
- Nginx must send `/api/auth/*` to **Next.js** (Auth.js), and the rest of `/api/*` to Django (Hamza).

---

## 11. What you need from Hamza and from Mouad

**Hamza (infrastructure):**

- Nginx: `/api/auth/` → frontend **before** the `/api/` → Django rule; **do not** expose `/auth/sync` publicly; `/media/` served from the `media_data` volume with long cache headers; `/ws/` upgrade to Daphne (already there).
- One root `.env.example` with every variable: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DATABASE_*`, `REDIS_URL`, `WS_AUTH_BACKEND=jwt`, `BACKEND_INTERNAL_KEY`, `SUPERADMIN_LOGINS`, `AUTH_SECRET`, `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET`, `AUTH_TRUST_HOST=true`, `BACKEND_URL=http://web:8000`.
- If the dashboard gets a subdomain: an nginx `server` block + certificate for it.
- Postgres backups before going live.

**Mouad (student website):**

- Login page UI, then Auth.js integration on the student site with Ayoub's `auth.ts` (same `/auth/sync`).
- One `lib/api.ts` that calls your endpoints and maps them to the website's types.
- The `ws_access` cookie route and the `useWebSocket` hook (live calendar).
- Testing your endpoints against the website as soon as each lands: tell him when something is on your branch.

---

## 12. Milestones to production

| Milestone | Contents | Result |
| --- | --- | --- |
| **M1: login + real data** | §4 schema (A0), A1, B3, B1, B2, A2, A3, A4, seed | Students log in with 42 and see real events and clubs on the website |
| **M2: RSVP + dashboards working** | A5, B4, B6 (board pages), B7 | Students RSVP; club boards create and manage events and members |
| **M3: live + super admin** | A6, A7, B5, B6 (super-admin pages) | Calendar updates live; super admins manage clubs and roles |
| **M4: production** | A8, A9, A10, B9, §13 checklist, merge to `master` | Deployed |

Merge order into `master`: backend (Ahmed + Ayoub) + infrastructure (Hamza) → student website (Mouad) → dashboard (Ayoub).

---

## 13. Production checklist (definition of done)

- [ ] `DEBUG=False`, real `DJANGO_SECRET_KEY` from env, `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` set to the real domain.
- [ ] `SECURE_PROXY_SSL_HEADER`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` on (behind nginx HTTPS).
- [ ] `WS_AUTH_BACKEND=jwt`.
- [ ] Every permission row in A1 has a passing test; anonymous writes are impossible everywhere.
- [ ] `/auth/sync` unreachable from outside Docker; `BACKEND_INTERNAL_KEY` long and random.
- [ ] Swagger disabled or superadmin-only in production.
- [ ] `requirements.txt` pinned; `migrate` and `collectstatic` run on container start.
- [ ] Media on a volume; images UUID-named, ≤ 2 MB, ≤ 4000 px.
- [ ] 42 app has the production redirect URIs.
- [ ] First superadmins created via `SUPERADMIN_LOGINS`.
- [ ] Seed or real data for departments and clubs.
- [ ] Postgres backup tested (restore once).
- [ ] `python manage.py check --deploy` passes with no warnings you haven't accepted on purpose.

---

## 14. Decisions to take in the first meeting

| Question | Options | Suggestion |
| --- | --- | --- |
| Dashboard location | subdomain `admin.<host>` / `/dashboard` on the same domain | **Subdomain**: no cookie clash, no conflict with Django's `/admin` |
| Who can see who's going to an event | everyone / signed-in students / count only | **Signed-in students** |
| EMINES students without a 42 account | email sign-in (B8) / 42 only for now | **42 only for the first release**, email right after |
| Event approval by super admin before publishing | yes / no | **No for the first release** (club boards publish directly; super admin can delete). Faster to ship. |
| One club per student, or many | single `club_id` / `Membership` table | **Single for now** |
| Allowed 42 campuses | any / allow-list | Allow-list (`ALLOWED_42_CAMPUSES`) |
| Max image size | 2 MB (Ahmed's current validator) | **Keep 2 MB** |

---

## 15. Where things are

| What | Where |
| --- | --- |
| Django project, models, ViewSets | `Ahmed` branch: `backend/`, `core_data/`, `realtime/` |
| Ahmed's real-time notes and checklist | `Ahmed` branch: `docs/ahmed/ARCHITECTURE.md`, `docs/ahmed/FLOW_AND_TASKS.md`, `CHANGELOG_AHMED.md` |
| Dashboard, Auth.js login, `backendFetch`, role middleware | `Ayoub` branch: `dashboard_campus/` (`auth.ts`, `lib/api.ts`, `middleware.ts`, `lib/*-data.ts`) |
| Student website and its data types | `Mouad` branch: `frontend/` (`src/types/api.ts`, `src/lib/mockData.ts`) |
| What the frontend needs, decisions log | `Mouad` branch: `frontend/TEAM_NEEDS.md` |
| How the student website works | `Mouad` branch: `frontend/ARCHITECTURE.md`, `frontend/DOCS.md` |
| API docs (once running) | `https://localhost/api/docs/` |

Questions about what the website needs: ask Mouad. Questions about each other's endpoints: Swagger first, then each other.
