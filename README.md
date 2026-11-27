*This project has been created as part of the 42 curriculum by monajjar, ahlahfid, AYOUB_LOGIN, heljary.*

# Campus Hub

## Description

**Campus Hub** is the events platform of the 1337 campuses. Clubs publish their events in one place, and students find them, RSVP and get told when something changes, without chasing posters and group chats.

It has two web applications on one backend:

- **The student site** (`https://localhost`): a feed of upcoming events, a calendar, club pages, search, RSVP, notifications and a profile. Students sign in with their 42 account, or sign up with any email confirmed by a 6-digit code.
- **The dashboard** (`https://dashboard.localhost`): club **board members** create and edit their club's events and see who is going; **super admins** manage organizations (clubs), users and roles, and read the analytics and the audit log.

What a board member publishes on the dashboard reaches every open student page **live** (WebSockets), and the people concerned get a notification.

### Key features

- Event feed, calendar (month / week), club directory and club pages
- RSVP with capacity limits, "who's going" list, live attendee counts
- Real-time updates and notifications over WebSockets
- Search with filters, sorting and pagination (also from a ⌘K palette)
- Sign-in with 42 (OAuth 2.0), or email + password with a 6-digit email code
- Profile with photo upload
- English, French and Arabic, with full right-to-left layout for Arabic
- Dashboard with role-based pages: board members (their club) and super admins (everything)
- Monitoring with Prometheus and Grafana
- Privacy Policy and Terms of Service pages (linked in the footer)

## Instructions

### Prerequisites

- Docker Engine 24+ with Docker Compose v2 (`docker compose`)
- GNU Make
- OpenSSL (used by `make` to create the self-signed HTTPS certificate)
- Google Chrome (latest stable)
- Optional, for 42 sign-in: a 42 API application (UID and secret) with these redirect URIs:
  - `https://localhost/api/auth/callback/42-school`
  - `https://dashboard.localhost/api/auth/callback/42-school`
- Optional, for real emails (sign-up codes): an SMTP account. Without one, codes are printed in the backend logs.

### 1. Configure the environment

```bash
cp .env.example .env
```

Generate a value for each secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Fill in at least:

