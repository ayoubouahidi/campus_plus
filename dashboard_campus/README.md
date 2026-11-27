# Campus Hub Dashboard (`dashboard_campus`)

The management app of Campus Hub (1337), served at **https://dashboard.localhost** by the `dashboard` service in `docker-compose.yml`. Students never use it: they see events and RSVP on the student site (`frontend/`, https://localhost).

## Who signs in, and how

- **Email + password, or "Continue with 42".** 42 accounts are synced to Django through `/auth/sync` (same as the student site); only SUPERADMIN and BOARD_MEMBER get in, a 42 student account gets "This 42 account is a student account". The 42 app must list `https://dashboard.localhost/api/auth/callback/42-school` as a redirect URI (it does since 2026-11-27).
- **SUPERADMIN** → `/super_admin`. **BOARD_MEMBER** → `/admin` (their own club only). A **STUDENT** gets "This account is a student account" (Auth.js error code `student_account`); a wrong password gets "Incorrect email or password".
- The route guard is `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`).
- **First super admin on a fresh stack:** `createsuperuser` gives `role=STUDENT`, so set the role too:
  ```bash
  docker exec -it transcendence-backend-1 python manage.py createsuperuser
  docker exec -it transcendence-backend-1 python manage.py shell -c "from accounts.models import User; User.objects.filter(username='<username>').update(role='SUPERADMIN')"
  ```
- **Log out** (sidebar, both areas): revokes the Django token (`POST /api/auth/logout/`), then clears the Auth.js session (`app/actions.ts`).

## Screens

| Area | Page | What it does | Backend |
| --- | --- | --- | --- |
| Super admin | Overview | Counts, organizations, recent admin activity | `/api/superadmin/stats/`, `organizations/`, `roles/distribution/`, `audit-log/` |
| | Organizations | Create, edit (name, **category** (required; all the club's events get it), department, president, logo, banner, active), delete clubs. Inactive clubs are hidden from students. A club with board members can't be deleted (409). | `/api/superadmin/organizations/` |
| | Users & roles | Create, edit, deactivate, delete accounts; choose the role; a board member must belong to one organization. You can't delete or demote yourself. | `/api/superadmin/users/` |
| | Analytics | Events created per week, accounts by role | `/api/superadmin/events/weekly/`, `roles/distribution/` |
| | Audit log | Every dashboard change, 25 per page | `/api/superadmin/audit-log/` |
| Club board | Overview | Upcoming events, RSVPs this month, board team size, RSVPs per day | `/api/board/stats/`, `/api/club-events/?club=<slug>`, `/api/board/registrations/weekly/` |
| | Events | Publish, edit (places, flyer, cancel; the category comes from the club), delete the club's events. Students see changes live. | `/api/club-events/` |
| | Registrations | RSVPs per day and places left per upcoming event | same |
| | Board team | The club's board members | `/api/board/members/` |
| | Club settings | The club's public page (name, meeting day/time, description; no meeting place or contact email: the president is the contact), its **president** (chosen from the board team; signed-in students see their name, email and phone), its **logo and banner** (upload, preview, replace, remove), your photo and phone | `/api/board/club/` (multipart for images), `/api/me/`, `/api/me/avatar/` |

**Images (fixed 2026-11-27):** event **flyers** were silently dropped by the API (`image_path` wasn't a serializer field), so no event ever had one; now saved and shown on the student feed and event page. Club **logo and banner** had no upload anywhere; now the board (Club settings) and the super admin (Organizations form) can upload, replace and remove them (`logo`, `banner`, `remove_logo`, `remove_banner`, multipart). All images: JPEG/PNG/WebP, strictly under 2 MB, real image content (Django validators); a replaced or removed file is deleted after the save commits. Media URLs are `DJANGO_PUBLIC_MEDIA_BASE_URL/media/...` (https://localhost).

**Event times:** a new event, or an edit that moves the start, must start in the future (checked in the form with the browser's time zone, and again by Django in UTC: `starts_at` error). Renaming or cancelling a running event stays allowed.

**President:** `president` (a user id, or empty to clear) on `PATCH /api/board/club/` and the super admin organization PATCH; it must be an active board member of that club. Moving, demoting or deleting the board member ends the presidency. Read back as `president: {id, name, email, phone}`.

**Sign-in rate limit:** nginx allows 5 sign-ins per minute per address (`auth_callback_limit`); the 6th gets 429 and the form says to wait a minute.

**Removed on 2026-11-27 because the platform has no such feature** (students never join clubs; events are published directly): System Settings (no backend), Event Approvals (no backend), Announcements (students never see them), membership "Pending approvals" and the "System Health" card. `/api/board/members/` now returns the club's **board team** (`ClubBoardAssignment`), not student `UserMember` rows.

## How it is built

- **Browser → `/api/backend/<path>` → Django.** `app/api/backend/[...path]/route.ts` adds the user's Django token and only forwards the routes listed in `allowedRoutes`; add a route there when a screen needs a new endpoint. `lib/dashboard-api.ts` calls it without the trailing slash (Next answers `/x/` with a 308) and turns DRF 400 bodies into **field errors**, so each message appears under its field with the red border (`Input`, `Select`, `Textarea` `error` prop), not only in a banner.
- **Layout:** `components/layout/DashboardShell.tsx`: one sidebar for both areas (logo, active page, user, theme, Log out), sticky on desktop, a drawer on phones (Esc closes, focus moves in and back). Menus are in `components/layout/navigation.ts`. Every page uses `PageBody` + `PageHeader` so titles and widths line up.
- **Dialogs:** forms and delete confirmations use `Modal` (focus moves inside, Tab stays inside, Esc closes, focus returns), never `window.confirm`.
- **Design:** the student site's tokens (violet-600 primary, slate surfaces, Geist font, the Campus Hub `Logo`), light and dark. Theme: the `dark` class on `<html>`, set before paint by `THEME_SCRIPT` and read with `useSyncExternalStore` (no hydration mismatch).
- **`cacheComponents` is off** (as on the student site): with it on, Auth.js broke prerendering on every page (`crypto.getRandomValues() while prerendering`).

## Develop and check

```bash
make up                                   # whole stack, then https://dashboard.localhost
docker compose up -d --build dashboard && docker compose restart nginx   # after a change
# Restart nginx after recreating a container: it keeps the old container IPs otherwise.

# Type-check and lint without installing on your machine:
docker run --rm -v "$PWD":/app -v dash_nm:/app/node_modules -w /app node:22-alpine sh -c "npm ci && npx tsc --noEmit && npx eslint ."
```