| Variable | What it is |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django's signing key (required, the backend won't start without it) |
| `POSTGRES_PASSWORD` | Database password |
| `BACKEND_INTERNAL_KEY` | Shared secret between the two Next.js servers and Django |
| `AUTH_SECRET` | Auth.js session encryption key |
| `BACKEND_URL` | Keep `http://backend:8000` (Django's address inside Docker) |
| `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET` | 42 app keys (for 42 sign-in) |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL` | SMTP settings for sign-up codes (`EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` prints them in the logs instead) |
| `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Grafana login |

`.env` is ignored by Git. Never commit it.

### 2. Start everything (one command)

```bash
make
```

This creates the HTTPS certificate if it is missing, then builds and starts every container (`docker compose up -d --build`). The database migrations run automatically.

### 3. Open the applications

| URL | What |
| --- | --- |
| `https://localhost` | Student site |
| `https://dashboard.localhost` | Dashboard (board members and super admins) |
| `https://localhost/api/docs/` | API documentation (Swagger) |
| `https://localhost/grafana/` | Monitoring |

The certificate is self-signed: accept the browser warning once per host.

### 4. Create the first super admin

```bash
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell -c \
  "from accounts.models import User; User.objects.filter(email='you@example.com').update(role='SUPERADMIN')"
```

Sign in at `https://dashboard.localhost`, create the clubs (with their category), then create board-member accounts and assign them to their club. Board members then publish events, and students see them on the student site.

### Other commands

| Command | What it does |
| --- | --- |
| `make down` | Stop the containers |
| `make logs` | Follow every service's logs |
| `make dev` | Student site with live reload |
| `make clean` | Stop and delete the volumes (database included) |
| `make re` | Delete everything and rebuild |
| `docker compose exec backend python manage.py test` | Backend tests |

## Team Information

| Member | Login | Role(s) | Responsibilities |
| --- | --- | --- | --- |
| Mouad Najjar | `monajjar` | **Tech Lead**, Developer | Architecture of the whole application and the data flow (dashboard → Django → student site), technology choices, code reviews and merges, the student site (frontend), the dashboard rework |
| Ahmed Lahfid | `ahlahfid` | **Project Manager**, Developer | Planning and tracking, team coordination and blockers; backend core (events, clubs, departments, RSVP, search, uploads), real-time WebSockets and notifications |
| Ayoub Ouahidi | `AYOUB_LOGIN` | **Product Owner**, Developer | Product vision and priorities, validation of finished work; identity (42 login sync, accounts, roles, permissions), dashboard API and first dashboard |
| Hamza Eljary | `heljary` | Developer | Docker, nginx (HTTPS, routing, rate limiting), monitoring (Prometheus, Grafana), CI, reviews and merges |

## Project Management

- **Work split by area of the application:** student site (Mouad), backend core and real-time (Ahmed), identity and dashboard API (Ayoub), infrastructure (Hamza). Each area had one owner, so every need had a clear person to go to.
- **Git workflow:** one branch per person, changes merged into `Developer` through pull requests reviewed by another member. `Developer` is merged into `master` for releases. GitHub Actions runs on every pull request: backend tests, both Next.js builds, and a secret scan (GitGuardian).
- **Shared documents as the backlog and the contract:**
  - `API_SPEC.md`: the agreed endpoints and JSON shapes between frontend and backend.
  - `frontend/TEAM_NEEDS.md`: what each member needs from the others, with owners, status and decisions.
  - `frontend/DOCS.md`: every frontend step, decision and gotcha.
- **Meetings:** regular syncs on Discord to plan the next steps, unblock each other and agree on decisions. Integration was done in stages: endpoints first, then integration tests, then merging.
- **Communication:** Discord for daily communication and meetings; GitHub pull-request comments for code reviews.

## Technical Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Student frontend | **Next.js 16** (App Router, React 19, TypeScript), Tailwind CSS 4, next-intl, Auth.js v5 | Server-side rendering for fast first pages and SEO; server actions keep tokens on the server; next-intl for 3 languages and RTL |
| Dashboard | **Next.js 16**, React 19, TypeScript, Tailwind CSS 4, Auth.js v5 | Same stack as the student site, so the team shares knowledge and components |
| Backend | **Django 6** + **Django REST Framework**, django-filter, drf-spectacular (OpenAPI) | Mature ORM, admin, authentication and validation out of the box; DRF for a clean REST API with documentation |
| Real-time | **Django Channels** + **Daphne** (ASGI), **Redis** channel layer, JWT for WebSocket auth | WebSockets in the same Django project, so live messages use the same models and permissions |
| Database | **PostgreSQL 16** | Relational data with strong relations (clubs, events, RSVPs, users), transactions and row locks (RSVP capacity is checked under a lock) |
| Reverse proxy | **nginx** | HTTPS (TLS 1.2/1.3), one entry point for both sites, the API and WebSockets, rate limiting |
| Monitoring | **Prometheus**, **Grafana**, node-exporter, cAdvisor | Metrics, dashboards and alert rules |
| Email | SMTP (Brevo relay) | Sign-up verification codes |
| Containers | **Docker Compose** | The whole stack starts with one command |

**Main choices:**
- **Next.js and Django rather than one full-stack framework:** Django gives the data model, permissions and admin we need; Next.js gives server rendering and a modern UI. The Next.js servers call Django on the internal Docker network, so the browser never holds the Django token.
- **PostgreSQL** rather than a document database: the data is relational (a club has events, an event has RSVPs, a user belongs to a club board), and RSVP capacity needs transactions.
- **WebSockets with a short-lived JWT cookie:** the browser can't send headers on a WebSocket, so the student site sets an HTTP-only `ws_access` cookie that Django checks on connect.

## Database Schema

```text
Department 1──* Club 1──* ClubEvent 1──* Rsvp *──1 User
                 │  └── head ─▶ UserMember                │
                 │                                         │ 1
                 └──* ClubBoardAssignment *──1 (one per) ──┤
                                                           │ 1
                          UserMember (profile) 1──1 ───────┤
                          Notification *──1 ───────────────┤
                          AuditLog (actor) *──1 ───────────┘
EmailVerification (pending sign-ups, by email)
```

| Table | Key fields | Relations |
| --- | --- | --- |
| `accounts_user` | `username`, `email` (unique), `password` (hashed, salted: Django PBKDF2), `role` (`STUDENT` / `BOARD_MEMBER` / `SUPERADMIN`), `forty_two_id` (unique), `campus`, `avatar_url`, `phone` | Extends Django's user |
| `ClubBoardAssignment` | — | `user` 1–1 User, `club` *–1 Club: which club a board member manages |
| `EmailVerification` | `email` (unique), `code_hash`, `registration_data` (JSON), `attempts`, `expires_at` | Pending sign-up until the 6-digit code is confirmed |
| `Department` | `title`, `slug` | Has many clubs and events |
| `Club` | `name`, `slug` (unique), `description`, `category` (Tech, Media, Music, Sports, Business, Events Organization, Gaming), `logo`, `banner` (images), `is_active` | `department` *–1 Department, `head` → UserMember (the president / contact) |
| `ClubEvent` | `name`, `description`, `category` (from the club), `capacity`, `starts_at`, `ends_at`, `location`, `status` (planned / cancelled …), `image_path` (flyer) | `club` *–1 Club, `parent_id` *–1 Department |
| `UserMember` | `first_name`, `last_name`, `phone`, `year_of_study`, `image_path` (uploaded photo) | `user` 1–1 User, `department_id` *–1 Department |
| `Rsvp` | `created_at`; unique (`user`, `event`) | `user` *–1 User, `event` *–1 ClubEvent |
| `Notification` | `notification_type` (new event, event updated / cancelled, RSVP confirmed / cancelled, announcement), `title`, `message`, `is_read`, `deduplication_key` (unique) | `recipient` *–1 User, `event` *–1 ClubEvent |
| `AuditLog` | `action`, `target`, `created_at` | `actor` *–1 User: every admin action is recorded |

## Features List

| Feature | What it does | Who |
| --- | --- | --- |
| Event feed | Upcoming events by day, category filters, live updates | Mouad (UI), Ahmed (API) |
| Calendar | Month and week views of club events | Mouad (UI), Ahmed (API) |
| Clubs and club pages | Directory and a page per club with its events, president and contact (contact details only when signed in) | Mouad (UI), Ahmed (API), Ayoub (president / board) |
| Event page and RSVP | Details, flyer, location, places left; RSVP and cancel; refused when the event is full or has ended | Mouad (UI), Ahmed (API) |
| Who's going | Attendee list for signed-in students and for the club's board | Mouad, Ahmed |
| Real-time updates | New, edited or deleted events and RSVP counts appear on open pages without refreshing | Ahmed (server), Mouad (client) |
| Notifications | Bell with unread count, live delivery, mark as read | Ahmed (server), Mouad (client) |
| Search | Search with filters, sorting and pagination; ⌘K palette from any page | Mouad |
| 42 sign-in | OAuth 2.0 with 42, 1337 campuses only | Ayoub (Auth.js + `/auth/sync`), Mouad (student pages) |
| Email sign-up | Email + password, confirmed by a 6-digit code (10 minutes, 5 tries, resend limited) | Ayoub (API), Mouad (pages) |
| Profile | View and edit profile, upload or remove a photo | Mouad (UI), Ayoub (API) |
| Languages | English, French, Arabic with right-to-left layout and a language switcher | Mouad |
| Dashboard: board member | Their club's events (create, edit with flyer, cancel, delete), registrations, board team, club settings (logo, banner, president) | Ayoub (API, first version), Mouad (rework, uploads, president) |
| Dashboard: super admin | Organizations (create, edit, delete, category, logo, banner, president), users (create, edit role, assign to a club, delete), analytics, audit log | Ayoub (API, first version), Mouad (rework) |
| HTTPS and routing | One nginx entry point, HTTP → HTTPS, rate limits on sign-in and API | Hamza |
| Monitoring | Prometheus metrics, Grafana dashboard, alert rules | Hamza |
| Legal pages | Privacy Policy and Terms of Service, in 3 languages | Mouad |

## Modules

**Total: 19 points** (14 required).

| # | Module | Type | Points | Who |
| --- | --- | --- | --- | --- |
| 1 | Web: use a framework for both the frontend and the backend | Major | 2 | All |
| 2 | Web: real-time features using WebSockets | Major | 2 | Ahmed, Mouad |
| 3 | User Management: advanced permissions system | Major | 2 | Ayoub, Mouad |
| 4 | User Management: an organization system | Major | 2 | Ayoub, Mouad |
| 5 | DevOps: monitoring system with Prometheus and Grafana | Major | 2 | Hamza |
| 6 | Web: use an ORM for the database | Minor | 1 | Ahmed, Ayoub |
| 7 | Web: complete notification system | Minor | 1 | Ahmed, Mouad |
| 8 | Web: Server-Side Rendering (SSR) | Minor | 1 | Mouad |
| 9 | Web: custom-made design system | Minor | 1 | Mouad |
| 10 | Web: advanced search with filters, sorting and pagination | Minor | 1 | Mouad |
| 11 | Web: file upload and management system | Minor | 1 | Mouad, Ayoub, Ahmed |
| 12 | User Management: remote authentication with OAuth 2.0 (42) | Minor | 1 | Ayoub, Mouad |
| 13 | Accessibility: support for multiple languages (3) | Minor | 1 | Mouad |
| 14 | Accessibility: right-to-left language support | Minor | 1 | Mouad |
| | | | **19** | |

### How each module was implemented

1. **Frameworks (Next.js + Django).** Both web applications are Next.js (React) apps using its server side (server components, server actions, route handlers). The backend is Django with Django REST Framework. *Why:* server rendering and a typed UI on one side, a mature data and permission layer on the other.
2. **Real-time (WebSockets).** Django Channels with a Redis channel layer. `/ws/calendar/` broadcasts event creations, edits, deletions and RSVP counts to every connected client after the database commit; `/ws/notifications/` delivers each user's own notifications. Clients authenticate with a short-lived JWT cookie, reconnect with backoff, renew an expired token, and refresh the page data on each message. *Why:* a club's change must reach students immediately, which is the point of the platform.
3. **Advanced permissions.** Three roles (`STUDENT`, `BOARD_MEMBER`, `SUPERADMIN`) checked by DRF permission classes on every endpoint and by the dashboard's route guard. Super admins create, view, edit (role, club, active) and delete users; board members only reach their own club; students can't open the dashboard. Each admin action writes an audit-log line. *Why:* clubs must only edit their own events.
4. **Organization system.** Clubs are the organizations. Super admins create, edit and delete them (name, department, category, logo, banner, president, active); users are added to or removed from a club's board; board members read and update their club and create, read, update and delete its events. *Why:* every event belongs to a club, and the club board runs it.
5. **Monitoring.** Prometheus scrapes itself, node-exporter (host) and cAdvisor (containers); alert rules for an instance down, high CPU and high memory; Grafana is provisioned with its data source and a "Campus Hub Infrastructure" dashboard, served at `/grafana/` behind nginx with sign-up and anonymous access disabled.
6. **ORM.** All data goes through Django's ORM (models, migrations, constraints such as one RSVP per user per event, `select_for_update` for RSVP capacity).
7. **Notifications.** Event created, updated, cancelled or deleted, RSVP confirmed or cancelled, and club announcements create notifications, stored in the database and pushed live. Duplicates are prevented with a unique key.
8. **SSR.** Student pages are rendered on the server with the data already in the HTML (feed, event, club, calendar, search), then updated live in the browser.
9. **Design system.** 17 reusable components (Button, Input, Select, Card, Badge, Modal, Tabs, Toast, Avatar, Pagination, FilterChip, Skeleton, EmptyState, ErrorState, LanguageSwitcher, Logo, layout parts), a color palette, typography and icons, shown on `/design-system`.
10. **Advanced search.** `/search` and the ⌘K palette: words matched across name, description, club and location (accents and Arabic vowel marks ignored), filters (category, time range), sorting (relevance or date) and pagination, all computed on the server so the page arrives ready; the URL keeps the state, so results can be shared.
11. **File upload.** Profile photos, event flyers, club logos and banners: type, size (2 MB) and real-image checks in the browser and in Django, preview before saving, upload progress, delete and replace (old files are removed after the database commit), files served by nginx.
12. **OAuth 2.0 (42).** Auth.js with the 42 provider in both apps; Django's `/auth/sync` creates or updates the account and only accepts 1337 campuses.
13. **3 languages.** next-intl with complete English, French and Arabic translations of every user-facing text, and a language switcher.
14. **RTL.** Arabic switches the whole layout to right-to-left (logical CSS properties, mirrored icons and navigation), and switching back is instant.

## Individual Contributions

### Mouad Najjar (`monajjar`): Tech Lead, Developer

- Built the whole **student site**: feed, calendar, clubs, event page with RSVP and who's going, search with ⌘K palette, notifications, profile with photo upload, login and sign-up with email code, legal pages.
- **Design system** (17 components), **3 languages** and **RTL**, server-side rendering, accessibility of the student pages.
- **Real-time client:** WebSocket connection with JWT cookie, reconnection, live refresh of pages.
- **Dashboard rework:** layout and navigation, logout, form errors, uploads of flyers, logos and banners that reach the student site, club president, club categories, future-only event dates, attendee list, login page matching the student site.
- Fixed regressions after integration merges, set up real email (SMTP), reviewed and merged pull requests.
- **Challenges:** integrating three backends written in parallel into one contract (solved with `API_SPEC.md` and `TEAM_NEEDS.md`); live updates that needed a refresh (stale nginx upstreams and a wrong `BACKEND_URL`, fixed in the configuration); Next.js 16 changes (`proxy.ts` instead of `middleware.ts`).

### Ahmed Lahfid (`ahlahfid`): Project Manager, Developer

- Planned and tracked the integration stages and coordinated the backend work.
- **Backend core** (`core_data`): departments, clubs, events, filters, search, pagination, uploads, RSVP with capacity under a database lock, refusal on ended events, attendee list.
- **Real-time** (`realtime`): Channels, Daphne, Redis, WebSocket JWT tokens, calendar and notification consumers, broadcasts after commit; **notifications** app; health endpoints.
- **Challenges:** race conditions on RSVP (two students taking the last place), solved with `select_for_update` inside a transaction; sending broadcasts only after the commit, so clients never see data that was rolled back.

### Ayoub Ouahidi (`AYOUB_LOGIN`): Product Owner, Developer

- Defined the product scope and priorities, validated finished features.
- **Identity:** 42 login (Auth.js) and Django `/auth/sync`, custom `User` model with roles, `/api/me/`, permission classes, email sign-up with verification code.
- **Dashboard API** (`dashboard`): board and super-admin endpoints (users, organizations, board members, stats, analytics, audit log) and the first version of the dashboard.
- **Challenges:** moving to a custom user model in the middle of the project without losing data, keeping 42 accounts and email accounts apart.

### Hamza Eljary (`heljary`): Developer

- **Infrastructure:** Docker Compose for the whole stack, one-command start with `make`, backend entrypoint (migrations, static files).
- **nginx:** HTTPS with generated certificates, routing for both sites, the API, WebSockets and Grafana, rate limits on sign-in and API, Docker DNS resolution so recreated containers are found.
- **Monitoring:** Prometheus, exporters, alert rules, provisioned Grafana dashboard.
- **CI:** GitHub Actions (backend tests, frontend and dashboard builds); reviewed and merged pull requests.
- **Challenges:** routing two Next.js apps, Django and WebSockets behind one nginx with HTTPS; nginx keeping old container addresses after a rebuild, fixed with Docker's DNS resolver.

## Infrastructure

```text
Browser ──HTTPS──▶ nginx (:443, :80 → 301)
                    ├── localhost /            → frontend  (Next.js student site)
                    ├── localhost /api/auth/*  → frontend  (Auth.js)
                    ├── localhost /api/*, /admin/, /ws/ → backend (Django + Daphne)
                    ├── localhost /grafana/    → grafana
                    ├── dashboard.localhost    → dashboard (Next.js)
                    └── /static/, /media/      → served by nginx
backend ──▶ postgres:16, redis:7
prometheus ──▶ node-exporter, cadvisor   grafana ──▶ prometheus
```

- Only nginx publishes ports (80 and 443); every other service is on the internal Docker network.
- Persistent volumes: `postgres_data`, `static_data`, `media_data`, `prometheus_data`, `grafana_data`.
- Rate limits: 5 sign-in callbacks per minute, 10 API requests per second (429 above).
- Uploads up to 10 MB at nginx; images are limited to 2 MB by Django.

## Resources

### References

- Next.js documentation: https://nextjs.org/docs
- React documentation: https://react.dev
- Auth.js documentation: https://authjs.dev
- next-intl documentation: https://next-intl.dev
- Tailwind CSS documentation: https://tailwindcss.com/docs
- Django documentation: https://docs.djangoproject.com
- Django REST Framework: https://www.django-rest-framework.org
- Django Channels: https://channels.readthedocs.io
- drf-spectacular: https://drf-spectacular.readthedocs.io
- PostgreSQL documentation: https://www.postgresql.org/docs/16/
- nginx documentation: https://nginx.org/en/docs/
- Docker Compose documentation: https://docs.docker.com/compose/
- Prometheus documentation: https://prometheus.io/docs/
- Grafana documentation: https://grafana.com/docs/grafana/latest/
- 42 API documentation: https://api.intra.42.fr/apidoc
- WCAG 2.1 quick reference: https://www.w3.org/WAI/WCAG21/quickref/
- MDN, right-to-left and logical properties: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values

### How AI was used

We used AI assistants (such as Claude Code) as helpers, and every change went through a pull request reviewed by another member and the test suite.

- **Frontend (Mouad):** explaining Next.js 16 and Auth.js v5 changes, drafting components and tests, accessibility and translation checks, end-to-end test scripts for the dashboard, debugging (WebSocket and nginx issues), and drafting documentation (`frontend/DOCS.md`, this README).
- **Backend (Ahmed, Ayoub):** reviewing endpoints and permissions, writing test cases (RSVP races, live broadcasts, sign-up codes), and explaining Channels and DRF behaviour.
- **Infrastructure (Hamza):** checking nginx and Prometheus configuration and alert rules.
- **Not delegated:** product decisions, the data model, the architecture and the module choices were decided by the team. Every member can explain the code they merged.

## Known limitations

- The HTTPS certificate is self-signed (local deployment).
- File uploads accept images only (photos, flyers, logos, banners); there is no document upload.
- There is no "forgot password" flow yet; 42 accounts sign in through 42.
- 42 sign-in is limited to 1337 campuses on purpose.
