# Campus Hub — Frontend Architecture & Engineering Docs

Campus Hub is the event discovery, club management, and RSVP platform for **1337 Coding School** and **EMINES (UM6P)**.
This file is the living engineering record: every component, layout, or utility gets an entry here when it is created or changed.

> **New to the codebase? Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md)**: how the app fits together, where things live, how data and state flow, and a study guide of the React / Next.js concepts used.
> **What the frontend needs from each teammate:** [`TEAM_NEEDS.md`](./TEAM_NEEDS.md).
> Day-to-day usage snippets for the Phase 1 primitives live in [`COMPONENT-USAGE.md`](./COMPONENT-USAGE.md).
> This file covers **why** things are built the way they are.

---

## 1. Architecture Overview

### 1.1 Stack

| Layer      | Choice                                   | Notes                                                          |
| ---------- | ---------------------------------------- | -------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router)                  | Server Components by default; `'use client'` only where needed |
| UI runtime | React 19                                 | `forwardRef` still used for explicit ref contracts             |
| Language   | TypeScript (`strict: true`)              | Path alias `@/*` → `src/*`                                     |
| Styling    | Tailwind CSS v4 (`@tailwindcss/postcss`) | Utility maps in `Record<Variant, string>` lookup tables        |

### 1.2 Directory Layout

```
src/
├── app/                    # App Router routes and layouts (`/` feed since 3.6, `/calendar` 4.6, `/events/[id]` 4.10, `/clubs` 4.13, `/clubs/[slug]` 4.15)
│   └── test/               # Dev-only test page (`/test`) + its demo components: new steps are validated here first (§5.10)
├── components/
│   ├── calendar/           # /calendar feature components (MonthGrid, WeekGrid, DayAgenda, dayStyles, ...)
│   ├── clubs/              # /clubs feature components (ClubCard, ClubDirectory, ...)
│   ├── filters/            # Filter controls shared by several pages (CampusToggle)
│   ├── search/             # ⌘K search palette (SearchPalette)
│   ├── events/             # Event feature components built from the primitives (EventCard, ...)
│   ├── providers/          # App-wide client context (SessionProvider)
│   └── ui/                 # Phase 1 atomic primitives (Button, Badge, Input, ...)
│       └── layout/         # Phase 2 global shell (AppShell, Navbar, MobileNav, Footer, ...)
├── hooks/                  # Reusable React hooks that aren't tied to one component (useDebouncedValue, useDayGridNavigation, useRsvpToast, useCampusSearch)
├── lib/                    # Pure, framework-agnostic logic (navigation config, event filters, mock fixtures)
└── types/                  # Shared contracts (API DTOs, navigation types)
```

**Rule:** `types/` holds shapes, `lib/` holds data and pure functions, `components/` holds rendering.
Shell components import their route data from `lib/`; they never hard-code links.

### 1.3 Scope — Student & Public Web App

This codebase is the **Student & Public Web App**, open to everyone including signed-out visitors.

| Route | Page |
| --- | --- |
| `/` | Discovery feed: heading, department tabs, category pills, event grid |
| `/calendar` | Interactive calendar: month grid and selected-day schedule |
| `/clubs` | Clubs directory |
| `/clubs/[slug]` | Individual club hub: banner, bio, contact, club events |
| `/events/[id]` | Event detail: flyer, description, venue, RSVP |
| `/auth/login` | Student login: 42 Intra (Auth.js; the first login creates the account) or email + password (§7.4–7.6, §11) |
| `/auth/register` | Email sign-up for students without 42, then logged in right away (§11) |
| `/profile` (alias `/me`) | Student profile (Figma design): identity, stats, going / went to, logout. Signed-in only (§7.7–7.8). Avatar upload later |
| `/privacy`, `/terms` | Privacy Policy and Terms of Service (mandatory, subject v21.2), linked from the footer on every page (§9) |

### 1.4 Design Tokens

| Token          | Light                                         | Dark                       |
| -------------- | --------------------------------------------- | -------------------------- |
| Brand          | `violet-600` / hover `violet-700` / ring `violet-500/20` | accent `violet-400` |
| Page surface   | `bg-slate-50`                                 | `bg-slate-950`             |
| Card surface   | `bg-white`                                    | `bg-slate-900`             |
| Border         | `border-slate-200/80`                         | `border-slate-800`         |
| Status         | emerald (success) · amber (warning) · rose (danger) · slate (neutral) | |
| Categories     | Tech `lime` · Media `violet` · Music `indigo` · Sports `teal` · Business `orange` · Gaming `fuchsia` · EventsOrganization `sky` | |

### 1.5 Engineering Laws

1. No `React.FC`; props are annotated in the parameter list.
2. Native interactive/structural wrappers use `React.forwardRef<TElement, TProps>()`.
3. Compound subcomponents over monolithic prop configs.
4. Variants resolved through exhaustive `Record<Variant, string>` tables.
5. Anything touching `window`/`document`/portals declares `'use client'` and uses a mount guard.
6. WAI-ARIA: `useId()` label binding, focus management for overlays, `aria-hidden` on decorative icons, `aria-label` on icon-only buttons.

### 1.5b Development Setup (2026-11-06)

| Command (repo root) | What it does |
| --- | --- |
| `make dev` | Starts everything with `docker-compose.dev.yml`: `./frontend` is mounted into the container, so edits hot-reload in `next dev` (~2 s, no rebuild, no copying). `node_modules` and `.next` stay in the container (anonymous volumes): the host has no `node_modules`. |
| `make up` | Unchanged team default: the image's baked-in copy of the code, no live reload. |
| `make typecheck` | `tsc --noEmit` inside the container. |
| `make lint` | ESLint inside the container (`frontend/eslint.config.mjs`: Next 16 flat config, `core-web-vitals` + `typescript`). |

- **ESLint config** didn't exist before (installed but never configured), so `eslint` always failed. First run: 10 errors + 1 warning, all in existing code, none breaking the build: `react-hooks/purity` for `Date.now()` in the per-request server pages (intentional after `connection()`) and in `useCampusSearch` (real: read during render); `react-hooks/set-state-in-effect` for the `setMounted(true)` mount guards in `Modal`, `MobileNav`, `NotificationPopover` (the pattern CLAUDE.md rule 5 prescribes; modern replacement: `useSyncExternalStore`) and the popover's clock; `no-img-element` in `Avatar`. **Follow-up:** a dedicated lint cleanup (and updating CLAUDE.md rule 5) before making lint a required check. **In progress: §8 (2026-11-20).**
- **`frontend/.dockerignore`** keeps `node_modules`, `.next` and build output out of the image context.
- Run `npm install` for new dependencies inside the container (`docker compose exec frontend npm install <pkg>`), then `make dev` rebuilds the image so the anonymous `node_modules` volume matches.
- **New folder not found (`Module not found: Can't resolve '@/components/<new folder>/…'`) although `tsc` passes?** The dev server's file watcher can miss a folder created on the Mac side of the bind mount. `docker compose restart frontend` fixes it (2026-11-20, `components/legal/`).
- **Replaced an image in `public/` but still see the old one?** Next caches resized images by URL, not content. Rename the file, or run `make clear-images` and hard-refresh (ARCHITECTURE §7.5). Keep source images ≤ ~2000 px: the 77 MB `basketball.png` (8256 px) timed out the optimizer until it was resized to 1600 px (2026-11-06).

### 1.6 Roadmap Status

| Phase | Scope                                 | Status         |
| ----- | ------------------------------------- | -------------- |
| 0–1   | 10 atomic primitives                  | ✅ Done        |
| 2     | Global shell & layout                 | ✅ Done        |
| 3     | Public event feed (`/`)               | ✅ Done (2026-11-02): live at `/` (§5.9). Steps 3.1, 3.2, 3.4, 3.5, 3.6; 3.3 hero dropped (§5.5); loading skeleton moved to Phase 7 (§5.8) |
| 4     | Calendar, event dossier, clubs, search palette | ✅ Done (2026-11-05): `/calendar`, `/events/[id]`, `/clubs`, `/clubs/[slug]`, ⌘K search (§6). 4.11 (event as a modal over the feed) skipped, optional |
| 5     | Student auth & route guards           | 🚧 In progress: 5.1 login page (§7.4), 5.2 Auth.js + real `/auth/login` (§7.5), 5.3 real session site-wide (§7.6), 5.4 `/profile` + guard + logout (§7.7–7.8) |
| 6     | Real-time WebSockets                  | ⏳             |
| 7     | i18n (Arabic RTL) & live API          | 🚧 Languages started (§12, 2026-11-21); live API waits for the merge (TEAM_NEEDS §1c) |

**Phase 2 tasks**

| Task | Deliverable | Status |
| ---- | ----------- | ------ |
| 2.1 | `Navbar.tsx`: brand, links, active route, ⌘K search trigger, session slot | ✅ Done (Steps 1–4) |
| 2.2 | `NotificationPopover.tsx`: floating popover for real-time alerts | ✅ Done (Steps 1–3) |
| 2.3 | `MobileNav.tsx`: bottom tab bar + slide-out drawer | ✅ Done (Steps 1–3) |
| 2.4 | `Footer.tsx`: campus branding, institutional links, legal copy | ✅ Done (Steps 1–2) |
| 2.5 | Root layout integration in `src/app/layout.tsx` (`ToastProvider`, `<main id="main-content">`) | ✅ Done (Steps 1–2) |

---

## 2. Phase 1 — Atomic Primitives (index)

| Component  | Path                              |
| ---------- | --------------------------------- |
| Button     | `src/components/ui/Button.tsx`    |
| Badge      | `src/components/ui/Badge.tsx`     |
| Input      | `src/components/ui/Input.tsx`     |
| Card       | `src/components/ui/Card.tsx`      |
| Avatar     | `src/components/ui/Avatar.tsx`    |
| Select     | `src/components/ui/Select.tsx`    |
| Modal      | `src/components/ui/Modal.tsx`     |
| Tabs       | `src/components/ui/Tabs.tsx`      |
| Toast      | `src/components/ui/Toast.tsx`     |
| Skeleton   | `src/components/ui/Skeleton.tsx`  |
| FilterChip (added in Step 3.4, §5.6) | `src/components/ui/FilterChip.tsx` |
| EmptyState (added in Step 3.5, §5.8) | `src/components/ui/EmptyState.tsx` |

Full entries get added here whenever one of these is modified.

### 2.1 Toast (modified in Task 2.5)

**File:** `src/components/ui/Toast.tsx`

- **`ToastProvider` no longer uses `React.FC`** (Engineering Law 1); props are annotated in the parameter list.
- **Toast stack sits above the mobile tab bar.** Below 768px the container's bottom offset is `calc(4rem + 1px + env(safe-area-inset-bottom) + 1rem)`: the tab bar's height plus a 16px gap. From 768px it's back to `bottom-4`. Without this, toasts on phones landed on top of the tab bar.
- **Known issue, not fixed here:** each `ToastItem` receives a new `onDismiss` arrow on every provider render, so its auto-dismiss timer restarts whenever another toast is added. Fix by passing the id and the stable `dismissToast` instead.

### 2.2 Card (modified in Step 3.2)

**File:** `src/components/ui/Card.tsx`

- **`CardBanner` renders `next/image`** (`fill`, `object-cover`) instead of `<img>`, with a new `sizes` prop (default `'100vw'`) so the browser picks a file close to the rendered width. Remote URLs need `images.remotePatterns` in `next.config.ts` (Phase 7).
- **`CardBanner` `alt` defaults to `''`** (was `'Event banner'`, which tells a screen-reader user nothing). Pass real alt text when the image carries information the surrounding text doesn't.
- **New `CardBanner` `fallback` slot** replaces the default "Campus Hub Event" placeholder when `src` is empty.
- **`CardFooter` padding fixed:** `pt-0` → `pt-4`. With `pt-0`, footer content touched its own `border-t`. The value now matches `CardSkeleton`'s footer.
- **Reduced motion:** `isHoverable` adds `motion-reduce:transition-none motion-reduce:hover:translate-y-0`, and the banner image adds `motion-reduce:group-hover:scale-100`.

### 2.3 Avatar (modified in Step 3.2)

**File:** `src/components/ui/Avatar.tsx`

- **`AvatarGroup` uses `React.forwardRef<HTMLDivElement, AvatarGroupProps>`** instead of `React.FC`, fixing Engineering Laws 1 and 2. Props and behaviour are unchanged.
- **Dark-mode rings are `slate-900`** (the card surface), was `slate-950` (the page surface). Stacks sit on cards, so the ring now blends in instead of drawing a dark outline.
- **`'use client'` added (Step 4.12).** `Avatar` uses `useState` and an `onError` handler, so it must be a Client Component (Engineering Law 5). It only worked before because every caller was already client code; the server-rendered `ClubCard` would have failed.

### 2.4 Modal (modified in Step 4.9)

**File:** `src/components/ui/Modal.tsx`. First real use: the attendee list (§6.9). Changes are backward compatible (no prop changes).

- **Named by its title.** `Modal` creates an id (`useId`) and shares it through a small `ModalContext`; `ModalTitle` reads it, and the dialog surface has `aria-labelledby` pointing at it. Screen readers announce "Who's going (42), dialog" instead of an unnamed dialog. Always render a `ModalTitle`.
- **`role="dialog"` / `aria-modal` moved to the surface** (was on the full-screen wrapper that also held the backdrop).
- **Focus management** (CLAUDE.md §2 rule 6): on open, focus moves to the first focusable element inside (usually the close button) or the surface (`tabIndex={-1}`); Tab / Shift+Tab are trapped with the shared `trapTabKey` (§3.7); on close, focus returns to the element that had it before (the trigger). The focus effect depends only on `isOpen`/`mounted`, so a new `onClose` arrow on each render doesn't move focus.
- **Close button:** `aria-label="Close"` (was "Close modal"), icon `aria-hidden`, visible focus ring.
- **`position?: 'center' | 'top'`** (Step 4.16, default `'center'`): `'top'` anchors the dialog at 12–15vh from the top (`positionStyles: Record<ModalPosition, string>`), so a command palette doesn't jump as its results change height.
- **Known, not fixed:** the scroll-lock/Escape effect lists `onClose` in its deps, so an inline `onClose` re-runs it each render (harmless: it restores and re-applies `overflow: hidden`). The rest of the page isn't made `inert` behind the dialog; `aria-modal` covers screen readers, the focus trap covers keyboards.

---

## 3. Phase 2 — Global Shell & Layout

### 3.1 Navigation Route Contract

**Files:** `src/types/navigation.ts`, `src/lib/navigation.ts`

#### Business & Product Purpose

The same links appear in three places: the desktop `Navbar`, the mobile bottom tab bar, and the slide-out drawer, plus the profile link on the avatar.
This contract is the single source of truth for them, so adding or renaming a page is a one-line edit and all the shells stay in sync.

#### Core Concepts & Engineering Decisions

- **`AppRoute` template-literal union.** Static routes are literals; dynamic ones (`/clubs/${string}`, `/events/${string}`) are template-literal types. A misspelled `href` is a compile error. The union mirrors the route table in §1.3.
- **Icons as names (`NavIconName`), not components.** The config holds plain data with no JSX, so Server Components can import it. Each shell maps names to SVGs with a `Record<NavIconName, …>`, and TypeScript makes that map exhaustive.
- **Explicit match strategy.** `'/'` has to match exactly, otherwise every route would highlight "Discover". Everything else uses segment-aware prefix matching, so `/clubs/robotics` lights up "Clubs" but `/clubsfair` does not.
- **`aliases`.**
  - `/events/[id]` keeps "Discover" highlighted, because event pages are reached from the feed.
  - `/me` highlights "My Profile", because `/me` and `/profile` are the same page.
- **`PROFILE_NAV_ITEM` is separate from `PUBLIC_NAV`.** Profile belongs to the session slot (avatar link), not the main link row. Keeping it separate means shells don't have to filter it out.
- **Accepts a `null` pathname.** `isNavItemActive` treats `null` as "nothing active" and doesn't crash.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Central config in `lib/navigation.ts` | Hard-coded `<Link>`s in each shell | Three shells render the same links. Hard-coding them means they drift apart. |
| Icon **names** in config | `ComponentType<SVGProps>` in config | Component references bind the config to the React/client graph and can't be serialized. Names keep it pure and server-importable. |
| Hand-written `AppRoute` union | Next.js `typedRoutes` (experimental) | No dependency on build-time codegen, and it works in plain `.ts` files and tests. Tradeoff: new routes must be added by hand (one line). |
| `match` + `aliases` fields | Regex patterns per item | Two declarative fields cover every public route. Regex is easy to get subtly wrong (anchors, escaping). |
| Plain `label` strings | i18n keys now | Phase 7 swaps these for translation keys. Adding an i18n layer before it exists would be speculative. |

#### Component Contract

```ts
type AppRoute = '/' | '/calendar' | '/clubs' | `/clubs/${string}` | `/events/${string}`
  | '/auth/login' | '/auth/register' | '/profile' | '/me';   // '/auth/register' removed in Step 5.3 (§7.6), back in Step 11.3 (§11.3)

type NavIconName = 'discover' | 'calendar' | 'clubs' | 'profile';
type NavMatchStrategy = 'exact' | 'prefix';

interface NavItem {
  label: string;
  href: AppRoute;
  icon: NavIconName;
  match: NavMatchStrategy;
  aliases?: readonly string[];   // default: [] — extra prefixes that activate the item
}

const PUBLIC_NAV: readonly NavItem[];
const PROFILE_NAV_ITEM: NavItem;
const LOGIN_NAV_ITEM: NavItem;   // signed-out stand-in for the profile slot

type FooterLink =
  | { kind: 'internal'; label: string; href: AppRoute }
  | { kind: 'external'; label: string; href: `https://${string}` };
interface FooterLinkGroup { id: 'explore' | 'campuses'; title: string; links: readonly FooterLink[] }
const FOOTER_GROUPS: readonly FooterLinkGroup[];   // 'Explore' (derived from PUBLIC_NAV), 'Campuses' (external)
function isNavItemActive(item: NavItem, pathname: string | null): boolean;
```

| Slot | Item | href | match | aliases |
| --- | --- | --- | --- | --- |
| Main links | Discover | `/` | exact | `/events` |
| Main links | Calendar | `/calendar` | prefix | — |
| Main links | Clubs | `/clubs` | prefix | — |
| Avatar link | My Profile | `/profile` | prefix | `/me` |
| Mobile tab bar, signed out | Log in | `/auth/login` | prefix | `/auth` |

#### Usage Example

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_NAV, isNavItemActive } from '@/lib/navigation';

export const PublicLinks = () => {
  const pathname = usePathname();
  return (
    <ul>
      {PUBLIC_NAV.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
```

---

### 3.2 Navigation Icons

**File:** `src/components/ui/layout/navIcons.tsx`

#### Business & Product Purpose

The desktop `Navbar`, the mobile tab bar, and the drawer all show the same icon next to the same link. One shared icon set keeps them visually consistent and avoids pulling in an icon library for four glyphs.

#### Core Concepts & Engineering Decisions

- **`NAV_ICONS: Record<NavIconName, Component>`.** This is the other half of the icon-name design in §3.1. If someone adds a `NavIconName` without a matching icon, the build fails.
- **`IconBase`** holds the shared settings (24×24 viewBox, 1.75 stroke, round caps, `currentColor`), so every icon has the same visual weight and takes its color from the link's text color, including active and hover states.
- **Hidden from screen readers by default.** `aria-hidden="true"` + `focusable="false"` (the latter for legacy Edge/IE SVG focus). The visible link label already names the destination, so the icon is decoration.
- **No `'use client'`.** These are pure render functions, so they work in both Server and Client Components.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Hand-drawn inline SVGs | `lucide-react` / `heroicons` package | Four icons don't justify a dependency. Inline SVGs add no network requests and need no install. Revisit if the icon count grows a lot. |
| `currentColor` stroke | Color props per icon | Icons follow the link's text color automatically, so the active/idle styles stay in one place (the link). |
| `Record` lookup | `switch (name)` component | The `Record` is checked for completeness at compile time and is a constant-time lookup. A `switch` needs a `default` branch that hides missing cases. |

#### Component Contract

```ts
type NavIconProps = React.SVGProps<SVGSVGElement>;   // className default: 'h-5 w-5'
const NAV_ICONS: Record<NavIconName, (props: NavIconProps) => React.JSX.Element>;
```

#### Usage Example

```tsx
import { NAV_ICONS } from '@/components/ui/layout/navIcons';

const Icon = NAV_ICONS['calendar'];
<Icon className="h-4 w-4" />
```

---

### 3.3 Navbar

**File:** `src/components/ui/layout/Navbar.tsx`
**Status:** ✅ Task 2.1 complete (Steps 1–4).

#### Business & Product Purpose

The persistent top bar on every public page. It shows where you are (the active page is highlighted), lets you jump between Discover, Calendar, and Clubs from anywhere, and holds the global actions on the right (search, notifications, account).

#### Core Concepts & Engineering Decisions

- **Compound API.** `Navbar` (layout + sticky surface) › `NavbarBrand` › `NavbarLinks` › `NavbarActions` (right-aligned slot) › `NavbarSearch` and `NavbarSession` (both go inside `NavbarActions`). Pages arrange the pieces; the root doesn't need any config props.
- **Active route via `usePathname()` + `isNavItemActive`.** The active link gets `aria-current="page"`, so screen readers announce "current page", plus a violet pill. Styles come from a `Record<'active' | 'idle', string>`.
- **Skip link.** It's the first tab stop on every page and jumps to `#main-content`, skipping the repeated nav (WCAG 2.4.1). It stays visually hidden until focused. The target `<main id="main-content" tabIndex={-1}>` lives in `AppShell` (§3.9).
- **Landmarks.** `<header>` is the page banner; `<nav aria-label="Main">` is a labeled navigation landmark, so it can be told apart from the footer and mobile navs.
- **Brand link.** `aria-label="Campus Hub home"` gives the accessible name, and the visual text is `aria-hidden` so screen readers don't read "CH Campus Hub 1337 · EMINES".
- **Brand text hides below 360px.** On the smallest phones (320px) only the CH mark fits next to ☰, search, bell and avatar. The link's accessible name (`aria-label`) is unaffected because the visible text was already `aria-hidden`.
- **Desktop only (`hidden md:block`) for links.** On small screens the links move to `MobileNav`'s bottom tab bar (Task 2.3), within thumb reach.
- **`'use client'`** because `usePathname` is a client hook. No mount guard is needed: `usePathname` returns the same value on server and client, so there's no hydration mismatch.
- **`forwardRef`** on all six parts (`HTMLElement`, `HTMLAnchorElement`, `HTMLElement`, `HTMLDivElement`, `HTMLButtonElement`, `HTMLDivElement`), so callers can measure the header height or move focus (e.g. return focus to the search button when the palette closes).
- **`NavbarSearch`: global ⌘K / Ctrl+K.** A `keydown` listener on `window` calls `onOpen`. It calls `preventDefault()` so the browser's own Ctrl+K (focus the address bar) doesn't also fire, ignores `event.repeat` so holding the keys opens once, and fires even inside text fields, matching GitHub/Linear. The listener is removed when the button is `disabled` or unmounts.
- **`NavbarSearch`: platform hint behind a mount guard.** `navigator` doesn't exist on the server, so the server HTML and the first client render both assume `'other'` ("Ctrl"). After mount, `useEffect` detects Mac and switches to "⌘". The `<kbd>` stays `invisible` (keeping its space, so no layout shift) until mounted, so Mac users never see "Ctrl" flash to "⌘", and React never sees a hydration mismatch. Modifier labels come from `Record<Platform, string>`.
- **`NavbarSearch`: ARIA.** `aria-label="Search events and clubs"` names the button even when it's icon-only on small screens. It starts with the visible text "Search events…", so speech-control users can say what they see (WCAG 2.5.3 Label in Name). `aria-haspopup="dialog"` tells screen readers a dialog will open. `aria-keyshortcuts="Meta+K Control+K"` announces the shortcut. The icon and the `<kbd>` hint are `aria-hidden` because the attributes above already say the same thing.
- **`NavbarSession`: three explicit states.** `session` is a discriminated union: `loading` | `signed-out` | `signed-in` (with `user`). TypeScript only lets you read `user` in the signed-in branch, and `loading` exists so a signed-in student never sees "Log in" flash while auth resolves (Phase 5). Loading shows a `Skeleton` circle (hidden from screen readers) plus an `sr-only` "Loading account".
- **`NavbarSession`: signed out.** "Log in" (ghost) and "Sign up" (violet) are `<Link>`s, not `<Button>`s, because they navigate. Their styles mirror Button's `primary`/`ghost` variants through a `Record<AuthLinkVariant, string>`. Below 640px only "Log in" fits next to the brand and search; the login page links to registration.
- **`NavbarSession`: signed in.** A direct link to `PROFILE_NAV_ITEM` (`/profile`) showing the user's `Avatar` (photo, or initials if missing/broken). The link's `aria-label` is "My Profile (Full Name)" and the avatar is `aria-hidden`, so screen readers hear one clear name instead of the image alt text twice. On `/profile` or `/me` the link gets `aria-current="page"` and a violet ring (`Record<LinkState, string>`, same states as the main links). The focus ring uses `ring-offset-2` so it doesn't merge with the active ring.
- **`NavbarSearch`: responsive.** Icon-only below 640px. Wide with label and hint at 640–767px (desktop links are hidden there). Icon-only again at 768–1023px, where the links appear and space is tight. Wide again from 1024px.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Compound subcomponents | `<Navbar links={…} showSearch user={…} />` | A config-prop navbar keeps growing boolean flags. With composition, a page can drop or reorder parts (e.g. hide links on `/auth/*`) without changing `Navbar`. |
| `aria-current="page"` | Only a CSS class for the active link | A class is invisible to assistive tech. `aria-current` is the WAI-ARIA standard and also works as a styling hook. |
| `sticky top-0` + translucent blur | `fixed` header | `sticky` stays in normal document flow, so no `padding-top` hack is needed on `<body>` and there's no layout shift when it mounts. |
| Whole file `'use client'` | Server `Navbar` + client-only `NavbarLinks` file | The shell is small, and splitting files would save almost no bundle size. Revisit if the brand/actions grow server-only data fetching. |
| Hard-wired to `PUBLIC_NAV` | `items` prop on `NavbarLinks` | There's exactly one public nav. A prop would add a second source of truth. |
| `NavbarSearch` only fires `onOpen` | Button owns the search dialog itself | Trigger and palette are separate concerns. The palette can be built (and lazy-loaded) later without touching the navbar, and other triggers (e.g. the mobile drawer) can open the same palette. Tradeoff: `onOpen` is a function, which a Server Component can't pass, so Task 2.5 needs a small client wrapper that owns the open state. |
| Listener on `window` in the button | Separate `useHotkey` hook / hotkey library | One shortcut doesn't justify a dependency or an abstraction. Extract a hook if a second global shortcut shows up. |
| Mount guard (`useState(false)` + `useEffect`) for the hint | Read `navigator` during render / `suppressHydrationWarning` | Reading `navigator` during render crashes on the server. `suppressHydrationWarning` only hides the warning; the text would still be wrong until React patches it. The guard keeps server and client output identical. |
| `session` discriminated union | `user?: User \| null` (undefined = loading) | `undefined` meaning "loading" is invisible at the call site and easy to pass by accident. Named states are self-documenting and TypeScript blocks reading `user` when signed out. |
| Avatar links straight to `/profile` | Avatar dropdown menu (Profile, Settings, Log out) | §1.3 puts logout on the profile page, so a menu would hold one item. A dropdown also needs focus trapping, arrow keys and outside-click handling. Revisit if account actions grow. |
| Auth links styled locally | Wrapping `<Button>` in `<Link>` / adding `asChild` to Button | A `<button>` inside an `<a>` is invalid HTML and confuses screen readers. An `asChild`/polymorphic Button is a Phase 1 API change for two links; the duplication is two class strings. |
| Shortcut fires inside text fields | Skip when focus is in an input | ⌘K isn't a typing key, and users expect it to work everywhere. Ctrl+K in a text field otherwise does nothing useful in most browsers. |

#### Component Contract

```ts
type NavbarProps        = React.HTMLAttributes<HTMLElement>;                         // ref: HTMLElement (<header>)
type NavbarBrandProps   = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>; // ref: HTMLAnchorElement, href fixed to '/'
type NavbarLinksProps   = React.HTMLAttributes<HTMLElement>;                         // ref: HTMLElement (<nav>)
type NavbarActionsProps = React.HTMLAttributes<HTMLDivElement>;                      // ref: HTMLDivElement
interface NavbarSearchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {     // ref: HTMLButtonElement
  onOpen: () => void;   // required; fired on click and on ⌘K / Ctrl+K. Pass a stable (useCallback) function.
  disabled?: boolean;   // default: undefined; also turns the keyboard shortcut off
}
type NavbarSessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User };                                             // User from '@/types/api'
interface NavbarSessionProps extends React.HTMLAttributes<HTMLDivElement> {           // ref: HTMLDivElement
  session: NavbarSessionState;   // required
}
// All accept className (default '') which is appended after the base styles.
```

#### Usage Example

```tsx
'use client';
import { useCallback, useState } from 'react';
import {
  Navbar, NavbarBrand, NavbarLinks, NavbarActions, NavbarSearch, NavbarSession,
} from '@/components/ui/layout/Navbar';

const [isSearchOpen, setIsSearchOpen] = useState(false);
const openSearch = useCallback(() => setIsSearchOpen(true), []);

<Navbar>
  <NavbarBrand />
  <NavbarLinks />
  <NavbarActions>
    <NavbarSearch onOpen={openSearch} />
    {/* notifications (Task 2.2) */}
    <NavbarSession session={{ status: 'signed-in', user }} />
  </NavbarActions>
</Navbar>
<main id="main-content">…</main>
```

---

### 3.4 NotificationPopover

**Files:** `src/components/ui/layout/NotificationPopover.tsx`, `src/types/notification.ts`, `mockNotifications` in `src/lib/mockData.ts`, `BellIcon` and the exported `IconBase` in `navIcons.tsx`, `src/lib/time.ts` (§3.5)
**Status:** ✅ Task 2.2 complete (Steps 1–3).

#### Business & Product Purpose

Students miss changes to events they care about: a venue moves, an event is cancelled, a new hackathon opens RSVPs. The bell in the navbar shows how many unread alerts there are from any page, and (from Step 2) opens a panel listing them, without leaving the page they're on.

#### Core Concepts & Engineering Decisions

- **`AppNotification` contract.** `kind` reuses `WebSocketEventType` (`event_created` | `event_updated` | `event_deleted`) from `types/api.ts`, so the socket payload (Phase 6) and the UI share one set of names. `href` is an `AppRoute`, so a notification can only link to a real route. Fields are snake_case like the other API DTOs.
- **Compound API with Context.** `NotificationPopover` (root) holds the open/closed state in React Context; `NotificationTrigger` reads it, and `NotificationPanel` (Step 2) will too. The context hook throws a clear error if a part is used outside the root, same pattern as `Tabs`.
- **Data is passed in; only open/closed is owned.** The root takes `notifications` as a prop and derives `unreadCount` with `useMemo`. Fetching, WebSocket updates and persisting read state belong to the caller (Phase 6): the popover only *reports* reads through `onMarkRead(id)` / `onMarkAllRead()`, so it stays a pure view.
- **Trigger ARIA.**
  - The badge is `aria-hidden`, so the count goes into the accessible name: "Notifications, 3 unread" (or just "Notifications").
  - `aria-haspopup="dialog"` + `aria-expanded` tell screen readers it opens a panel and whether it's open.
  - `aria-controls` points at the panel's `useId()` id **only while open**, because pointing at an element that isn't in the DOM is invalid.
- **Badge.** Rose (the danger/attention token), capped at "99+" so it never grows wider than three characters. `ring-2 ring-white` (dark: `ring-slate-950`) cuts it out from the bell.
- **Caller's `onClick` runs first.** If the caller calls `event.preventDefault()`, the toggle is skipped, so callers can intercept the click (e.g. for analytics or a signed-out redirect).
- **Mount guard on the panel.** `NotificationPanel` touches `document` (listeners, `activeElement`, focus), so it uses `useState(false)` + `useEffect` and renders nothing until mounted. The trigger touches no browser APIs and needs no guard.
- **Panel = `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.** It's named by its "Notifications" heading (`useId()` id). `aria-modal` matches the behaviour: while open, keyboard focus can't leave it, so screen readers shouldn't wander into the page behind either.
- **Focus management (WAI-ARIA dialog pattern).**
  - On open, focus moves to the first notification, or to the panel itself (`tabIndex={-1}`) when the list is empty.
  - **Focus trap** (`trapTabKey`, §3.7): Tab on the last item wraps to the first; Shift+Tab on the first wraps to the last.
  - **Esc** closes and returns focus to the bell, so keyboard users land where they started.
  - **Outside press** (`pointerdown` outside the popover root) closes *without* moving focus, because the user just pointed somewhere else on purpose.
  - Clicking a notification closes the panel and lets the link navigate.
- **Merged refs.** The trigger, panel and root each keep an internal ref (focus return, trap, outside-click check) and still forward the caller's ref, via `useMergedRef` (§3.7).
- **Positioning without a library.** From 640px the panel is `absolute right-0 top-full` under the bell, 384px wide. Below that it's `fixed inset-x-4` under the navbar, because a 384px panel anchored at the bell would run off the left edge of a phone. The list scrolls internally (`max-h` + `overflow-y-auto`).
- **Mark as read.**
  - Clicking an unread notification calls `onMarkRead(id)`, closes the panel and navigates.
  - "Mark all as read" appears in the header only when `onMarkAllRead` is passed and something is unread. Activating it removes the button itself, so focus is moved to the panel first; otherwise it would drop to `<body>` and escape the trap.
  - On open, focus goes to the first *notification* (`data-notification-item`), not to the header button, so reading starts with the newest alert.
- **Kind icons.** `KIND_STYLES: Record<NotificationKind, { icon, tone }>` maps each kind to an icon and colour: created = violet calendar-plus, updated = amber pencil, cancelled = rose calendar-x. The `Record` is exhaustive, so a new socket event type fails the build until it has an icon. Icons are `aria-hidden`; the title text already says what happened.
- **Relative times without hydration risk.** Each item shows `<time dateTime={iso} title={exact date}>4 weeks ago</time>` (§3.5). "Now" differs between server and browser, which normally causes hydration mismatches, but the panel never renders on the server (mount guard), so there is nothing to mismatch. `now` is refreshed on open and every 60 seconds while open, and the interval is cleared on close.
- **Live announcements.** The root always renders a visually hidden `role="status"` / `aria-live="polite"` region.
  - An effect compares the new list against the ids it saw last time; unread arrivals are announced ("New notification: <title>" or "3 new notifications"). This works with the panel closed.
  - The first list after mount is not announced, so reloading the page is silent.
  - Each announcement is rendered with a new `key`, so the same text arriving twice is still read twice.
- **Empty state.** A grey bell, "You're all caught up", and one line explaining what will appear.
- **Read/unread styling** comes from three `Record<'unread' | 'read', string>` tables (row background, dot, title weight). The dot is `aria-hidden`; unread state is spoken through an `sr-only` "Unread: " prefix.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Compound parts + Context | `<NotificationBell notifications={…} />` monolith | The panel, trigger and (later) mobile drawer entry need the same state. Composition lets the mobile nav (Task 2.3) reuse the trigger or panel without a pile of config props. |
| React Context | Zustand/Redux store | State is local to one popover instance. A store would add a dependency and make the popover a global singleton. The Phase 6 notification feed can still live wherever it wants and pass data in. |
| `notifications` prop (controlled data) | Popover fetches/subscribes itself | Keeps the UI testable with fixtures (this bench) and keeps networking out of a view component. |
| Uncontrolled open state | `open` / `onOpenChange` props | Nothing outside needs to open the panel yet. Adding controlled props later is backward compatible. |
| `kind` = `WebSocketEventType` | Separate notification enum | One source of truth; a new socket event type forces the UI to handle it at compile time once Step 3 maps kinds to icons with a `Record`. |
| Inline panel inside the navbar | `createPortal` to `<body>` (like `Modal`) | Inline keeps DOM order = tab order and lets the panel sit next to the bell with plain CSS. A portal needs coordinate math (or Floating UI) to follow the bell. The navbar has no `overflow: hidden`, so nothing clips it. |
| Hand-written focus trap | `focus-trap-react` / Radix Popover | ~25 lines vs. a dependency. Extracted to `lib/focus.ts` once the mobile drawer needed it too (§3.7). |
| `pointerdown` outside to close | `click` / `mousedown` / invisible backdrop | `pointerdown` fires once for mouse, touch and pen, and before focus moves. A backdrop would swallow the first click on the page instead of letting it through. |
| `aria-modal="true"` with outside-click dismissal | Non-modal popover (no trap) | Your rules require popovers to trap focus; `aria-modal` keeps screen-reader browsing consistent with that trap. |
| Click marks as read + "Mark all as read" | A per-item "mark read" button | A button inside the link is invalid HTML; a sibling button doubles the tab stops per item. Opening a notification is the natural "I've seen it" signal. |
| Own `aria-live` region in the popover | Announce through the `Toast` system | Toasts are visual and time out; this is for screen readers only and must work before `ToastProvider` is wired up (Task 2.5). Phase 6 can add visible toasts on top. |
| Diff by ids to detect arrivals | Compare `unreadCount` before/after | A count can stay the same when one item is read and another arrives at once. Ids say exactly *what* arrived, so the announcement can name it. |
| Client-only relative time | Server-rendered time + `suppressHydrationWarning` | The panel is client-only anyway; this avoids both the mismatch and stale server timestamps. |
| Count in `aria-label` | Visible text + `aria-describedby` | The bell is icon-only; the label is the one place the count can be announced. Live announcements of *changes* come in Step 3 via a live region. |

#### Component Contract

```ts
interface AppNotification {
  id: string;
  kind: 'event_created' | 'event_updated' | 'event_deleted';   // = WebSocketEventType
  title: string;
  body: string;
  href: AppRoute;
  created_at: string;   // ISO 8601
  is_read: boolean;
}

interface NotificationPopoverProps extends React.HTMLAttributes<HTMLDivElement> {   // ref: HTMLDivElement
  notifications: readonly AppNotification[];   // required, newest first
  onMarkRead?: (id: string) => void;            // default: undefined (clicking doesn't change read state)
  onMarkAllRead?: () => void;                   // default: undefined (no "Mark all as read" button)
}

type NotificationTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;   // ref: HTMLButtonElement
// onClick runs before the toggle; call event.preventDefault() to cancel it.

type NotificationPanelProps = React.HTMLAttributes<HTMLDivElement>;   // ref: HTMLDivElement
// onKeyDown runs before the focus trap; preventDefault() skips the trap for that key.
// Renders nothing until mounted and while closed.
```

#### Usage Example

```tsx
import {
  NotificationPopover, NotificationTrigger, NotificationPanel,
} from '@/components/ui/layout/NotificationPopover';

<NavbarActions>
  <NavbarSearch onOpen={openSearch} />
  <NotificationPopover notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead}>
    <NotificationTrigger />
    <NotificationPanel />
  </NotificationPopover>
  <NavbarSession session={session} />
</NavbarActions>
```

---

### 3.5 Relative Time Formatting

**File:** `src/lib/time.ts`

#### Business & Product Purpose

"Venue changed 3 hours ago" tells a student how fresh an alert is at a glance; a full timestamp doesn't. Used by the notification panel now, and later by event cards and the calendar.

#### Core Concepts & Engineering Decisions

- **`formatRelativeTime(iso, now)`** picks the largest unit that fits (year → minute) and formats with `Intl.RelativeTimeFormat` (`numeric: 'auto'`, so "yesterday" and "last week" instead of "1 day ago"). Under 45 seconds it says "just now".
- **`now` is a parameter.** The function is pure: the caller decides when time moves (the panel ticks every minute) and tests can pass a fixed clock.
- **`formatAbsoluteTime(iso)`** gives the exact date and time ("Sep 24, 2026, 4:45 PM") for tooltips.
- **Formatters are created once** at module level; constructing `Intl` formatters is relatively expensive.
- **Locale is `'en'`** until Phase 7 passes the active locale.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Native `Intl.RelativeTimeFormat` | `date-fns` / `dayjs` | Built into every supported browser and Node, zero bundle cost, and already localized for Arabic in Phase 7. |
| `now` as an argument | Read `Date.now()` inside | Reading the clock inside makes output depend on *when* it runs (server vs browser) and makes tests flaky. |
| Calendar-agnostic unit lengths (30-day month) | Exact calendar diff | For "how long ago" text, ±1 day of precision doesn't matter; exact diffs need a date library. |

#### Component Contract

```ts
function formatRelativeTime(iso: string, now: number): string;   // 'just now' | '5 minutes ago' | 'yesterday' | …
function formatAbsoluteTime(iso: string): string;                 // 'Sep 24, 2026, 4:45 PM'
```

#### Usage Example

```tsx
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/time';

<time dateTime={iso} title={formatAbsoluteTime(iso)}>
  {formatRelativeTime(iso, Date.now())}
</time>
```

---

### 3.6 MobileNav

**File:** `src/components/ui/layout/MobileNav.tsx` (plus `LOGIN_NAV_ITEM` in `src/lib/navigation.ts`, `MenuIcon`/`CloseIcon` in `navIcons.tsx`, `animate-drawer-in`/`animate-fade-in` in `globals.css`)
**Status:** ✅ Task 2.3 complete (Steps 1–3).

#### Business & Product Purpose

Most students open Campus Hub on their phone. Below 768px the navbar hides its links, so the main pages need another home. A bottom tab bar puts Discover, Calendar, Clubs and the account within thumb reach and shows where you are at all times. The burger drawer (Step 2) holds everything else.

#### Core Concepts & Engineering Decisions

- **Same source as the navbar.** Tabs come from `PUBLIC_NAV` + one account item, active state from `isNavItemActive`, icons from `NAV_ICONS`. Renaming a page in `lib/navigation.ts` updates the navbar and the tab bar together.
- **Account tab follows the session.** `accountTab: Record<SessionStatus, NavItem | null>`:
  - `signed-in` → My Profile (`/profile`)
  - `signed-out` → Log in (`/auth/login`, alias `/auth` so the register page also highlights it)
  - `loading` → `null`, and a skeleton holds the 4th slot so the other tabs don't shift and "Log in" never flashes for a signed-in student.
- **One "Main" landmark at a time.** The tab bar is `<nav aria-label="Main">` with `md:hidden`; the navbar's links are `hidden md:block`. `display: none` removes an element from the accessibility tree, so screen readers always find exactly one main navigation.
- **Active tab.** `aria-current="page"` plus a violet pill behind the icon and a bold violet label (Material 3 style). Styles come from `Record<'active' | 'idle', string>` tables. Icons are `aria-hidden`; the visible label is the accessible name.
- **Touch targets.** Each tab fills a quarter of a 64px-tall bar (well above the 44×44px minimum). The grid is capped at 448px (`max-w-md`), so on wide phones and small tablets the tabs stay together instead of stretching edge to edge.
- **iPhone home indicator.** `pb-[env(safe-area-inset-bottom)]` pads the bar above the home indicator. This only takes effect once the root layout sets `viewport-fit=cover` (Task 2.5: `export const viewport: Viewport = { viewportFit: 'cover' }`); until then it's 0, which is harmless.
- **Pages reserve the space with `MobileTabBarSpacer`.** The bar is `fixed`, so the end of the page would hide behind it. `<MobileTabBarSpacer />` goes last in the shell (after the footer): an `aria-hidden` block, phone-only (`md:hidden`), exactly the bar's height (64px + 1px border + `env(safe-area-inset-bottom)`). It replaced the original plan of `pb-16` on `<main>`, which stopped working once the footer became the last element on the page. Task 2.5 places it in the root layout.
- **`'use client'`** for `usePathname`. The tab bar needs no mount guard (no browser APIs during render); the drawer does (below).
- **Drawer: compound parts.** `MobileNav` is a state-only provider (no DOM) that wraps the whole shell, because the burger (`MobileNavTrigger`) lives inside the `Navbar` while the `MobileNavDrawer` is portalled to `<body>`. Both read the same context; using either outside `<MobileNav>` throws a clear error.
- **Drawer: portal + mount guard.** The navbar has `backdrop-blur`, and a `backdrop-filter` makes an element the containing block for `fixed` children, so a drawer rendered inside the header would be clipped to the header. `createPortal(…, document.body)` avoids that. Portals need `document`, so the drawer renders nothing until mounted (`useState(false)` + `useEffect`).
- **Drawer: dialog pattern.** `role="dialog"`, `aria-modal="true"`, named by its "Menu" heading. Inside, the links are a separate `<nav aria-label="Pages">` landmark.
  - On open, focus goes to the ✕ button (labelled "Close menu"), a predictable first stop.
  - **Focus trap** via the shared `trapTabKey` (§3.7).
  - **Esc, the backdrop and ✕** all close and return focus to the burger. Tapping a link closes it and navigates.
  - **Scroll lock**: `body { overflow: hidden }` while open, restored to its previous value on close.
  - **Auto-close at md+** via `matchMedia('(min-width: 768px)')`: if the window grows past the phone breakpoint while open, the drawer (which is `md:hidden`) closes so the scroll lock is never left on behind an invisible drawer.
- **Burger ARIA.** "Open menu", `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls` only while the drawer exists, same pattern as the notification bell.
- **Drawer content.** `PUBLIC_NAV` links (active one highlighted with `aria-current`), then an account section driven by `session`: avatar + name + "My Profile · email" when signed in, "Log in" / "Sign up" when signed out, skeleton rows while loading. A `children` slot under it takes the footer links in Task 2.4.
- **Entrance animation.** Slide-in from the left (`animate-drawer-in`) and backdrop fade (`animate-fade-in`), 200ms, defined as Tailwind v4 `@theme` keyframes in `globals.css`. Closing is instant: an exit animation needs the element to stay mounted until the animation ends, which isn't worth the extra state yet.
- **Closes on any route change.** The `MobileNav` provider compares `usePathname()` with the last path it saw and closes when it differs. That covers browser Back/Forward and programmatic navigation, not just link taps. It uses React's "adjust state during render" pattern rather than an effect, so the new page never paints for a frame with the drawer still open.
- **Reduced motion.** The slide-in and backdrop fade carry `motion-reduce:animate-none`: with the OS/browser "reduce motion" setting on, the drawer simply appears. Colour transitions on hover stay, since they don't move anything.
- **Verified in a real browser engine.** Headless Firefox screenshots at 320 / 360 / 375 / 768px. 320px overflowed (avatar cut off) until the navbar brand dropped its text below 360px (§3.3).
- **Phone navbar width.** At 375px the navbar fits ☰ + logo + search + bell + avatar (signed in) or ☰ + logo + search + "Log in" (signed out). That assumes the bell is only rendered for signed-in users, which also makes sense on its own: signed-out visitors have no notifications. Task 2.5 composes it that way.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Tab bar **and** drawer | Burger drawer only | The 4 most-used destinations stay one tap away and always visible; the drawer holds the rest. Matches what students know from Instagram/LinkedIn. Cost: some vertical space on small screens. |
| `fixed` bottom bar | `sticky` at the end of the page | `sticky` bottom only works while its container is in view; `fixed` is reliably pinned. Trade-off: the page needs a spacer at its end (`MobileTabBarSpacer`). |
| `sessionStatus` prop | Whole `session` object / reading an auth context | The bar only needs the status. A prop keeps it testable now; Phase 5 can pass it from the auth context. |
| `LOGIN_NAV_ITEM` in the shared config | Hard-coded "Log in" link in the tab bar | Same `NavItem` shape means the same active logic, icon lookup and route typing. |
| Inline skeleton for loading | Hide the 4th tab while loading | Hiding it would make the grid jump from 3 to 4 columns when auth resolves. |
| State-only `MobileNav` provider | Drawer owns its state, burger gets an `onOpen` prop | The burger and drawer live in different DOM trees (header vs `<body>`). A provider connects them without the page wiring callbacks, and gives the drawer the burger's ref for focus return. |
| Portal to `<body>` | Render inside the navbar | The navbar's `backdrop-filter` would clip a `fixed` drawer to the header. A portal also keeps the drawer above every stacking context. |
| Slide-in from the left | Slide-in from the right / full-screen sheet | The burger is on the left, so the panel grows out of the button that opened it. 85vw (max 320px) leaves a strip of the page visible, which signals "tap outside to close". |
| `overflow: hidden` scroll lock | `position: fixed` body lock / `body-scroll-lock` library | Simple and enough for Android and modern iOS (16+). Older iOS can still rubber-band the page; a library would fix that if testing shows a problem. |
| No exit animation | Keep mounted until a close animation ends | Adds a "closing" state and `animationend` handling. Instant close feels fine for a menu; revisit with the Step 3 motion work if needed. |
| Close via state adjustment during render | `useEffect(() => close(), [pathname])` | The effect runs after paint, so the next page would flash with the drawer open. Adjusting state during render is React's documented pattern for "reset state when a prop changes". |
| Browser Back navigates (drawer closes as a side effect) | Push a history entry on open so Android Back closes the drawer | Faking history entries breaks Back for keyboard and desktop users and is easy to get out of sync. Revisit if phone testing shows users expecting Back to close the menu. |
| `motion-reduce:` per element | Global `@media (prefers-reduced-motion)` override in CSS | Explicit at the element that animates, visible in review, and doesn't silently disable animations someone adds later on purpose. |
| `MobileTabBarSpacer` at the end of the shell | `padding-bottom` on `<main>` or `<body>` | Padding on `<main>` misses the footer below it. Padding on `<body>` works but hides the coupling in global CSS; a named component next to `<MobileTabBar />` documents why the space exists. |
| `matchMedia` auto-close | Ignore resizes | Without it, rotating a tablet or resizing a window could leave the page scroll-locked behind a hidden drawer. |

#### Component Contract

```ts
interface MobileTabBarProps extends React.HTMLAttributes<HTMLElement> {   // ref: HTMLElement (<nav>)
  sessionStatus: 'loading' | 'signed-out' | 'signed-in';   // required; = NavbarSessionState['status']
}

interface MobileNavProps {          // state-only provider, no ref
  children: React.ReactNode;        // must contain MobileNavTrigger and MobileNavDrawer
}

type MobileNavTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;   // ref: HTMLButtonElement
// onClick runs before opening; event.preventDefault() cancels it.

interface MobileNavDrawerProps extends React.HTMLAttributes<HTMLDivElement> {   // ref: HTMLDivElement (the dialog)
  session: NavbarSessionState;      // required; drives the account section
  children?: React.ReactNode;       // default: none; rendered under the account section (footer links)
}
// onKeyDown runs before the focus trap. Renders nothing until mounted and while closed.

type MobileTabBarSpacerProps = React.HTMLAttributes<HTMLDivElement>;   // ref: HTMLDivElement; aria-hidden, md:hidden
```

#### Usage Example

```tsx
import {
  MobileNav, MobileNavTrigger, MobileNavDrawer, MobileTabBar, MobileTabBarSpacer,
} from '@/components/ui/layout/MobileNav';

<MobileNav>
  <Navbar>
    <MobileNavTrigger />
    <NavbarBrand />
    <NavbarLinks />
    <NavbarActions>…</NavbarActions>
  </Navbar>

  <main id="main-content">…</main>
  <Footer>…</Footer>

  <MobileTabBarSpacer />

  <MobileTabBar sessionStatus={session.status} />
  <MobileNavDrawer session={session}>{/* footer links (Task 2.4) */}</MobileNavDrawer>
</MobileNav>
```

---

### 3.7 Shared Overlay Helpers

**Files:** `src/lib/focus.ts`, `src/lib/refs.ts`

#### Business & Product Purpose

Every overlay (notification panel, mobile drawer, and later the search palette and RSVP dialogs) must behave the same way for keyboard and screen-reader users. One implementation means one place to fix bugs and one behaviour to learn.

#### Core Concepts & Engineering Decisions

- **`trapTabKey(event, container)`.** Call it from an overlay's `onKeyDown`. On Tab from the last focusable element it wraps to the first; on Shift+Tab from the first (or from the container itself) it wraps to the last; with nothing focusable it blocks Tab entirely. It accepts any event with `key`, `shiftKey` and `preventDefault`, so it works with React and native events.
- **`FOCUSABLE_SELECTOR`.** Links with `href`, enabled buttons/inputs/selects/textareas, and anything with a non-negative `tabindex`.
- **`useMergedRef(a, b)`.** Returns one callback ref that writes to both a forwarded ref and an internal one, so a component can forward its ref *and* keep its own handle for focus return or outside-click checks. Memoized on the two refs so React doesn't detach/reattach on every render.
- **Extracted when the second user appeared.** Both lived inside `NotificationPopover` first (§3.4); the mobile drawer (§3.6) was the second consumer.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Plain function called from `onKeyDown` | `useFocusTrap(ref, isActive)` hook | Each overlay already owns its keydown handler (and lets callers' `onKeyDown` run first). A function composes into that; a hook would need its own listener and options to skip. |
| Query focusables on every Tab | Cache the list on open | Content changes while open (e.g. "Mark all as read" disappears). Querying a small panel per keypress is cheap and always correct. |
| Own helpers | `focus-trap` / `@radix-ui/react-compose-refs` | ~40 lines total, no dependencies, and behaviour we fully control. |
| Lives in `lib/` | `components/ui/` | No rendering: `lib/` holds logic per §1.2. `refs.ts` is a React hook, but it is still logic, not UI. |

#### Component Contract

```ts
const FOCUSABLE_SELECTOR: string;
function trapTabKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>, container: HTMLElement): void;
function useMergedRef<T>(first: React.Ref<T> | undefined, second: React.Ref<T> | undefined): (node: T | null) => void;
```

#### Usage Example

```tsx
const panelRef = useRef<HTMLDivElement>(null);
const setPanelRef = useMergedRef(forwardedRef, panelRef);

<div
  ref={setPanelRef}
  role="dialog"
  aria-modal="true"
  onKeyDown={(event) => panelRef.current && trapTabKey(event, panelRef.current)}
>
  …
</div>
```

---

### 3.8 Footer

**Files:** `src/components/ui/layout/Footer.tsx`, `FooterLink` / `FooterLinkGroup` in `src/types/navigation.ts`, `FOOTER_GROUPS` in `src/lib/navigation.ts`, `ExternalIcon` in `navIcons.tsx`
**Status:** ✅ Task 2.4 complete (Steps 1–2).

#### Business & Product Purpose

The bottom of every page answers "what is this and who is it for?": the Campus Hub brand and a one-line description, the main sections again for people who scrolled to the end, links to the real institutions (1337, EMINES, UM6P, 42 Network), and the copyright line.

#### Core Concepts & Engineering Decisions

- **Server Component.** No hooks, no browser APIs, no `'use client'`. Rendered from a Server Component (the root layout in Task 2.5) it ships zero JavaScript. Inside a client page (like the bench) it simply renders on the client too.
- **Compound API.** `Footer` (the `<footer>` landmark and grid) › `FooterBrand` › `FooterNav` › `FooterLegal`. Pages can drop or reorder parts without changing the root.
- **Typed link kinds.** `FooterLink` is a discriminated union. `internal` links must be an `AppRoute` and render with `next/link`. `external` links must be `https://…` and render as `<a target="_blank" rel="noopener noreferrer">`, with a `↗` icon (`aria-hidden`) and an `sr-only` "(opens in a new tab)" so nobody is surprised by a new tab (WCAG 3.2.5).
- **"Explore" derived from `PUBLIC_NAV`.** The footer's internal links are mapped from the same config as the navbar, tab bar and drawer, so they can't drift.
- **Landmarks and headings.** `<footer>` is the page's `contentinfo` landmark. Inside, `<nav aria-label="Footer">` is distinct from "Main" and "Pages". Each column title is an `<h2>`, so screen-reader users can jump between columns by heading.
- **Layout.**
  - From 768px: brand column (1.5fr) next to the link columns (2fr), legal line spanning the full width below.
  - Below 768px: stacked, with the two link columns still side by side.
  - The legal line's two sentences stack below 640px and split left/right above.
- **`compact` variant for the mobile drawer.** `FooterNav` and `FooterLegal` take `variant: 'full' | 'compact'`, resolved through `Record<FooterVariant, …>` tables (layout, title colour, list spacing, legal line).
  - `compact` is single-column with grey group titles, and the legal line drops its second sentence and border.
  - **Heading level follows the context:** `Record<FooterVariant, 'h2' | 'h3'>`. On the page the group titles are `h2`; inside the drawer they're `h3` under its "Menu" `h2`, so the heading outline stays correct.
  - `FooterNav` also takes `groups` (default `FOOTER_GROUPS`). The drawer passes the groups minus `id: 'explore'`, because its top section already lists those pages. Groups carry a stable `id` so filtering doesn't depend on display titles.
  - Callers can override the landmark name; the drawer uses `aria-label="Campus links"`.
- **Year from the server.** `new Date().getFullYear()` runs where the footer renders. As a Server Component there is nothing to hydrate. Inside a client tree the server and browser could only disagree in the seconds around New Year.
- **Verified** with headless Firefox screenshots at 375px and 1280px.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| Server Component | `'use client'` like the other shell parts | Nothing in the footer is interactive beyond plain links. Keeping it on the server means no JavaScript cost for content every page shows. |
| Discriminated `FooterLink` union | One `href: string` with an `external?: boolean` flag | The union ties the flag to the URL shape: an internal link with a typo or an external `http://` link is a compile error. |
| Links config in `lib/navigation.ts` | Hard-coded JSX in the footer | Step 2 renders the same links in the drawer; one config keeps them identical. |
| `↗` icon + sr-only text for new tabs | Open external links in the same tab | Students usually want to come back to Campus Hub; a new tab keeps their place. Announcing it removes the surprise. |
| `variant` prop on two parts | Separate `DrawerFooterLinks` component | Same links, same link rendering, different density. A variant keeps one implementation; a second component would duplicate `FooterLinkItem` and the group loop. |
| `groups` prop filtered by `id` | Hard-code "skip Explore" inside the compact variant | The variant controls *looks*, the caller controls *content*. Filtering by `id` instead of `title` survives renames and Phase 7 translations. |
| No legal pages linked yet | Link Privacy / Terms now | Those routes aren't in the route table (§1.3). Linking them would add 404s; add them to `AppRoute` and `FOOTER_GROUPS` when the pages exist. |

#### Component Contract

```ts
type FooterProps       = React.HTMLAttributes<HTMLElement>;      // ref: HTMLElement (<footer>)
type FooterBrandProps  = React.HTMLAttributes<HTMLDivElement>;   // ref: HTMLDivElement
type FooterVariant = 'full' | 'compact';

interface FooterNavProps extends React.HTMLAttributes<HTMLElement> {   // ref: HTMLElement (<nav aria-label="Footer">)
  variant?: FooterVariant;                 // default: 'full'
  groups?: readonly FooterLinkGroup[];     // default: FOOTER_GROUPS
}
interface FooterLegalProps extends React.HTMLAttributes<HTMLDivElement> {   // ref: HTMLDivElement
  variant?: FooterVariant;                 // default: 'full'
}
// All accept className (default '') appended after the base styles. Content comes from FOOTER_GROUPS.
```

#### Usage Example

```tsx
import { Footer, FooterBrand, FooterNav, FooterLegal } from '@/components/ui/layout/Footer';

<Footer>
  <FooterBrand />
  <FooterNav />
  <FooterLegal />
</Footer>

// Inside the mobile drawer
<MobileNavDrawer session={session}>
  <FooterNav
    variant="compact"
    groups={FOOTER_GROUPS.filter((group) => group.id !== 'explore')}
    aria-label="Campus links"
  />
  <FooterLegal variant="compact" />
</MobileNavDrawer>
```

---

### 3.9 AppShell, SessionProvider & Root Layout

**Files:** `src/app/layout.tsx`, `src/components/ui/layout/AppShell.tsx`, `src/components/providers/SessionProvider.tsx`, `src/types/session.ts`, `src/app/globals.css`
**Status:** ✅ Task 2.5 complete (Steps 1–2). Phase 2 complete.

#### Business & Product Purpose

Every page (including the 404 page) now gets the same navbar, notifications, mobile tab bar, drawer and footer without a single line in the page itself. Pages only render their own content. Dark mode now covers the whole page.

#### Core Concepts & Engineering Decisions

- **Root layout stays a Server Component.** `layout.tsx` has no `'use client'`. It renders `<html>`/`<body>`, the providers, and `AppShell`.
- **`AppShell` is the one client component that wires the shell.** It reads the session (`useSession`) and toasts (`useToast`), owns the shared state (notification feed, search trigger), and composes `MobileNav` › `Navbar` › … › `<main>` › footer › `MobileTabBarSpacer` › `MobileTabBar` › `MobileNavDrawer`. Each part stays a reusable building block; only the shell knows how they fit together.
- **Server-rendered footer passed through a client component.** The layout builds `<Footer>…</Footer>` and passes it as `AppShell`'s `footer` prop. Server Components passed as props/children to a Client Component are rendered on the server and arrive as finished output, so the page footer stays out of the client bundle. (The drawer's *compact* footer is imported by `AppShell` directly, so that copy is client-rendered; it's a few links.)
- **`SessionProvider` + `useSession()`.** One `SessionState` (`loading` | `signed-out` | `signed-in` + `user`, now in `types/session.ts`) feeds the navbar slot, tab bar and drawer, so they can never disagree. The layout passes `initialSession` (a mock signed-in user for now). Props from a Server Component to a Client Component must be serializable, which this plain object is. Phase 5 replaces the internals with real auth (reading the session on the server); consumers keep calling `useSession()`. `setSession` exists only so the bench can switch states.
- **`<main id="main-content" tabIndex={-1} className="flex-1">`.**
  - The skip link (§3.3) now has its target. `tabIndex={-1}` makes Safari actually move focus there, not just scroll.
  - `<body>` is `flex min-h-full flex-col`, and `flex-1` makes `<main>` absorb the free space, so on short pages the footer sits at the bottom of the screen (no grey strip).
- **`viewport` export.**
  - `viewportFit: 'cover'` lets the page extend under the iPhone notch/home indicator. The tab bar, drawer, spacer and toasts already pad themselves with `env(safe-area-inset-*)`, which only becomes non-zero with this setting.
  - `themeColor` per colour scheme tints the phone browser's address bar to match the navbar.
- **Dark mode root cause fixed.** `globals.css` had unlayered `body { background-color: var(--background); color: … }` rules. In Tailwind v4, utilities live in a cascade layer, and unlayered CSS always beats layered CSS, so `dark:bg-slate-950` on `<body>` could never apply. The rules are removed; `<body>` colours now come only from classes (`bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100`).
- **Search placeholder (replaced in Step 4.17, §6.17).** Until the search palette existed, ⌘K / the search button showed an info toast ("Search is coming soon"). This also proved the `ToastProvider` was wired.
- **Bell only when signed in.** Signed-out visitors have no notifications, and the 320–375px navbar has no room for bell + "Log in" (§3.6).
- **Verified:** `/` renders 200 with the full shell; `/calendar` returns 404 *inside* the shell (navbar, tab bar with Calendar active, `<main>`, footer). Headless Firefox screenshots: 404 at 375px, home page in dark mode at 1280px.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| One client `AppShell` | Make `layout.tsx` itself `'use client'` | A client root layout would make every page's tree client-side by default and lose `metadata`/`viewport` exports and server data loading in the layout. |
| Footer as a server-rendered prop | Import `Footer` inside `AppShell` | Importing would pull it into the client bundle. The slot pattern keeps it server-only at no cost. |
| `SessionProvider` context | Pass `session` down as props from the layout | Pages and deep components (RSVP buttons in Phase 4) also need the session. Context avoids threading it through every level, and the provider is the single place Phase 5 changes. |
| Mock `initialSession` from the layout | Hard-code the mock inside the provider | The layout is where Phase 5 will read the real session on the server; starting the data flow there now means only the source changes later. |
| Notification feed state in `AppShell` | Separate `NotificationsProvider` now | Only the bell reads it today. Phase 6 (WebSocket) is the right time to move it into its own provider, when pages also need live data. |
| Removing the `globals.css` body rules | Add a dark-mode branch to those rules | Two sources for the same colour (CSS variables and Tailwind classes) is how this bug happened. One source, the classes, is simpler. |
| Toast for the search placeholder | Disable the search button until it exists | The trigger, shortcut and focus handling are finished and tested; keeping them live shows they work and costs nothing. |

#### Component Contract

```ts
// src/types/session.ts
type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User };
type SessionStatus = SessionState['status'];
// NavbarSessionState (Navbar.tsx) is kept as an alias of SessionState.

// SessionProvider.tsx
interface SessionProviderProps {
  initialSession: SessionState;   // required; must be serializable (comes from a Server Component)
  children: React.ReactNode;
}
function useSession(): { session: SessionState; setSession: (session: SessionState) => void };

// AppShell.tsx (no ref: renders the whole shell, not one element)
interface AppShellProps {
  children: React.ReactNode;      // the page, rendered inside <main id="main-content">
  footer: React.ReactNode;        // the page footer, built by the (server) layout
}
```

#### Usage Example

```tsx
// src/app/layout.tsx (Server Component)
<body className="flex min-h-full flex-col bg-slate-50 dark:bg-slate-950">
  <ToastProvider>
    <SessionProvider initialSession={INITIAL_SESSION}>
      <AppShell footer={<Footer><FooterBrand /><FooterNav /><FooterLegal /></Footer>}>
        {children}
      </AppShell>
    </SessionProvider>
  </ToastProvider>
</body>

// Any page or client component
const { session } = useSession();
if (session.status === 'signed-in') { /* session.user is typed here */ }
```

---

### 3.10 Not Found Page

**File:** `src/app/not-found.tsx`

#### Business & Product Purpose

Students will follow old links, mistype URLs, or open pages that don't exist yet (Calendar and Clubs until Phase 4). Instead of a bare "404", they get a clear message and a one-tap way back to events or clubs, with the full navbar, tab bar and footer still around them.

#### Core Concepts & Engineering Decisions

- **`not-found.tsx` file convention.** Next.js renders it for any unmatched URL and for `notFound()` calls, *inside the root layout*, so the whole shell (§3.9) wraps it automatically. The HTTP status stays 404 for search engines.
- **Server Component.** No hooks, no `'use client'`, no JavaScript shipped.
- **Content sized to the page, not the screen.** Next's built-in 404 is a full screen tall, which pushed our footer below the fold. This page is normal-height content inside `<main className="flex-1">`, so the footer sits at the bottom of the screen.
- **One `<h1>`** ("Page not found"); "404" is a small eyebrow label above it, so screen readers announce the meaningful heading.
- **Two ways out:** "Discover events" (primary) and "Browse clubs" (secondary). Buttons stack full-width on phones and sit side by side from 640px.

#### Architectural Tradeoffs

| Decision | Alternative | Why this one |
| --- | --- | --- |
| `not-found.tsx` (inside the layout) | `global-not-found.tsx` (experimental) | We have one root layout, so the regular convention already gets the full shell. `global-not-found` bypasses the layout and is meant for apps with several root layouts. |
| Links styled inline | `Button` component | These navigate, so they're links; `Button` renders a `<button>` (same reasoning as the navbar auth links, §3.3). |
| Static copy | Show the requested path / suggestions | `not-found.tsx` receives no props; reading the path would need a client component. Not worth it for a page this simple. |

#### Component Contract

```ts
export default function NotFound(): React.JSX.Element;   // no props (Next.js file convention)
```

#### Usage Example

```tsx
// Automatic for unknown URLs. From a route, e.g. src/app/clubs/[slug]/page.tsx (Phase 4):
import { notFound } from 'next/navigation';

if (!club) notFound();   // renders src/app/not-found.tsx with a 404 status
```

---

### 3.11 CampusBackground (added 2026-11-05)

**Files:** `src/components/ui/layout/CampusBackground.tsx` (Server Component), `src/components/ui/layout/CampusBackground.module.css`; rendered once in `src/app/layout.tsx` (`BACKGROUND_INTENSITY = 0.8`).
**Status:** ✅ Live on every page. Concept and drawing by the user; adapted to the app.

#### Business & Product Purpose

Gives Campus Hub a sense of place: a hairline elevation of the UM6P campus (stepped portals, claustra grids, the slotted tower, the solar pergola with tree-columns) along the bottom, 1337-style circuit traces with the Benguerir coordinates in the top corners, and a faint 42° lattice at the edges. Content stays on calm, plain surfaces.

#### Core Concepts & Engineering Decisions

- **Behind everything, painted once.** `position: fixed; inset: 0; z-index: -1`. `<body>`'s `bg-slate-50` / `bg-slate-950` is propagated to the canvas, so the layer shows above it and below all content. Cards, navbar (`/80` + blur), tab bar (`/90`) and the solid footer sit on top. Rendered once in the root layout: its SVG `<pattern>` ids (`cb-iso-a/b`, `cb-perf`, `cb-lattice`) are document-global.
- **Readability contract.** Art only at the edges: the lattice is masked out of the centre, the horizon fades in from its top edge, and a radial veil (the page colour at ~72%) covers the content zone. Line-art opacity ≈ 16% light / 20% dark × `intensity`; the site uses **0.8**.
- **Colours tied to the design tokens.** The base is the page surface (`slate-50` / `slate-950`) so white / slate-900 surfaces don't look foreign; the user's warm/cool palette lives in the sky gradient and glows; facade lines are terracotta (campus), circuit nodes are brand violet (`violet-600` / `violet-400`).
- **Theme = the OS**, like every `dark:` style in this app (Tailwind's default `prefers-color-scheme` variant). `theme="light" | "dark"` can force it (used for testing).
- **Responsive.** Corner circuits only from 640px and start below the navbar (`top: 4rem`) so they don't show through its translucent bar. Below 768px the horizon sits above the phone tab bar (`bottom: calc(4rem + 1px + env(safe-area-inset-bottom))`) instead of behind it.
- **Static.** The proposal had one animated "data packet"; removed at the user's request (no animation code left). Hidden in print and `forced-colors` mode, `aria-hidden`, `pointer-events: none`, `contain: strict`.
- **CSS Module** instead of an injected `<style>` string: bundled and cached once, hashed class names, vendor prefixes (`-webkit-mask-image`) added by the bundler.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Inline SVG drawn from constants | A background image (PNG/SVG file) | Crisp at any size, colours from CSS variables (light/dark), hairlines stay 1px (`vector-effect: non-scaling-stroke`). |
| Base = page tokens | The proposal's plaster / night-indigo base | White cards and the translucent navbar would look like a different material on a beige page. |
| `fixed` layer | Background on `<body>` / scrolling with the page | The skyline stays anchored to the viewport bottom on long pages; one layer, composited once. |
| CSS Module | `<style dangerouslySetInnerHTML>` | Not re-sent with every render, cached by the browser, prefixed automatically. |

#### Component Contract

```ts
// src/components/ui/layout/CampusBackground.tsx (Server Component)
type CampusBackgroundTheme = 'system' | 'light' | 'dark';
interface CampusBackgroundProps {
  theme?: CampusBackgroundTheme;   // default 'system' (OS)
  intensity?: number;              // line-art opacity multiplier, clamped 0–1.5, default 1
  className?: string;
}
```

#### Usage Example

```tsx
// src/app/layout.tsx: once, first child of <body>
<CampusBackground intensity={BACKGROUND_INTENSITY} />
```

#### Verified

Every route (`/`, `/calendar`, `/clubs`, `/clubs/leet-dev`, `/events/…`, `/test`, the global 404) renders exactly one background with `--cb-k: 0.8` and no animated path; the compiled CSS keeps the masks, dark-mode media query, phone offsets and print / forced-colors rules (with `-webkit-` prefixes). Production build passes. Look and scroll smoothness: checked by the user in the browser.

#### Notes for later

- **Tuning:** change `BACKGROUND_INTENSITY` in the layout (one number). A different intensity on one page can't be done with a second instance (the SVG ids are global); give that page its own veil or surface instead.
- **A theme toggle** (if ever added) should set `theme` from the same source as the rest of the app.

## 4. Study Guide: React & Next.js Concepts Used in Phase 2

Every concept below is used in real code in this repo. For each one: **what it is**, **where we used it**, **the gotcha** that matters in practice, and a **check yourself** question. If you can answer the question without looking, you've got it.

**Suggested order:** 4.1 → 4.2 (React foundations) → 4.3 (Next.js) → 4.4 (accessibility) → 4.5 (CSS & browser).
**References:** [react.dev/learn](https://react.dev/learn) and [react.dev/reference](https://react.dev/reference/react); the Next.js docs that match our installed version are in `node_modules/next/dist/docs/01-app/` (start with `01-getting-started/05-server-and-client-components.md`).

### 4.1 React Foundations

#### Components, props & `children`
- **What:** A component is a function that takes props and returns UI. `children` is the prop holding whatever you nest between its tags.
- **Where:** Every file in `src/components/ui/layout/`. `NavbarActions` renders nothing but its `children`.
- **Gotcha:** Props flow one way (parent → child). A child can't change its parent's data; it calls a function the parent passed in (`onOpen`, `onMarkRead`).
- **Check yourself:** Why does `NavbarSearch` take an `onOpen` prop instead of opening the search itself?

#### Compound components
- **What:** A family of small components meant to be used together (`Navbar` + `NavbarBrand` + `NavbarLinks` + …) instead of one component with many config props.
- **Where:** `Navbar.tsx`, `NotificationPopover.tsx`, `MobileNav.tsx`, `Footer.tsx`; assembled in `AppShell.tsx`.
- **Gotcha:** When the parts need shared state (open/closed), the parent shares it through **Context** (4.2), not props.
- **Check yourself:** Compare `<Navbar showSearch showBell user={u} />` with the compound version. What happens to each when the 404 page wants to hide the links?

#### State: `useState` and functional updates
- **What:** `const [value, setValue] = useState(initial)` stores data that, when changed, re-renders the component.
- **Where:** `isOpen` in `NotificationPopover` and `MobileNav`; the notification feed in `AppShell.tsx`.
- **Gotcha:** When the new value depends on the old one, pass a function: `setIsOpen((open) => !open)`. It always receives the latest value, even if several updates are batched together.
- **Check yourself:** Why does `markRead` in `AppShell` use `setNotifications((current) => …)` instead of reading `notifications` directly?

#### Lifting state up
- **What:** When two components need the same data, move the state to their closest common parent and pass it down.
- **Where:** `AppShell.tsx` owns the notification feed; the bell only displays it and reports reads (`onMarkRead`).
- **Gotcha:** The component that owns the state is the only one that changes it. Others get data down and send events up.
- **Check yourself:** Where will the notification feed move in Phase 6, and why?

#### Effects: `useEffect` and cleanup
- **What:** Code that runs *after* React has updated the screen, used to sync with things outside React: event listeners, timers, `document`.
- **Where:**
  - Window `keydown` for ⌘K in `NavbarSearch` (`Navbar.tsx`)
  - Esc and outside-click listeners in `NotificationPanel`
  - Scroll lock and `matchMedia` in `MobileNavDrawer`
  - The 60-second clock in the notification panel
- **Gotcha:** Always return a **cleanup** function that undoes what the effect did (remove the listener, clear the timer, restore `overflow`). React runs it before the next effect and on unmount. In development, React runs effects twice on purpose to catch missing cleanups.
- **Check yourself:** What breaks if the drawer's effect forgets to restore `document.body.style.overflow`?

#### Dependency arrays
- **What:** The array after an effect or memo (`[isOpen, onOpen]`) lists every value from the component that the code uses. React re-runs it when one of them changes.
- **Where:** All effects above. `[]` means "only after the first render" (the mount guards).
- **Gotcha:** Leaving a value out gives you **stale** data (the effect sees an old version). Functions created during render are new on every render, which is why 4.1's next item exists.
- **Check yourself:** Why does the bench wrap `openSearch` in `useCallback` before passing it to `NavbarSearch`?

#### Memoization: `useCallback` and `useMemo`
- **What:** `useCallback(fn, deps)` keeps the *same function object* between renders; `useMemo(() => value, deps)` keeps the same computed value.
- **Where:** `toggle`/`close` and the context `value` in `NotificationPopover.tsx`; `unreadCount`; `useMergedRef` in `lib/refs.ts`.
- **Gotcha:** These are for **stability**, not speed. A new context `value` object on every render re-renders every consumer; a new callback re-runs effects that depend on it.
- **Check yourself:** What would happen to every `NotificationTrigger` if the provider built `{ isOpen, toggle, … }` without `useMemo`?

#### Refs: `useRef`, `forwardRef` and merged refs
- **What:** A ref is a box (`ref.current`) that survives renders without causing them. Most often it points at a DOM element so you can call `.focus()` or `.contains()`.
- **Where:**
  - `triggerRef` returns focus to the bell or burger.
  - `rootRef` checks outside clicks.
  - `forwardRef` on every native wrapper lets *callers* get the element too.
  - `useMergedRef` (`lib/refs.ts`) handles a component that needs its own ref **and** the caller's.
- **Gotcha:** Changing `ref.current` doesn't re-render, so never use a ref for something that should appear on screen. **React 19 note:** function components can now receive `ref` as a normal prop, and React plans to deprecate `forwardRef` in a future version. We still use it because it's the project's rule (§1.5) and it's explicit.
- **Check yourself:** Why does `seenIdsRef` in `NotificationPopover` use a ref and not state?

#### Context: `createContext`, `useContext` and providers
- **What:** A way to share a value with a whole subtree without passing props through every level.
- **Where:**
  - `NotificationPopoverContext` and `MobileNavContext`, private to a compound component
  - `SessionProvider` + `useSession()`, app-wide
  - `ToastProvider` + `useToast()`, app-wide
- **Gotcha:** The context starts as `null`, and a custom hook (`useSession`) throws a clear error when it's used outside its provider, which beats a mysterious `undefined`.
- **Check yourself:** Why is `MobileNav` a provider that renders no DOM at all?

#### `useId`
- **What:** Generates a unique id that is **the same on the server and the client**.
- **Where:** `panelId`/`titleId` in `NotificationPopover.tsx`, `drawerId` and `titleId` in `MobileNav.tsx`, wired into `aria-controls` and `aria-labelledby`.
- **Gotcha:** `Math.random()` ids differ between server HTML and the browser, which causes a hydration mismatch (4.3). `useId` doesn't.
- **Check yourself:** Why can't we write `id="notification-panel"` by hand?

#### Portals: `createPortal`
- **What:** Render part of a component somewhere else in the DOM (e.g. at the end of `<body>`) while it stays in the same React tree (context and events still work).
- **Where:** `MobileNavDrawer`; `Modal.tsx` from Phase 1.
- **Gotcha:** We needed it because the navbar's `backdrop-filter` traps `position: fixed` children (4.5). Portals touch `document`, so they need a mount guard.
- **Check yourself:** The drawer lives in `<body>`, but `useMobileNav()` inside it still works. Why?

#### Keys
- **What:** `key` tells React which item is which in a list, so it can keep, move or recreate the right elements.
- **Where:** Every `.map()`; also `<span key={announcement.id}>` in the notification live region.
- **Gotcha:** Changing a key **forces a fresh element**. We use that on purpose so screen readers re-announce identical text.
- **Check yourself:** What goes wrong if list items use the array index as key and an item is inserted at the top?

#### Adjusting state during render
- **What:** Instead of "watch a value with an effect, then set state", compare it with the previous value *during render* and update immediately.
- **Where:** `MobileNav` closes the drawer when `pathname` changes (`lastPathname` pattern).
- **Gotcha:** An effect would run *after* the new page painted, giving a one-frame flash of the open drawer. Only use this for resetting state when an input changes.
- **Check yourself:** Rewrite it as an effect. When exactly does the drawer close in each version?

### 4.2 TypeScript Patterns for React

#### Discriminated unions
- **What:** A union of object types sharing a literal field (`status`) that TypeScript uses to narrow the type.
- **Where:** `SessionState` (`types/session.ts`), `FooterLink` (`types/navigation.ts`).
- **Gotcha:** Inside `if (session.status === 'signed-in')`, `session.user` exists; outside, TypeScript won't let you touch it. Impossible states can't be written.
- **Check yourself:** Why is `{ status, user? }` with an optional `user` weaker?

#### Exhaustive `Record<Union, T>` tables
- **What:** An object that **must** have a key for every member of a union.
- **Where:** `linkStateStyles`, `NAV_ICONS`, `KIND_STYLES`, `accountTab`, `footerGroupTitleLevel`.
- **Gotcha:** Add a new `WebSocketEventType` and the build fails until `KIND_STYLES` has an icon for it. A `switch` with a `default` would silently hide the gap.
- **Check yourself:** What does TypeScript report if you add `'event_reminder'` to `WebSocketEventType` today?

#### Template-literal types
- **What:** String types built from patterns, like `` `/clubs/${string}` `` or `` `https://${string}` ``.
- **Where:** `AppRoute`, `FooterLink` (`types/navigation.ts`).
- **Gotcha:** `href: '/club/robotics'` (missing "s") or `http://…` is a compile error, not a runtime 404.
- **Check yourself:** Which of these compile as `AppRoute`: `'/events/42'`, `'/events'`, `'/profile/edit'`?

### 4.3 Next.js App Router

#### File conventions: `layout.tsx`, `page.tsx`, `not-found.tsx`
- **What:** Special filenames in `src/app/` that Next.js turns into routes and UI.
- **Where:**
  - `src/app/layout.tsx` wraps every page.
  - `src/app/page.tsx` is `/`.
  - `src/app/not-found.tsx` handles unknown URLs and `notFound()`.
- **Gotcha:** A layout **doesn't re-render or remount** when you navigate between its pages. That's why the shell's state (open drawer, notification feed) survives navigation.
- **Check yourself:** Why does the 404 page get the navbar without importing it?

#### Server Components vs Client Components
- **What:** By default every component is a **Server Component**: it runs only on the server and ships no JavaScript. `'use client'` at the top of a file makes it (and everything it imports) a **Client Component** that also runs in the browser.
- **Where:**
  - Server: `layout.tsx`, `not-found.tsx`, `Footer.tsx`.
  - Client: `AppShell.tsx`, `Navbar.tsx`, `MobileNav.tsx`, `NotificationPopover.tsx`, `SessionProvider.tsx`.
- **Gotcha:** Hooks (`useState`, `useEffect`, `usePathname`), event handlers (`onClick`) and browser APIs need a Client Component. Everything else should stay on the server.
- **Check yourself:** `Footer.tsx` has no `'use client'`. Name one way it can still end up running in the browser.

#### The client boundary & passing Server Components as props
- **What:** `'use client'` marks a boundary: modules a Client Component *imports* become client code. Server Components *passed in as props/children* stay server-rendered and arrive as finished output.
- **Where:** `layout.tsx` builds `<Footer>` and passes it into `<AppShell footer={…}>` (`AppShell.tsx`).
- **Gotcha:** Importing `Footer` inside `AppShell` would have moved it into the client bundle. Passing it in kept it on the server. (The drawer's compact footer *is* imported, so that copy is client-rendered.)
- **Check yourself:** Draw the tree from `<html>` to `<NavbarSearch>` and mark where the server/client boundary is.

#### Serializable props
- **What:** Props that a Server Component passes to a Client Component travel over the network, so they must be plain data (strings, numbers, plain objects/arrays). Functions can't be passed.
- **Where:** `layout.tsx` passes `initialSession` (a plain object) to `SessionProvider`. `NavbarSearch`'s `onOpen` is created inside `AppShell` (a client component) for exactly this reason.
- **Gotcha:** `<NavbarSearch onOpen={…} />` inside the server layout would fail: a function can't cross the boundary.
- **Check yourself:** Why couldn't the layout own the "search open" state?

#### Hydration, hydration mismatches & mount guards
- **What:** The server sends HTML; in the browser, React **hydrates** it (attaches event handlers) and expects the first client render to produce *identical* HTML.
- **Where:**
  - The ⌘/Ctrl hint in `NavbarSearch`, which can only be known in the browser
  - The notification panel
  - The drawer portal
  - All three use `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])` (Engineering Law 5).
- **Gotcha:** Anything that differs between server and browser (`navigator`, `window`, `Date.now()`, random numbers) must wait until after mount, or React warns and patches the DOM. `suppressHydrationWarning` only hides the warning.
- **Check yourself:** Why are the "4 weeks ago" timestamps safe from mismatches?

#### Navigation: `next/link` and `usePathname`
- **What:** `<Link>` navigates on the client (no full page reload) and prefetches pages. `usePathname()` returns the current path, so the UI can highlight the active page.
- **Where:** All shell links; `isNavItemActive` in `lib/navigation.ts`; `NavbarLinks`, `MobileTabBar`, `MobileNav`.
- **Gotcha:** `usePathname` is a client hook, which is why the navbar file is `'use client'`. Use `<a>` for external sites (footer campus links), not `<Link>`.
- **Check yourself:** Why must `/` use `match: 'exact'` while `/clubs` uses `'prefix'`?

#### `metadata`, `viewport` and `next/font`
- **What:** Exports from `layout.tsx`/`page.tsx` that Next.js turns into `<head>` tags. `next/font` self-hosts Google fonts with no layout shift.
- **Where:** `metadata` (title, description), `viewport` (`viewportFit: 'cover'`, `themeColor`), Geist fonts in `layout.tsx`.
- **Gotcha:** These exports only work in **Server Components**, which is another reason the root layout must not be `'use client'`.
- **Check yourself:** What does `viewportFit: 'cover'` change, and which of our components depend on it?

### 4.4 Accessibility Patterns (WAI-ARIA)

#### Landmarks & labels
- **What:** `<header>`, `<nav>`, `<main>`, `<footer>` let screen-reader users jump around the page. Several `<nav>`s need distinct `aria-label`s.
- **Where:** `"Main"` (navbar links / tab bar), `"Pages"` (drawer), `"Footer"`, `"Campus links"`.
- **Gotcha:** `display: none` removes an element from the accessibility tree, which is why the desktop links and the tab bar can both be called "Main".
- **Check yourself:** How many navigation landmarks does a screen reader find at 375px with the drawer closed?

#### `aria-current`, `aria-expanded`, `aria-controls`, `aria-haspopup`
- **What:** States that tell assistive tech what a sighted user sees: the current page, whether a popup is open, what it controls, and what kind of popup it is.
- **Where:** Navbar and tab bar links (`aria-current="page"`); bell and burger (`aria-expanded`, `aria-controls` only while open, `aria-haspopup="dialog"`).
- **Gotcha:** `aria-controls` pointing at an element that isn't in the DOM is invalid, which is why it's only set while open.
- **Check yourself:** Why isn't a CSS class enough to mark the active link?

#### Dialogs & focus management
- **What:** An overlay acting as a dialog must move focus in on open, keep it inside (focus trap), close on Esc, and return focus to the trigger on close.
- **Where:** `NotificationPanel`, `MobileNavDrawer`; shared `trapTabKey` in `lib/focus.ts`.
- **Gotcha:** When the focused element disappears (e.g. "Mark all as read"), move focus somewhere sensible yourself, or it falls to `<body>` and escapes the trap.
- **Check yourself:** Why does an outside click close the bell panel *without* moving focus back to the bell, but Esc does move it?

#### Live regions & screen-reader-only text
- **What:** `aria-live="polite"` / `role="status"` makes screen readers announce text changes. `sr-only` hides text visually but keeps it readable.
- **Where:** New-notification announcements (`NotificationPopover`), `"Unread: "` prefixes, `"(opens in a new tab)"` (`Footer.tsx`), `"Loading account"`.
- **Gotcha:** The live region must already exist in the DOM *before* the text changes, or nothing is announced.
- **Check yourself:** Why is the live region rendered even when there's nothing to announce?

#### Skip link
- **What:** A hidden-until-focused link, first in the tab order, that jumps past the navigation (WCAG 2.4.1).
- **Where:** `Navbar.tsx` → `<main id="main-content" tabIndex={-1}>` in `AppShell.tsx`.
- **Gotcha:** Without `tabIndex={-1}` on the target, some browsers scroll but don't move focus.
- **Check yourself:** What should the *next* Tab press focus after using the skip link?

### 4.5 CSS & Browser Concepts

#### Tailwind v4 cascade layers
- **What:** Tailwind v4 puts utilities inside a CSS `@layer`. Any **unlayered** CSS beats layered CSS, regardless of specificity.
- **Where:** The dark-mode bug in Task 2.5: `body { background-color: … }` in `globals.css` overrode `dark:bg-slate-950`.
- **Gotcha:** Keep custom global CSS inside `@theme`/`@layer`, or don't style the same property in two places.
- **Check yourself:** Why didn't adding `dark:bg-slate-950` to `<body>` fix anything until the CSS rule was removed?

#### `sticky` vs `fixed`, and containing blocks
- **What:** `sticky` stays in the page flow and sticks while scrolling; `fixed` is pinned to the viewport and takes no space.
- **Where:** Navbar `sticky top-0`; tab bar `fixed bottom-0` + `MobileTabBarSpacer`.
- **Gotcha:** `transform`, `filter` and `backdrop-filter` on an ancestor make it the **containing block** for `fixed` children, which is why the drawer needed a portal.
- **Check yourself:** Why does the page need `MobileTabBarSpacer` but no spacer for the navbar?

#### Media features: `prefers-color-scheme`, `prefers-reduced-motion`, `matchMedia`
- **What:** CSS (and JS via `window.matchMedia`) can read user and device preferences.
- **Where:** `dark:` classes everywhere; `motion-reduce:animate-none` on the drawer; `matchMedia('(min-width: 768px)')` auto-closes the drawer.
- **Gotcha:** Respecting reduced motion is an accessibility requirement, not a nicety: animations can make some users ill.
- **Check yourself:** How do you emulate both preferences in Chrome DevTools?

#### Safe areas: `env(safe-area-inset-bottom)`
- **What:** On phones with a notch or home indicator, these values say how much space the system UI takes.
- **Where:** Tab bar, drawer, `MobileTabBarSpacer`, toast container; enabled by `viewportFit: 'cover'`.
- **Gotcha:** They're `0` unless the viewport opts in with `viewport-fit=cover`.
- **Check yourself:** What happens to the tab bar on an iPhone if you remove the `viewport` export?

#### `Intl` APIs
- **What:** The browser's built-in formatting for dates, numbers and relative times in any locale.
- **Where:** `formatRelativeTime` / `formatAbsoluteTime` in `lib/time.ts`.
- **Gotcha:** Create formatters once (module level). Pass `now` in instead of reading the clock inside, so the function stays pure and testable.
- **Check yourself:** What will need to change in `lib/time.ts` for Arabic in Phase 7?

---

## 5. Phase 3 — Public Event Feed (`/`)

### 5.1 Design Spec: Figma Mockup, Simplified

**Source:** Figma file `w0eRhqNdEJ2kTJYfsdXlPV` ("ft_transcendence-ui"), frames `25:1370` (Discovery landing) and `25:563` (event card: default / hover / skeleton). Re-read on 2026-10-29.
**Status:** 📐 Spec agreed, not built yet. Build from this section, not from the Figma file.

The mockup is a **light-only visual reference**, not a spec. We take its structure, spacing, corner radius and shadows. Colours, components and copy come from our tokens (§1.4) and Phase 1 primitives. Guiding rule from the product owner: **simple first; every element must earn its place.**

#### What the mockup shows (for reference)

- **Hero:** full-width campus photo with a violet gradient, two blurred colour blobs, an SVG line overlay and a dark tint. On top: filter pills (All Events / RSVP'd / Saved / Invited), an eyebrow pill ("Curated campus schedule"), an H1 "What's happening this week", a two-line subtitle, a search input and an "48 Active listings today" pill.
- **Category bar:** sticky, blurred white bar with "All Categories" + 5 dot chips.
- **Grid:** wrapped in a grey `#f1f5f9` rounded panel with the header "Upcoming Schedule · OCT 24 – NOV 01", "Sorted by Date" and a sort icon, then a 3-column grid with 24px gaps.
- **Card:** 219px image, category pill and bookmark button on the image, then club name, title, date and location rows. The footer has an avatar stack + "+42" + "128 registered", then a full-width 44px pill RSVP button.
- **Skeleton:** grey image block, three text bars, three avatar circles, and a full-width pill.
- **Toast:** "RSVP Confirmed" with an emerald left border.

#### Corrections (what we change, and why)

| # | Mockup | Our version | Why |
| --- | --- | --- | --- |
| 1 | "CampusPulse" brand, blue `#2563eb` buttons | Campus Hub, violet tokens (`violet-600`, dark `violet-400`) | Brand and tokens are already set (§1.4). |
| 2 | Generic marketing hero: photo, gradient, 2 blur blobs, SVG overlay, `mix-blend`, tint layer, eyebrow pill, live-count pill | **No hero.** The page opens with the `<h1>` "Upcoming events" and the toolbar | A featured-event hero was built in Step 3.3 and then dropped by the product owner (2026-11-02): it looked heavy and repeated a card that is already in the grid. See §5.5. |
| 3 | Hero filters "All / RSVP'd / Saved / Invited" | Removed. Campus tabs **All · 1337 · EMINES** (our `Tabs`, segmented) sit in the toolbar | Saved and Invited have no data or feature behind them. Campus is the filter students actually need. White-15% pills on a photo also fail contrast. |
| 4 | Two search bars (navbar "Search the whole site" + page search) | **One search: the navbar's** ("Search events…", ⌘K). The feed toolbar has no search input, only campus and category filters | Two search boxes for the same events is redundant and confusing. (The first version of this spec kept both; corrected by the product owner on 2026-11-02 after Step 3.4 was built with a toolbar search.) |
| 5 | Sticky, blurred category bar | Normal (non-sticky) chip row under the toolbar. Scrolls horizontally on phones, wraps on desktop | The navbar is already sticky. Two sticky bars take ~120px of a phone screen, and blur is expensive on low-end devices. |
| 6 | Mockup categories (Technology, Sports & Rec, Arts & Culture, Social, Academic) | Our 7 `EventCategory` values with our colours: Tech `lime` · Media `violet` · Music `indigo` · Sports `teal` · Business `orange` · Gaming `fuchsia` · EventsOrganization (label "Events") `sky` | These must match the API type (`types/api.ts`). |
| 7 | Grid inside a grey `#f1f5f9` rounded panel on a `#f8fafc` page | Cards sit directly on the page (`bg-slate-50` / `dark:bg-slate-950`) | A panel inside a page adds a layer with no purpose and gives dark mode a third grey to tune. |
| 8 | "Upcoming Schedule · OCT 24 – NOV 01", "Sorted by Date" + sort button | H2 "Upcoming events" + muted result count ("6 events") | There is only one sort order, so the sort control does nothing. The count gives feedback when filters change. |
| 9 | Category pill and bookmark button **on the image**, with a dark bottom gradient | Nothing overlays the image. The category badge moves into the card body, next to the date. No bookmark button | The mockup's on-image pills fail contrast (lime-700 on lime-500 ≈ 3:1; teal-500 text on a translucent tint over a photo). Our `Badge` category style is translucent (`bg-*-500/15`), so it is only readable on a solid surface. Bookmarks have no feature behind them. With nothing on the image, the gradient isn't needed either. |
| 10 | Each card styled differently: solid lime pill vs. tinted pill, white vs. dark bookmark, club name above the title vs. on the image, date coloured per category | **One card layout**, always the same | Consistency is what makes a grid look calm. Per-category date colours also fail contrast (fuchsia-500 on white ≈ 3.3:1). |
| 11 | Five CTA labels: "RSVP Now", "RSVP for Event", "Going ✓", "You're Attending", "Attending ✓" | Two states: **RSVP** (primary) and **Going** (with check icon, secondary/emerald tint) | One action needs one vocabulary. |
| 12 | Card footer = avatar row **plus** a full-width 44px button (two rows) | **One row:** avatar stack + "42 going" on the left, small RSVP button on the right | Shorter cards, so more events above the fold. It also matches our existing `CardSkeleton` footer geometry (avatars left, `h-8 w-20` button right), so there is zero layout shift between loading and loaded states. |
| 13 | Times shown as "9:00 AM EST" | "Thu, Nov 5 · 5:00 PM" in campus time (`formatEventSchedule`, `Africa/Casablanca`), no zone suffix | All events are on campus in Morocco. Formatting runs **on the server only** and the text is passed down (§5.2), because a fixed zone alone does not guarantee identical server and browser output. |
| 14 | Custom sizes (13px, 11px, 219px image) and padding that alternates 20/24px | Tailwind scale only: `text-xs`/`text-sm`/`text-lg`, image `aspect-video`, padding `p-5` everywhere | Fewer magic numbers. `aspect-video` keeps image height proportional at every column width. |
| 15 | Hover state = large `shadow-xl` | Our `Card isHoverable`: `-translate-y-0.5`, `shadow-md`, violet border, image `scale-105` | Already built and tested in Phase 1. Subtle beats dramatic for a grid of 6+ cards. Respect `motion-reduce`. |
| 16 | No empty state, light mode only | Empty state and full dark mode defined below | Both are required by the roadmap. |

#### Page layout (top to bottom)

Container for every section: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` (same as the navbar). Vertical rhythm: `space-y-8` between sections, `py-6 sm:py-8` around the page.

1. **Toolbar**
   - Row 1: `<h1>` "Upcoming events" (`text-xl font-semibold`) + result count (`text-sm text-slate-500 dark:text-slate-400`, inside `aria-live="polite"`).
   - Row 2: campus toggle group (segmented: All · 1337 · EMINES), full width on phones, content width from `sm`. No search input (correction 4).
2. **Category chips**
   - Interactive `Badge` chips: "All" + 7 categories. One selected at a time (selected = filled violet, others = neutral; each chip shows its category colour dot).
   - Phones: one row, `overflow-x-auto`, hidden scrollbar, `-mx-4 px-4` so chips can scroll edge to edge. From `md`: `flex-wrap`.
   - Group semantics: `role="group" aria-label="Filter by category"`, each chip `aria-pressed`.
3. **Event grid**
   - `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`. `grid-cols-1` is required, see §5.7.
   - Loading: deferred to Phase 7 (§5.8). Mock data is already on the page, so a skeleton would never show.
   - Empty: see below.

#### Event card anatomy (`EventCard`, composed from `Card` primitives)

```
┌───────────────────────────────┐
│  flyer (aspect-video)         │  CardBanner. No overlays. No flyer → category-tinted
│                               │  fallback with the category icon/initial, centred.
├───────────────────────────────┤
│  [Tech]  Thu, Nov 5 · 6:00 PM │  Badge (category) + date: text-xs font-semibold
│                               │  text-violet-600 dark:text-violet-400
│  42 Campus Hackathon: Edge AI │  CardTitle: text-lg font-semibold tracking-tight,
│  & Systems                    │  line-clamp-2, wrapped in the <Link> to /events/[id]
│  📍 Agora Hall · 1337          │  text-sm text-slate-500 dark:text-slate-400, truncate
├───────────────────────────────┤  border-t border-slate-100 dark:border-slate-800/60
│  (●)(●)(●) 120 going  [RSVP]  │  AvatarGroup (xs, max 3) + count │ Button size sm
└───────────────────────────────┘
```

- Padding `p-5`. Gap between body lines `space-y-2`.
- **Whole-card link without nesting buttons in links:** the title is the `<Link>`, and its `::after` (`after:absolute after:inset-0`) stretches over the card. The RSVP button sits above it (`relative z-10`). Keyboard users get one tab stop for the link and one for RSVP.
- RSVP states: `has_user_rsvpd = false` → `Button variant="primary"` "RSVP". `true` → secondary with check icon, "Going", `aria-pressed="true"`. The click toasts "You're going to {title}" (existing `ToastProvider`).
- Count copy: "{n} going". Attendee names go into the avatar `alt`/`title` text.
- Cards in one row stretch to equal height (`h-full flex flex-col`, footer `mt-auto`).

#### Empty state

Centred in the grid area, `py-16`, inside a dashed box (`rounded-xl border border-dashed border-slate-300 dark:border-slate-700`):

- decorative calendar/search icon in a `size-12 rounded-full bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400` circle (`aria-hidden`)
- title "No events match your filters" (`text-base font-semibold`)
- hint "Try another campus or category." (`text-sm text-slate-500 dark:text-slate-400`)
- `Button variant="secondary"` "Clear filters", which resets campus and category

#### Dark mode map (derived by us; the mockup has none)

| Element | Light | Dark |
| --- | --- | --- |
| Page | `bg-slate-50` | `bg-slate-950` |
| Card | `bg-white border-slate-200/80 shadow-sm` | `bg-slate-900 border-slate-800`, no visible shadow |
| Card hover border | `violet-300` | `violet-700/60` |
| Title / heading text | `text-slate-900` | `text-slate-100` |
| Secondary text (location, count, hints) | `text-slate-500` | `text-slate-400` |
| Date line, links, accent | `text-violet-600` | `text-violet-400` |
| Card footer divider | `border-slate-100` | `border-slate-800/60` |
| Chip (idle) | `bg-slate-100 text-slate-700` | `bg-slate-800 text-slate-300` |
| Chip (selected) | `bg-violet-600 text-white` | `bg-violet-500 text-white` |
| No-flyer fallback banner | category `-100` tint + `-600` icon | category `-500/10` tint + `-400` icon |
| Empty-state box | `border-slate-300` | `border-slate-700` |

Rules: no pure black (`#000`) or pure white text on dark backgrounds. Shadows are near-invisible on `slate-950`, so dark mode relies on borders for separation.

#### Accessibility checklist for the feed

- One `<h1>` per page: "Upcoming events". Card titles are `<h3>` today; with no section heading between the `<h1>` and the cards, Step 3.6 should make them `<h2>` so no level is skipped.
- Filters live in a `<search>`/`role="search"` region. The result count is announced politely when filters change.
- Text contrast is at least 4.5:1 everywhere (the reason for corrections 9 and 10).
- Flyer images get `alt=""` (the title is right next to them).
- `motion-reduce:transform-none` on hover lifts and image zoom.

#### Proposed Phase 3 build order (one step at a time, each with a bench in `src/app/page.tsx`)

| Step | Deliverable |
| --- | --- |
| 3.1 | `src/lib/events.ts`: pure filter helpers (`filterEvents({ campus, category, query })`, campus list) + `useDebouncedValue` hook |
| 3.2 | `EventCard` (+ RSVP button states, no-flyer fallback) |
| 3.3 | ~~`FeaturedEventHero`~~ dropped (§5.5) |
| 3.4 | `FeedToolbar` (heading, count, campus filter) + `CategoryFilter` chips |
| 3.5 | `EventGrid` with empty state (loading skeleton deferred to Phase 7, §5.8) |
| 3.6 | Assemble `/` (replace the bench with the real page) |

#### Things to fix along the way

- ~~`AvatarGroup` is still typed `React.FC`~~: fixed in Step 3.2 (§2.3).
- Toast auto-dismiss timer restart (§2.1). This becomes visible once RSVP toasts are added.

### 5.2 Data Layer (committed in `cb5dd1a`, 2026-10-29)

- `src/types/api.ts`: added `AttendeePreview` and `EventItem.attendees_preview` (≤ 3, newest first). `flyer_url` may be `''`.
- `src/lib/time.ts`: added `CAMPUS_TIME_ZONE` and `formatEventSchedule(iso) → { day, time }`.
- **Hydration fix (2026-11-02): event times are formatted on the server only.**
  - **Bug:** the browser logged *"Hydration failed because the server rendered text didn't match the client"* on the card's `<time>`: server `5:00 PM`, browser `6:00 PM`.
  - **Cause:** pinning `timeZone: 'Africa/Casablanca'` is not enough. Every runtime ships its own copy of the IANA time-zone database. The server (Node in `node:22-alpine`, tzdata 2026e) has Morocco on GMT+0 from about Oct 2026; Chrome 144's bundled copy still says GMT+1. Morocco's offset changes by government decree, so runtimes will keep disagreeing from time to time.
  - **Fix:** `getEventSchedules(events) → Record<id, EventSchedule>` runs in a Server Component (`src/app/page.tsx`). Client components receive the strings as props and never call `formatEventSchedule`. The browser's time-zone data is never used, so a visitor with an old browser also sees the right time after a re-render (e.g. clicking RSVP).
  - **Rejected:** `suppressHydrationWarning` hides the warning but the text flips to the browser's value on the next re-render. A hard-coded `+00:00` offset breaks silently the next time Morocco changes its clock.
  - **Rule from now on:** any date formatted in campus time is formatted on the server. The Phase 7 API could also send it pre-formatted.
  - **Bench split:** `src/app/page.tsx` is now a Server Component. The interactive bench lives in `src/app/_bench/EventCardBench.tsx` (`_` = private folder, never a route).
  - **Rebuild note:** the frontend container copies the source at build time (no volume), so code changes need `docker compose up -d --build frontend`.
- `src/lib/mockData.ts`: events moved to November 2026 (UTC times), flyer paths under `/mock/events/`, a shared attendee pool, and more events.
- `public/mock/events/`: `basketball.png`, `campus-bbq.png`, `hackathon.png`, `jam-session.png`, `symposium.png`.
- `src/lib/events.ts`: created empty here, filled in Step 3.1 (§5.3).

### 5.3 Event Filter Helpers & `useDebouncedValue` (Step 3.1)

**Files:** `src/lib/events.ts`, `src/hooks/useDebouncedValue.ts`
**Status:** ✅ Step 3.1 complete. Bench: `src/app/page.tsx` (14 self-checks + live filters).

#### Business & Product Purpose

Students should be able to narrow the feed to their campus, a category they care about, or something they half-remember ("that jam thing at the courtyard"). These helpers contain all of that logic. The feed's components (Steps 3.2–3.6) only render it.

#### Core Concepts & Engineering Decisions

- **One filter object.** `filterEvents(events, { campus, category, query })` takes the same `EventFilters` shape the feed keeps in state, so "Clear filters" is just `setFilters(DEFAULT_EVENT_FILTERS)`.
- **`'all'` lives in the filter types, not in the domain types.** `CampusFilter = 'all' | Campus` and `CategoryFilter = 'all' | EventCategory`. `EventCategory` (the API type) never gets a fake `'all'` value.
- **Search normalisation.** The query and the text it searches are both turned to NFD, combining marks are stripped (Latin accents `̀-ͯ`, Arabic harakat `ً-ٟ`, `ٰ`), then lower-cased. "cinématic" finds "Cinematic", and Phase 7 Arabic search will ignore vowel marks. The ranges are written out instead of `\p{M}` because `tsconfig` targets ES2017, where Unicode property escapes aren't allowed.
- **Words combine with AND.** The query is split on whitespace. Every word must appear somewhere in the title, club name or location. Typing more narrows the results, as people expect, and extra spaces are harmless.
- **Time is a parameter.** `getUpcomingEvents(events, now)` takes `now` as a number instead of calling `Date.now()`, the same rule as `formatRelativeTime` (§3.5). This keeps it deterministic, so the bench can check them with fixed dates. It also means the page decides what "now" is. Step 3.6 should compute it **once on the server** and pass it down, so server and client HTML agree.
- **Upcoming = not ended.** An event that is happening right now (the 48-hour hackathon) stays in the feed. Sorting is by `start_time`, soonest first. `.filter()` returns a new array before `.sort()`, so the input is never mutated (bench check 14).
- **`useDebouncedValue(value, delayMs = 300)`.** `useState` stores the value that was last applied. A `useEffect` keyed on `[value, delayMs]` sets a timer. Its cleanup cancels the pending timer whenever the value changes again, and on unmount. Typing "hackathon" filters (and updates the polite live region) once, not nine times. The file has no `'use client'`: it never touches `window`/`document`, and hooks can only run inside client components anyway, so the boundary belongs to the component that calls it.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Pure functions in `lib/` | Filtering inside the feed component / a custom `useEventFilters` hook | Pure code can be tested without React and run on the server. Phase 7 can reuse it if filtering moves to API query params. The component only keeps the state. |
| Debounce the **value** (hook) | Debounce the **handler** (`lodash.debounce` on `onChange`) | The input stays controlled and responds immediately; only the filter waits. No dependency added, no stale-closure or `useMemo(debounce)` problems, and cleanup is automatic through the effect. |
| Campus matched via `CAMPUS_DEPARTMENT: Record<Campus, string>` on `department_name` | Look up `club_id → club → department_id` | Two of the mock clubs (`club_um6p_sports`, `club_bde`) aren't in `mockClubs`, and the API doesn't promise to embed clubs. The weak spot is one table: Phase 7 should ask for a `department_slug` on `EventItem`. |
| Case/accent-insensitive `includes` | Fuzzy search library (Fuse.js) | About 10 lines and no dependency, versus several KB of extra JavaScript. Fuzzy ranking isn't useful on a list of a few dozen events. |
| `now` passed in | `Date.now()` inside the helper | Deterministic, testable, and hydration-safe (see above). |
| Labels in `CATEGORY_LABELS: Record<EventCategory, string>` | Show the raw enum | `EventsOrganization` reads as "Events". `Record` makes TypeScript complain if a category is added to the API type without a label. |

#### Component Contract

```ts
// src/lib/events.ts
type Campus = '1337' | 'emines';
type CampusFilter = 'all' | Campus;
type CategoryFilter = 'all' | EventCategory;
interface EventFilters { campus: CampusFilter; category: CategoryFilter; query: string }

const DEFAULT_EVENT_FILTERS: EventFilters;                     // { campus: 'all', category: 'all', query: '' }
const CAMPUS_FILTERS: { value: CampusFilter; label: string }[]; // All · 1337 · EMINES
const EVENT_CATEGORIES: EventCategory[];                        // chip order
const CATEGORY_LABELS: Record<EventCategory, string>;

filterEvents(events: EventItem[], filters: EventFilters): EventItem[];   // keeps input order, no mutation
getUpcomingEvents(events: EventItem[], now: number): EventItem[];        // end_time > now, sorted by start_time

// src/hooks/useDebouncedValue.ts
useDebouncedValue<T>(value: T, delayMs?: number /* = 300 */): T;
```

#### Usage Example

```tsx
'use client';
const [filters, setFilters] = useState(DEFAULT_EVENT_FILTERS);

const upcoming = getUpcomingEvents(events, now);       // `now` computed once on the server
const visible = filterEvents(upcoming, filters);       // the feed leaves `query` at ''

<Button onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>Clear filters</Button>
```

**Update (2026-11-02):** the feed has no search input (§5.1 correction 4). The `query` part of `filterEvents`, the search normalisation and `useDebouncedValue` stay: they are what the navbar search ("Search events…", ⌘K) will use when its palette is built. Until then the feed always passes `query: ''`.

#### Notes for later steps

- **Step 3.4:** `Badge` with `isClickable` renders a `<span>`, which can't be reached with the keyboard or announced as a button. The category chips need a real `<button aria-pressed>`, either by giving `Badge` a button mode or with a small `FilterChip`. The bench uses `Button` for now.
- **Step 3.4:** `TabsTrigger` always sets `aria-controls` to a panel id. Campus tabs that filter one shared grid don't have a panel per tab, so either the grid gets that id or the campus control becomes a button group with `aria-pressed`.
- **Mock data:** `evt_hackathon_ai` has `club_id: 'club_leet_frame'` but `club_name: '1337 Coding School'`. This doesn't affect filtering, but it will look wrong on `/clubs/[slug]` in Phase 4.

### 5.4 EventCard & `toggleRsvp` (Step 3.2)

**Files:** `src/components/events/EventCard.tsx` (`schedule` prop added 2026-11-02, see §5.2), `toggleRsvp` in `src/lib/events.ts`, `CheckIcon` + `MapPinIcon` in `src/components/ui/layout/navIcons.tsx`
**Primitives touched:** `Card.tsx` (§2.2), `Avatar.tsx` (§2.3)
**Status:** ✅ Step 3.2 complete. Bench: `src/app/page.tsx` (all 6 mock events + 4 self-checks).

#### Business & Product Purpose

The card is the unit of the feed. In two seconds it should answer "what, when, where, who else is going", and let a student RSVP without leaving the page. Every event looks the same way, so a grid of them reads calmly, including events whose organiser never uploaded a flyer.

#### Core Concepts & Engineering Decisions

- **Composition, not a new card.** `Card` (`isHoverable`) + `CardBanner` + `CardTitle` + `CardFooter` + `Badge` + `AvatarGroup` + `Button`. The only new markup is the body row and the fallback banner.
- **Stretched link.** The title `<Link>` gets `after:absolute after:inset-0`, and the card is `relative`, so the link's `::after` covers the whole card. The RSVP button (and the avatar stack) sit above it with `relative z-10`. Result: the whole card is clickable, there is no `<button>` inside an `<a>` (invalid HTML and confusing to screen readers), and keyboard users get exactly two tab stops per card. The `::after` is positioned against the card, not the `line-clamp` heading, so the heading's `overflow: hidden` doesn't clip it.
- **Focus ring around the whole card.** The focus ring is drawn on the `::after` (`focus-visible:after:ring-2 … ring-inset`). It is inset because the card's `overflow-hidden` would clip an outer ring.
- **No-flyer fallback.** `CardBanner` got a `fallback` slot. `EventCard` fills it with a category tint and a calendar icon from `fallbackStyles: Record<EventCategory, string>` (`-100` tint + `-600` icon, dark `-500/10` + `-400`, as in the §5.1 dark-mode map).
- **`next/image` in `CardBanner`.** `fill` + `sizes` describe the grid (1 → 2 → 3 columns, 400px cap). On a phone the browser downloads a ~7 kB WebP instead of the 170–200 kB PNG. Images below the fold load lazily by default.
- **The card is controlled.** It renders `event.has_user_rsvpd` and calls `onRsvpToggle(event)`. The parent owns the list, applies `toggleRsvp` and fires the toast. The card doesn't depend on `ToastProvider`, and Phase 5 can turn an RSVP click while signed out into a login redirect without touching the card.
- **`toggleRsvp(event)`** is a pure optimistic update: it flips the flag and moves the count by ±1, never below 0. Phase 7 keeps the previous object to roll back if the request fails.
- **The toast is decided outside the state updater.** It reads the card's `event` argument. Updaters run twice in Strict Mode, so a toast fired inside one would show twice.
- **No `'use client'`.** The card uses no hooks or browser APIs. Its `onRsvpToggle` function prop couldn't be passed from a Server Component anyway, so the parent (the feed, a client component) is where the boundary belongs.

#### Accessibility

- The title is an `h3` link (the page's `h1` is "Upcoming events").
- The date is `<time dateTime={iso}>`.
- **RSVP button name.** Visible "RSVP" / "Going" plus screen-reader-only text: "RSVP to {title}" and "Going to {title}, cancel RSVP". Six identical "RSVP" buttons would be indistinguishable in a screen reader's button list. The visible word is at the start of the accessible name (WCAG 2.5.3 Label in Name).
- **Spec change, no `aria-pressed`.** §5.1 proposed `aria-pressed="true"` on "Going". A toggle button whose *label also changes* is read as "Going, pressed", which says the state twice and suggests pressing it means "go". So the label carries the state, and the toast (a live region) announces the change. Focus stays on the button because it is never disabled.
- The avatar stack is `aria-hidden` (initials mean nothing read aloud). The "N going" text carries the information. Names show as mouse tooltips (`title`).
- Flyers are `alt=""`, since the title sits right below.
- **Spec correction for reduced motion.** §5.1 said `motion-reduce:transform-none`, but in Tailwind v4 `translate-*` and `scale-*` use the separate CSS `translate` and `scale` properties, not `transform`. So the fix is `motion-reduce:hover:translate-y-0` on the card and `motion-reduce:group-hover:scale-100` on the image.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Stretched `::after` link | Wrap the whole card in `<Link>` | A link can't contain the RSVP `<button>` (interactive content inside `<a>` is invalid). A screen reader would also read the whole card as one giant link name. |
| Stretched link | `onClick={() => router.push()}` on the card | That gives no real link: no middle-click or open-in-new-tab, no prefetch, and it isn't announced as a link. |
| Controlled card (`event` + `onRsvpToggle`) | Card keeps its own RSVP state | The feed and the event page must agree on one RSVP value. Local state would drift. |
| `fallback` slot on `CardBanner` | `EventCard` draws its own banner box | The aspect ratio, background and hover zoom stay in one place. Phase 4 club banners get the same slot for free. |
| `next/image` inside the `CardBanner` primitive | Plain `<img>` | ~25× smaller downloads and automatic `srcset`. Cost: remote URLs must be allow-listed (`images.remotePatterns` in `next.config.ts`) when Phase 7 serves flyers from the API host. |
| Label changes, no `aria-pressed` | Fixed label + `aria-pressed` | A fixed label ("RSVP" in both states) is less clear for sighted users. See Accessibility above. |
| Count text only | `AvatarGroup total` "+N" bubble plus a count | The mockup showed "+42" and "128 registered", which is the same fact twice. |

#### Component Contract

```ts
interface EventCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  event: EventItem;                          // required
  schedule: EventSchedule;                   // required; { day, time } pre-formatted on the server (§5.2)
  onRsvpToggle: (event: EventItem) => void;  // required; receives the event as currently shown
}
// forwardRef<HTMLDivElement> → the Card root

toggleRsvp(event: EventItem): EventItem;     // pure; flips has_user_rsvpd, rsvps_count ± 1 (min 0)
```

#### Usage Example

```tsx
'use client';
const [events, setEvents] = useState(mockEvents);
const { showToast } = useToast();

const handleRsvpToggle = (event: EventItem) => {
  setEvents((current) => current.map((item) => (item.id === event.id ? toggleRsvp(item) : item)));
  showToast(event.has_user_rsvpd
    ? { title: 'RSVP cancelled', description: event.title, variant: 'info' }
    : { title: "You're going", description: event.title, variant: 'success' });
};

// `schedules` comes from a Server Component: getEventSchedules(events)
<ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {events.map((event) => (
    <li key={event.id}><EventCard event={event} schedule={schedules[event.id]} onRsvpToggle={handleRsvpToggle} /></li>
  ))}
</ul>
```

#### Notes for later steps

- **Next.js 16:** `next/image`'s `priority` is deprecated; use `preload` for a single above-the-fold LCP image (or `loading="eager"` / `fetchPriority="high"`).
- **Step 3.5:** `CardSkeleton` no longer matches the card. It has a status badge and three description lines that `EventCard` doesn't have, and its button placeholder is `h-8` while `Button size="sm"` is ~26px. Loading → loaded will jump unless the skeleton is reshaped (or an `EventCardSkeleton` is added).
- **Phase 7:** `Button isLoading` sets `disabled`, which drops keyboard focus mid-request. Keep RSVP optimistic (no loading state), or give `Button` an `aria-disabled` loading mode first.

### 5.5 Step 3.3 FeaturedEventHero: built, then dropped (2026-11-02)

**Decision (product owner):** no hero on `/`. It was built to the §5.1 spec (flyer background, one gradient, "Featured" label, title as `<h1>`, RSVP + View details) and reviewed in the browser. The verdict: it looks heavy and adds nothing, because the featured event is already a card in the grid with the same information and the same RSVP button. The code was removed before being committed; `getFeaturedEvent` was removed from `src/lib/events.ts` with it, since nothing else used it.

**What changes in the plan**

- The page starts with the toolbar. "Upcoming events" becomes the page's `<h1>` (§5.1 layout and accessibility checklist updated).
- The first card images are now the LCP element. Step 3.6 can give the first row of cards `preload` (or `loading="eager"`) if Lighthouse flags it.

**Lessons kept for Step 3.6**

- **`await connection()`** (from `next/server`) in `src/app/page.tsx` before calling `Date.now()`. Without it, Next.js prerenders `/` at build time and "now" freezes at the build date, so `getUpcomingEvents` would keep showing events that have already ended in production.
- Anything time-dependent (which events are upcoming) is decided on the server and passed down, the same rule as the formatted times in §5.2.

### 5.6 FeedToolbar, CategoryFilter & FilterChip (Step 3.4)

**Files:** `src/components/events/FeedToolbar.tsx`, `src/components/events/CategoryFilter.tsx`, `src/components/ui/FilterChip.tsx` (new primitive), `formatEventCount` in `src/lib/events.ts`
**Status:** ✅ Step 3.4 complete. Bench: `src/app/page.tsx` → `src/app/_bench/FeedBench.tsx` (live filters over the card grid, 6 self-checks).

#### Business & Product Purpose

The top of `/` now answers "what's on for me": the page title, how many events match, and two ways to narrow the list (campus, category). Searching by words is the navbar's job ("Search events…", ⌘K); there is deliberately no second search box here (§5.1 correction 4). The count gives instant feedback, so an empty result is never a surprise.

#### Core Concepts & Engineering Decisions

- **`FeedToolbar` is controlled and stateless.** It receives `campus`, `onCampusChange` and `resultCount`. The page owns one `EventFilters` object (§5.3), so "Clear filters" in Step 3.5 is a single `setFilters(DEFAULT_EVENT_FILTERS)`.
- **No search input.** The first build of this step had a "Search events" box here; it was removed the same day because the navbar already has "Search events…" (⌘K). One search, one place.
- **`children` slot inside the `<search>` landmark.** The page passes `<CategoryFilter>` in, so all filters share one landmark without `FeedToolbar` importing or configuring the chips (composition over a `showCategories` prop).
- **Native `<search>` element.** The HTML landmark for search and filter controls (typed in React 19's JSX). Screen-reader users can jump straight to "Filter events".
- **Campus = toggle-button group, not `Tabs`.** Three `<button aria-pressed>` in `role="group" aria-label="Campus"`, styled like the segmented `TabsList`. `Tabs` would be wrong here: it sets `aria-controls` to a panel per tab, but all three campuses filter one shared grid.
- **`FilterChip` primitive.** A pill-shaped `<button aria-pressed>` with an optional decorative colour dot. It replaces `Badge isClickable` for filters: that renders a `<span>`, which the keyboard can't reach and screen readers don't announce as a button. On the violet "selected" fill the dot turns white (the Media dot is violet too and would vanish).
- **Chip row layout.** Phones: one sideways-scrolling row (`overflow-x-auto`, scrollbar hidden with `[scrollbar-width:none]` + `[&::-webkit-scrollbar]:hidden`), bleeding to the screen edges with `-mx-4 px-4` (`sm:-mx-6 sm:px-6`) so the last chip visibly peeks out. From `md`: `flex-wrap`. `py-1` gives the focus ring room, because a scroll container clips anything outside its padding box.
- **`formatEventCount(n)`:** "No events" / "1 event" / "6 events". Pure, in `lib/events.ts`; Phase 7 swaps it for `Intl.PluralRules` with Arabic plural forms (Arabic has six).
- **No `'use client'`** in any of the three files: no hooks, no browser APIs. Their callback props already require a client parent.

#### Accessibility

- "Upcoming events" is the page's only `<h1>`.
- Result count: `<p aria-live="polite">`, announced after filtering settles.
- Toggle buttons read as "1337, toggle button, not pressed". Groups are named "Campus" and "Filter by category".
- All controls are native buttons/inputs: Tab moves between them, Enter/Space toggles, focus rings are `ring-violet-500` (chips add a 2px offset in the page colour).
- **Heading levels:** cards are still `<h3>` under the `<h1>`, skipping `<h2>`. Step 3.6 should pass `as="h2"` through `EventCard` (or make it the card default).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `aria-pressed` toggle buttons | `Tabs` (`role="tablist"`) | Tabs promise one panel per tab (`aria-controls`) and arrow-key navigation; neither applies. A screen reader would announce "tab 2 of 3" for something that is a filter. |
| `aria-pressed` toggle buttons | `role="radiogroup"` + `role="radio"` | A radio group is the more exact semantics for "pick one", but requires roving `tabIndex` and arrow-key handling to be correct. Toggle buttons are native, need no script, and screen readers announce them clearly. |
| New `FilterChip` | Give `Badge` a button mode | A badge is a label; a chip is a control. Mixing both in one component would mean conditional element types, ARIA and hover styles in `Badge`. |
| `children` slot for the chip row | `FeedToolbar` renders `CategoryFilter` itself | The toolbar stays small and the page decides what goes in the filter landmark (e.g. `/calendar` can reuse it without chips). |
| Horizontal scroll on phones | Wrap chips onto 2–3 lines | Wrapping 8 chips takes ~100px of a phone screen before the first event. One scrolling row costs 40px and the peeking chip shows there's more. |
| Hand-written `formatEventCount` | `Intl.PluralRules` now | English only until Phase 7; the function is the single place to change. |

#### Component Contract

```ts
// src/components/ui/FilterChip.tsx — forwardRef<HTMLButtonElement>
interface FilterChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  isSelected: boolean;     // required; sets aria-pressed and the violet fill
  dotClassName?: string;   // e.g. 'bg-lime-500'; decorative dot, white when selected
}

// src/components/events/CategoryFilter.tsx — forwardRef<HTMLDivElement>
interface CategoryFilterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: CategoryFilter;                        // 'all' | EventCategory
  onChange: (value: CategoryFilter) => void;
}

// src/components/events/FeedToolbar.tsx — forwardRef<HTMLDivElement>
interface FeedToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  campus: CampusFilter;
  onCampusChange: (campus: CampusFilter) => void;
  resultCount: number;
  children?: React.ReactNode;    // more filters inside the <search> landmark
}

// src/lib/events.ts
formatEventCount(count: number): string;   // 'No events' | '1 event' | 'N events'
```

#### Usage Example

```tsx
'use client';
const [filters, setFilters] = useState(DEFAULT_EVENT_FILTERS);
const visible = filterEvents(events, filters);

<FeedToolbar
  campus={filters.campus}
  onCampusChange={(campus) => setFilters((f) => ({ ...f, campus }))}
  resultCount={visible.length}
>
  <CategoryFilter value={filters.category} onChange={(category) => setFilters((f) => ({ ...f, category }))} />
</FeedToolbar>
```

#### Notes for later steps

- **`Tabs` primitive bug (fixed in Step 4.1, §6.1):** `TabsTrigger` uses roving `tabIndex` (only the active tab is focusable) but has no arrow-key handler, so keyboard users can't reach the other tabs. Fix before anything uses `Tabs` (likely `/calendar` month/week in Phase 4).
- **`Badge isClickable`** is now unused for filters; consider removing that mode so nobody builds an unreachable control with it.
- **Step 3.5:** the empty state replaces the bench's placeholder line, and its "Clear filters" button resets `filters` (campus and category).
- **Phase 7:** campus labels and `formatEventCount` go through i18n; Arabic RTL flips the chip row's scroll direction automatically (flex follows `dir`), but the negative-margin bleed should be checked.

### 5.7 Phone bug fixes: page wider than the screen & `<html>` hydration warning (2026-11-02)

**Files:** `src/app/_bench/FeedBench.tsx` (grid), `src/app/layout.tsx` (`<html>`)

**1. The page was wider than the phone, so it looked zoomed and the navbar was cut off on the right.**

- **Symptom (real phone):** the page opened slightly zoomed. After zooming out, the navbar stopped short of the right edge.
- **Measured** in headless Chromium at 360px and 390px: every event card was 395px wide, so the document was 411px wide. `/calendar` (no cards) was fine.
- **Cause:** on phones the grid had no column template (`grid gap-6`, columns only from `sm:`). The single implicit column is `auto`, whose minimum is the card's *min-content* width. The location line uses `truncate` (`white-space: nowrap`), so its min-content width is the full text. "Sports Complex - Main Court · UM6P Central Campus" + icon + padding ≈ 395px. The card grew to that, the page became 411px, and mobile browsers widen the layout viewport to fit the content (the "zoom"). The fixed navbars then span 411px, so part of them sits off-screen.
- **Fix:** `grid-cols-1`. In Tailwind v4 that is `repeat(1, minmax(0, 1fr))`: the `0` minimum lets the column shrink to the screen width, and `truncate` then does its job ("…"). `sm:grid-cols-2` / `lg:grid-cols-3` already use `minmax(0, 1fr)`, which is why tablets and desktops were never affected.
- **Rule:** every responsive grid starts with an explicit `grid-cols-1`. Step 3.5's `EventGrid` must keep it.

**2. Hydration warning on `<html>`, only on the phone.**

- **Message:** "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties", pointing at `<html>` with an extra `__gcrremoteframetoken="…"` attribute.
- **Cause:** not our code. Chrome on Android adds that attribute to `<html>` before React hydrates (browser extensions do the same with other attributes).
- **Fix:** `suppressHydrationWarning` on `<html>` in the root layout. This is what Next.js recommends for it. It only covers attribute differences on that one element, one level deep. A real mismatch anywhere inside the page (like the campus-time bug in §5.2) is still reported.

### 5.8 EventGrid & EmptyState (Step 3.5)

**Files:** `src/components/events/EventGrid.tsx`, `src/components/ui/EmptyState.tsx` (new primitive), `headingLevel` prop on `src/components/events/EventCard.tsx`
**Status:** ✅ Step 3.5 complete (grid + empty state). Loading skeleton deferred to Phase 7. Bench: `src/app/_bench/FeedBench.tsx`.

#### Business & Product Purpose

The grid is where students scan events; it has to fit every screen (1 → 2 → 3 columns) and never make the page wider than a phone. When a filter combination matches nothing, the empty state tells the student *why* the page is empty and gives a one-click way back, instead of a blank area that looks broken.

**Scope decision (product owner, 2026-11-02):** the loading skeleton was left out. Events come from mock data already in the page, so there is nothing to wait for and a skeleton would never appear. It comes back in Phase 7 with the real API, where it can be tested against actual loading (and `CardSkeleton` must first be reshaped to match `EventCard`, see §5.4 notes).

#### Core Concepts & Engineering Decisions

- **`EventGrid` renders the list or the empty state**, never both. The empty state is a **slot** (`emptyState: ReactNode`): the grid doesn't know about filters, so the copy and the "Clear filters" action stay with the page that owns the filters.
- **`grid-cols-1` is built in.** It's the fix from §5.7 (the phone column is `minmax(0, 1fr)`), now part of the component so no page can forget it.
- **Card titles are `<h2>`.** The cards sit directly under the page `<h1>` ("Upcoming events"), so `EventGrid` passes `headingLevel="h2"`. `EventCard` keeps `'h3'` as its default for pages where cards sit under a section `<h2>` (e.g. a club page in Phase 4).
- **Focus after "Clear filters".** Clicking it removes the empty state, including the focused button, so focus would fall back to `<body>` and keyboard users would restart from the top of the page. `EventGrid` notes any click inside the empty state (`onClickCapture`; keyboard Enter/Space also fire `click`). When the list comes back, a `useEffect` moves focus to the `<ul>` (`tabIndex={-1}`: focusable from script, never a Tab stop) **only if** focus is on `<body>`. The next Tab lands on the first card. Verified in headless Chromium: after Enter on "Clear filters", `document.activeElement` is the `Events` list; one Tab later it's the first card's link.
- **`'use client'`** on `EventGrid` only (it has a ref + effect). `EmptyState` has no hooks and works as a Server Component too.
- **`EmptyState` is generic:** `title`, `description`, decorative `icon`, `action` slot. The clubs directory and the calendar agenda (Phase 4) can reuse it.

#### Accessibility

- The list is `<ul aria-label="Events">`: screen readers announce "Events, list, 6 items".
- The count in the toolbar (`aria-live="polite"`) already announces "No events" / "6 events", so the empty state itself is not a live region (no double announcement).
- The empty-state icon is `aria-hidden`; the title is a `<p>`, not a heading: it's a message, not a section of the page.
- Focus management after "Clear filters" (above).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `emptyState` slot | `EventGrid` builds the empty state and takes `onClearFilters` | The grid would need to know about filters and their copy. With a slot, the page decides, and other pages can show a different message ("No events this month"). |
| Generic `EmptyState` in `ui/` | Event-specific empty state in `events/` | The same "dashed box + icon + message + action" is needed on `/clubs` and `/calendar`. |
| Focus moved to the list, only when focus fell to `<body>` | Always focus the list / never manage focus | Always focusing would steal focus from a mouse user who clicked elsewhere; never managing it sends keyboard users back to the top. |
| `onClickCapture` | `onFocus`/`onBlur` tracking | Browsers differ on whether `blur` fires when the focused element is removed, so blur-based tracking is unreliable. A click is the event that actually causes the removal. |
| `headingLevel` prop on `EventCard` | Change the default to `h2` | The right level depends on where the card is used; a prop keeps the card correct in both places. |
| Defer the skeleton | Build it now | It would never be visible with mock data, so it couldn't be tested or judged. Build it when there's real loading. |

#### Component Contract

```ts
// src/components/events/EventGrid.tsx ('use client') — forwardRef<HTMLDivElement> (wrapper)
interface EventGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  events: EventItem[];
  schedules: Record<string, EventSchedule>;   // server-formatted (§5.2)
  onRsvpToggle: (event: EventItem) => void;
  emptyState: React.ReactNode;                // shown when events is empty
}

// src/components/ui/EmptyState.tsx — forwardRef<HTMLDivElement>
interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  description?: string;
  icon?: React.ReactNode;     // decorative
  action?: React.ReactNode;   // e.g. <Button variant="secondary">
}

// EventCard (added)
headingLevel?: 'h2' | 'h3';   // default 'h3'
```

#### Usage Example

```tsx
<EventGrid
  events={visibleEvents}
  schedules={schedules}
  onRsvpToggle={handleRsvpToggle}
  emptyState={
    <EmptyState
      icon={<CalendarIcon className="h-6 w-6" />}
      title="No events match your filters"
      description="Try another campus or category."
      action={<Button variant="secondary" onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>Clear filters</Button>}
    />
  }
/>
```

#### Notes for later steps

- **Step 3.6:** the bench becomes the real `/` page: keep `FeedToolbar` + `CategoryFilter` + `EventGrid`; drop the bench label, self-checks and checklist; apply `getUpcomingEvents(events, now)` with `now` from the server (`await connection()`, §5.5).
- **Phase 7:** loading skeleton (reshape `CardSkeleton` to `EventCard`'s geometry first), plus an error state ("Couldn't load events · Retry") using the same `EmptyState`.

### 5.9 Assembled `/` page & EventFeed (Step 3.6): Phase 3 complete

**Files:** `src/app/page.tsx` (Server Component), `src/components/events/EventFeed.tsx` (new, `'use client'`), `loading` prop on `CardBanner` + `imageLoading` on `EventCard` + first-row logic in `EventGrid`. Removed: `src/app/_bench/`.
**Status:** ✅ Step 3.6 complete; Phase 3 done. `/` is the real event feed; there is no bench any more.

#### Business & Product Purpose

Students opening Campus Hub land on the list of events that haven't ended yet, soonest first, and can narrow it by campus and category, RSVP from the card, or open an event. Searching by name is the navbar's job (§5.1 correction 4).

#### Core Concepts & Engineering Decisions

- **Server page / client feed split.** `page.tsx` (server) does everything that depends on time or on the server's time-zone data, then passes plain data down:
  - `await connection()`: render per request, so "now" is the request time, not the build time (§5.5).
  - `getUpcomingEvents(mockEvents, Date.now())`: drops events that have ended, sorts by start time.
  - `getEventSchedules(upcomingEvents)`: formats times on the server (§5.2).
  `EventFeed` (client) owns the interactive state: filters, RSVPs, toasts. It is the former bench minus the bench parts.
- **Two empty states.** "No upcoming events yet" (nothing scheduled at all, so no button: clearing filters wouldn't help) vs. "No events match your filters" + "Clear filters". With the current mock data the first one becomes real after Nov 27, 2026, when every mock event has ended.
- **First-row flyers load eagerly.** `next/image` is lazy by default; Next warned that the first visible flyer was the Largest Contentful Paint image but lazy. `EventGrid` passes `imageLoading="eager"` to the first 3 cards (the first row on desktop; on phones it covers the first screen and a bit more), the rest stay lazy. `CardBanner` gained a `loading` prop for this.
- **RSVP state is local.** It lives in `EventFeed`'s state and resets on reload. Phase 7 sends the request (optimistic update, roll back on failure).

#### Verified (headless Chromium, 390px phone)

- One `<h1>` ("Upcoming events"), no bench text, 6 cards sorted by date, page exactly 390px wide.
- EMINES → "1 event"; RSVP → toast "You're going" and the button turns "Going".
- Console: no errors, no hydration warnings, no LCP warning. `/` is served with `Cache-Control: no-cache, must-revalidate` (rendered per request).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Server page + one client `EventFeed` | Make the whole page `'use client'` | The server part ships no JavaScript and is the only place that can decide "now" and format times consistently. Only the interactive part is client code. |
| `connection()` | Static page + filter ended events in the browser | Filtering in the browser uses the browser's clock (can differ from the server's) and causes a hydration mismatch; a static page would freeze "now" at the build date. |
| Eager first row | `preload` on the first card | `preload` is for one known LCP image; which card is LCP depends on the screen width (and the first card may have no flyer). `loading="eager"` on the first row covers every layout without injecting several `<link rel="preload">`. |
| No bench on `/` | Keep a bench below the feed | `/` is now the product. Future steps put their bench on their own route (see below). |

#### Component Contract

```ts
// src/components/events/EventFeed.tsx ('use client')
interface EventFeedProps {
  initialEvents: EventItem[];                 // upcoming, sorted (server)
  schedules: Record<string, EventSchedule>;   // formatted (server)
}

// Added
CardBanner: loading?: 'lazy' | 'eager';       // passed to next/image (default lazy)
EventCard:  imageLoading?: 'lazy' | 'eager';
```

#### Usage Example

```tsx
// src/app/page.tsx
export default async function Home() {
  await connection();
  const upcomingEvents = getUpcomingEvents(mockEvents, Date.now());
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <EventFeed initialEvents={upcomingEvents} schedules={getEventSchedules(upcomingEvents)} />
    </div>
  );
}
```

#### Notes for later

- **Benches from Phase 4 on:** `src/app/page.tsx` is no longer a bench. Superseded by the `/test` page (§5.10).
- **Not verified:** a production build (`next build` + `next start`). The Docker image runs `npm run dev`; the production path should be checked before deployment.
- **Phase 7:** swap `mockEvents` for the API; loading skeleton and error state (§5.8); RSVP requests with rollback.

### 5.10 Test Page `/test` (workflow change, 2026-11-02)

**Status:** ✅ Built. File: `src/app/test/page.tsx`. `CLAUDE.md` §5 rule 4 updated.

#### Business & Product Purpose
Real pages (`/`, later `/calendar`, `/clubs`, ...) must only ever show finished, validated UI. New work needs a place to be tried in the browser first. Workflow: **build on `/test` → user validates → integrate into the real route → reset `/test` for the next step.**

#### Core Concepts & Engineering Decisions
- **Dev only:** `if (process.env.NODE_ENV === 'production') notFound();` makes it a 404 in a production build, and `metadata.robots` is `noindex, nofollow` in case it is ever reachable.
- **Scenarios via `?scenario=`:** states that are hard to reach on the real page get a link (e.g. `empty` = "Nothing scheduled", which `/` only shows once every mock event has ended). `searchParams` is a `Promise` in Next.js 16 and is awaited. Unknown values fall back to `default`.
- **`key={active}` on the feed:** switching scenario remounts it, so filter and RSVP state start fresh.
- **Amber dashed panel** for the test controls and checklist, so it can never be mistaken for product UI. Not linked from the navbar.
- First content: the Phase 3 feed (mock events + nothing scheduled) with its 5 checks.

#### Architectural Tradeoffs
- **`/test` route vs. bench in `src/app/page.tsx` (old rule):** the old rule meant the home page was a test page until the last step of each phase. A separate route keeps `/` real at all times.
- **`/test` vs. private `_bench` folder:** `_folder` is never a route, so it can only be reached by importing it from a real page. A real route is needed to open it in the browser.
- **Dev guard vs. deleting the file before deploy:** the guard can't be forgotten.

#### Component Contract
Route `GET /test?scenario=default|empty`. No props (page component).

#### Usage
Open `http://localhost:3000/test` (or `http://10.32.137.107:3000/test` from a phone on the network).

---

## 6. Phase 4 — Core Public Views (`/calendar`, `/clubs`, `/events/[id]`)

**Phase 4 order (agreed 2026-11-04):**

| # | Work | Why in this order |
| --- | --- | --- |
| 1 | `/calendar`: 4.1 `Tabs` keyboard fix ✅ · 4.2 date helpers + `MonthGrid` ✅ · 4.3 header ✅ · 4.4 selected-day agenda (under the grid on phones, see §6.4) ✅ · 4.5 week view ✅ · 4.6 assemble `/calendar` ✅ | Done 2026-11-05 |
| 2 | `/events/[id]`: 4.7 data clean-up + main content · 4.8 RSVP card (sticky on desktop, bottom bar on phones) · 4.9 attendees + "See who's going" dialog · 4.10 assemble the route (`notFound`, metadata, back link) · 4.11 *optional* open as a modal over the feed | Every `EventCard` on `/` already links here and gets a 404; calendar agenda items link here too. Optionally also opened as a modal over the feed (intercepting route); a shared link still opens the full page |
| 3 | `/clubs`, `/clubs/[slug]`: 4.12 club helpers + `ClubCard` · 4.13 `/clubs` directory with campus filter (goes live) · 4.14 club page header (banner, logo, bio, contact) · 4.15 club events (upcoming + past), `/clubs/[slug]` goes live. One scrolling page, no tabs (so the `Tabs` underline fix isn't needed yet) | Club pages list event cards, which then lead somewhere real. Fix the `evt_hackathon_ai` club name and the `Tabs` underline style first |
| 4 | Search palette (⌘K), **new task**: 4.16 search logic + `SearchPalette` on `/test` · 4.17 wire it to the navbar button and ⌘K (Phase 4 done) | Searches events and clubs, so it needs both pages to exist. The trigger, shortcut and focus handling are done (§3.3); today it shows "Search is coming soon" (§3.9). Mock data now, API in Phase 7 |

**Not in Phase 4:** the notification bell shows fake notifications from `AppShell`. Real ones come with Phase 6 (WebSockets), since they depend on the backend.

### 6.1 Tabs keyboard navigation (Step 4.1)

**Files:** `src/components/ui/Tabs.tsx` (`TabsList` gains `onKeyDown` handling and `aria-orientation`). Test: `src/app/test/page.tsx` + `src/app/test/TabsDemo.tsx`.
**Status:** ✅ Validated (2026-11-03). Nothing on a real page uses `Tabs` yet, so there was nothing to integrate; `/calendar` (month/week) is the first user.

#### Business & Product Purpose

`/calendar` switches between month and week views, and club pages will switch sections, using `Tabs`. Before this step a keyboard user could reach only the selected tab: the others had `tabIndex={-1}` (roving tabIndex) but no key moved focus to them, so they could never be selected without a mouse. Now the arrow keys work, as the WAI-ARIA tabs pattern requires.

#### Core Concepts & Engineering Decisions

- **Roving tabIndex, completed.** Tab still enters the list once, on the selected tab, and the next Tab goes to the panel. Inside the list: `←`/`→` previous/next (wraps around), `Home`/`End` first/last.
- **Automatic activation.** Moving focus also selects the tab (the APG default when a panel shows without a delay; ours are in memory). The handler calls `target.click()`, so it goes through `TabsTrigger`'s `onClick`: the tab is selected, `onValueChange` fires and the consumer's own `onClick` runs, with no second code path.
- **Handler on `TabsList`, not on each trigger.** One `onKeyDown` on the `role="tablist"` element finds the enabled tabs with `querySelectorAll('[role="tab"]:not([disabled])')`. Disabled tabs are skipped. A consumer's `onKeyDown` runs first and can call `preventDefault()` to opt out.
- **Lookup table for moves.** `TAB_MOVES: Record<TabNavKey, (current, count, isRtl) => number>` (Engineering Law 4): adding a key fails the build until it has a move.
- **RTL-ready.** `getComputedStyle(list).direction === 'rtl'` swaps `←` and `→`, so "next" follows the reading order in Arabic (Phase 7) with no prop.
- **`aria-orientation="horizontal"`** tells screen readers which arrows to use (it is the default for `tablist`, but stating it is free and explicit).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Read the tabs from the DOM on key press | Each trigger registers itself in context (array of refs) | Registration needs effects, ordering logic and re-renders. The DOM is already in the right order and is only read on a key press, never during render, so it is SSR-safe without a mount guard. |
| Automatic activation | Manual (arrows move focus, Enter/Space select) | Panels are instant, so selecting on focus saves a keypress. Manual is better only when a panel fetches data; switch then. |
| `target.click()` | Call `setActiveTab(value)` from the list | The list doesn't know the trigger values. `click()` reuses the trigger's own logic and keeps `onClick` side effects consistent between mouse and keyboard. |
| Skip disabled tabs | Keep them focusable (APG allows both) | Our disabled tabs have nothing behind them; focusing one would say "dimmed" and do nothing. |
| Read direction from CSS | `dir` prop on `Tabs` | `dir` is inherited from `<html>` or any ancestor; reading the computed value is always right and needs no wiring. |

#### Component Contract

No new props. Behaviour added to `TabsList`:

```ts
// TabsListProps unchanged: extends React.HTMLAttributes<HTMLDivElement> + variant?: 'segmented' | 'underline'
// Keys handled on role="tablist": ArrowLeft, ArrowRight (swapped in RTL), Home, End.
// onKeyDown (consumer) runs first; event.preventDefault() there skips the built-in handling.
```

#### Usage Example

```tsx
const [view, setView] = useState('month');

<Tabs value={view} onValueChange={setView}>
  <TabsList aria-label="Calendar view">
    <TabsTrigger value="month">Month</TabsTrigger>
    <TabsTrigger value="week">Week</TabsTrigger>
  </TabsList>
  <TabsContent value="month">…</TabsContent>
  <TabsContent value="week">…</TabsContent>
</Tabs>
```

#### Notes for later

- **Always pass a `defaultValue` or `value` that matches a tab.** The default is `''`; if no tab matches, every tab has `tabIndex={-1}` and the list can't be reached with Tab at all.
- **`underline` variant styling:** the active trigger uses the segmented look (white pill + shadow) in both variants. Fix when a club page first uses `underline`.
- **Not run:** ESLint (the Docker image has no `eslint.config`). `tsc --noEmit` passes inside the container.

### 6.2 Calendar date helpers & MonthGrid (Step 4.2)

**Files:** `src/lib/calendar.ts` (new), `src/components/calendar/MonthGrid.tsx` (new, `'use client'`). Test: `src/app/test/page.tsx` + `src/app/test/CalendarDemo.tsx` (scenarios `default`, `busy`, `edges`).
**Status:** ✅ Validated (2026-11-03). Live on `/calendar` (§6.6).

#### Business & Product Purpose

The month view answers "what's on this month, and which days are busy?" at a glance. Students tap (or arrow to) a day to see its events; on phones each day shows coloured dots, on larger screens the first event titles.

#### Core Concepts & Engineering Decisions

- **`DayKey` = `'YYYY-MM-DD'` string.** A date, not a moment. It crosses the server → client boundary unchanged, compares with `===` and sorts with `<`.
- **Two kinds of date code, kept apart.**
  - *Moment → campus date* (`toCampusDayKey`, `getEventIdsByDay`) needs time-zone data, which differs between runtimes (§5.2). **Server only**: the page computes `todayKey` and the per-day map and passes them down.
  - *Date arithmetic* (`addDays`, `addMonths`, `weekdayIndex`, `buildMonthMatrix`) maps a `DayKey` to UTC midnight, so no time zone is involved and it's safe in the browser. Labels (`formatMonthTitle`, `formatDayLabel`) format that UTC midnight with `timeZone: 'UTC'` for the same reason.
- **The selected day decides the month.** `MonthGrid` has no `month` prop: it shows the month of `selectedKey`. One piece of state, and the selected (focusable) day is always on screen. Prev/next month in Step 4.3 = `addMonths(selected, ±1)`.
- **Fixed 6 × 7 grid**, Monday first: the height never changes between months (no layout jump), leading/trailing days are dimmed and clickable (they switch month).
- **Multi-day events** are listed on every day they cover; the end is exclusive (ending at 00:00 doesn't spill over). Each day's list is in start-time order.
- **Ids per day, not events.** The server sends `Record<DayKey, string[]>`; the client resolves ids against its single events list (`useMemo`), so an RSVP changes one object and every day showing it agrees.
- **WAI-ARIA grid (date-picker keys).** `<table role="grid">` named by the month; `<th scope="col"><abbr title="Monday">Mon</abbr>`; `aria-selected` on the `td`; a `<button>` per day with roving `tabIndex` (only the selected day is a Tab stop), `aria-current="date"` on today, and a full label ("Thursday, November 5, 5 events"). Keys: arrows ±1 day / ±1 week, `Home`/`End` Monday/Sunday, `PageUp`/`PageDown` same day ±1 month (clamped: Jan 31 → Feb 28). Moving selects, as in `Tabs`. Arrows swap in RTL.
- **Focus after re-render.** A move can land in another month, i.e. on a newly rendered button. `selectDay` sets a `focusPending` ref; an effect on `selectedKey` focuses `button[data-day=…]`. Only grid interaction sets the flag, so outside changes (e.g. a "Today" button) don't steal focus.
- **Cell content is `aria-hidden`.** Dots and chips are visual; the count is in the label and the agenda (4.4) lists the events, so screen readers don't hear every title on every Tab.
- **Style tables:** `dayNumberStyles: Record<DayTone, …>` (today / selected / inMonth / outside, resolved by `getDayTone` in that priority), `chipStyles` and `dotStyles: Record<EventCategory, …>`, `GRID_MOVES: Record<GridNavKey, …>`.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `DayKey` strings + UTC-midnight maths | A date library (date-fns-tz, Luxon) | ~60 lines cover what we need with zero bundle cost. Time zones only matter on the server, where `Intl` already handles them. |
| Group days on the server | Group in the browser with `Intl` + `timeZone` | Browsers carry different tzdata for Morocco (§5.2): days near midnight could land on different dates than on the server and cause hydration mismatches. |
| Month derived from `selectedKey` | Separate `month` and `selected` state | Two states can disagree (selected day not visible = no Tab stop). One state can't. |
| Fixed 6 rows | 4–6 rows depending on the month | Content below the grid (agenda) doesn't jump when changing month. |
| `<table role="grid">` + buttons | `div` CSS grid + `role="grid"`/`row`/`gridcell` | Native table semantics give rows/columns and header association for free; buttons give click, Enter and Space for free. |
| Selection follows arrows | Arrows move focus, Enter selects | The agenda updates instantly with no fetch; one keypress saved per day, same model as `Tabs`. |

#### Component Contract

```ts
// src/lib/calendar.ts
type DayKey = string; // 'YYYY-MM-DD', campus date
interface CalendarDay { key: DayKey; day: number; inMonth: boolean }
CALENDAR_WEEKS = 6; WEEKDAYS: { short; long }[] // Monday first
addDays(key, n), addMonths(key, n) /* clamped */, weekdayIndex(key) /* 0 = Mon */, isSameMonth(a, b)
buildMonthMatrix(key): CalendarDay[]            // 42 days
formatMonthTitle(key) /* "November 2026" */, formatDayLabel(key) /* "Thursday, November 5" */
// Server only:
toCampusDayKey(ms): DayKey
getEventIdsByDay(events): Record<DayKey, string[]>

// src/components/calendar/MonthGrid.tsx ('use client', forwardRef<HTMLTableElement>)
interface MonthGridProps extends React.TableHTMLAttributes<HTMLTableElement> {
  selectedKey: DayKey;                          // also picks the month shown
  todayKey: DayKey;                             // server, campus time
  eventsByDay: Record<DayKey, EventItem[]>;     // start-time order
  onSelectDay: (key: DayKey) => void;
}
```

#### Usage Example

```tsx
// Server page
await connection();
const todayKey = toCampusDayKey(Date.now());
<Calendar events={events} eventIdsByDay={getEventIdsByDay(events)} todayKey={todayKey} />

// Client
const [selected, setSelected] = useState(todayKey);
<MonthGrid selectedKey={selected} todayKey={todayKey} eventsByDay={eventsByDay} onSelectDay={setSelected} />
```

#### Verified (server HTML via nginx)

6 rows × 7 days in every scenario; today (Nov 3) is the only Tab stop with `aria-current="date"`; the hackathon is on Nov 13–15, not 16; the busy scenario reads "Thursday, November 5, 5 events" and shows "+3 more" once; January 2027 runs Mon Dec 28 → Sun Feb 7. `tsc --noEmit` passes. Keyboard, RTL and phone layout: manual checks on `/test`.

#### Notes for later

- **Mock data** is all November 2026; other months are empty until Phase 7's API (which should accept a date range: the 42-day window of `buildMonthMatrix`).
- **Phase 7 i18n:** `WEEKDAYS`, the formatters (`'en'`) and "+N more" / "N events".

### 6.3 CalendarHeader & calendar views (Step 4.3)

**Files:** `src/components/calendar/CalendarHeader.tsx` (new, `'use client'`); `src/lib/calendar.ts` (added `CalendarView`, `CALENDAR_VIEWS`, `isCalendarView`, `CALENDAR_STEPS`, `CALENDAR_TITLES`, `formatWeekTitle`). Test: `src/app/test/CalendarDemo.tsx`.
**Status:** ✅ Validated (2026-11-04). Live on `/calendar` (§6.6).

#### Business & Product Purpose

Students need to see which month (or week) they're looking at, step forward to plan ahead, get back to today in one tap, and switch between the month overview and the week detail.

#### Core Concepts & Engineering Decisions

- **Header inside `<Tabs>`, panels outside it.** `CalendarHeader` renders the `TabsList`; the page renders one `TabsContent` per view under the same `<Tabs value={view}>`. That keeps the `aria-controls` ↔ `aria-labelledby` wiring of the `Tabs` primitive intact while the header stays a self-contained row.
- **Views as tables.** `CALENDAR_STEPS: Record<CalendarView, (key, ±1) => DayKey>` (month = `addMonths`, clamped; week = ±7 days) and `CALENDAR_TITLES: Record<CalendarView, (key) => string>`. Adding a view (e.g. "day") fails the build until it has a step and a title.
- **Prev/next move the selection.** Still one piece of state (§6.2): `selectedKey` moves by a step and the view follows it. Today = `setSelectedKey(todayKey)`.
- **`formatWeekTitle` by hand**: "Nov 2 – 8, 2026" / "Nov 30 – Dec 6, 2026" / "Dec 28, 2026 – Jan 3, 2027". Not `Intl.DateTimeFormat#formatRange`: its spacing around the dash (thin vs. normal spaces) differs between ICU versions, i.e. between Node and browsers, which would be a hydration mismatch.
- **Accessibility.** The icon buttons have names that follow the view ("Previous month" / "Next week"). The title is an `aria-live="polite"` heading: after pressing "Next month" focus stays on the button, so the new title is read out. Chevrons are `aria-hidden` and flip in RTL (`rtl:-scale-x-100`), so "previous" points the right way in Arabic.
- **Panel Tab stop.** `TabsContent` has `tabIndex={0}` by default (for panels without focusable content). The month panel passes `tabIndex={-1}` because the grid already has a Tab stop (the selected day).
- **`headingLevel`** (`'h2'` default): the page decides the outline, as with `EventCard`.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Header renders only the `TabsList` | Header owns `<Tabs>` and takes the panels as `children` | The page keeps the layout between header and panels (e.g. agenda next to the grid in 4.4); the header doesn't become a layout component. |
| Callbacks (`onPrevious`/`onNext`/`onToday`) | Header gets `selectedKey` + `onSelectDay` and computes steps itself | The header stays dumb and testable; the page is the single place that owns calendar state. |
| Title passed in as a string | Header formats it from `selectedKey` | The same header could show a day or a range without new props. |
| `aria-live` on the title | Announce nothing; move focus to the grid after Next | Moving focus away from the button breaks repeated presses ("Next, Next, Next"). |
| Today always enabled | Disabled when today is selected | A disabled button drops out of the Tab order and moves the controls under the user's finger; pressing it on today is harmless. |

#### Component Contract

```ts
// src/components/calendar/CalendarHeader.tsx ('use client', forwardRef<HTMLDivElement>)
// Must be rendered inside <Tabs value={view}>.
interface CalendarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;                 // CALENDAR_TITLES[view](selectedKey)
  view: CalendarView;            // picks the prev/next labels
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  headingLevel?: 'h1' | 'h2';    // default 'h2'
}

// src/lib/calendar.ts (client-safe)
type CalendarView = 'month' | 'week';
CALENDAR_VIEWS: { value: CalendarView; label: string }[]
isCalendarView(value: string): value is CalendarView
CALENDAR_STEPS: Record<CalendarView, (key: DayKey, direction: -1 | 1) => DayKey>
CALENDAR_TITLES: Record<CalendarView, (key: DayKey) => string>
formatWeekTitle(key): string
```

#### Usage Example

```tsx
const [selected, setSelected] = useState(todayKey);
const [view, setView] = useState<CalendarView>('month');

<Tabs value={view} onValueChange={(next) => isCalendarView(next) && setView(next)}>
  <CalendarHeader
    title={CALENDAR_TITLES[view](selected)}
    view={view}
    onPrevious={() => setSelected((key) => CALENDAR_STEPS[view](key, -1))}
    onNext={() => setSelected((key) => CALENDAR_STEPS[view](key, 1))}
    onToday={() => setSelected(todayKey)}
  />
  <TabsContent value="month" tabIndex={-1}>
    <MonthGrid selectedKey={selected} todayKey={todayKey} eventsByDay={eventsByDay} onSelectDay={setSelected} />
  </TabsContent>
  <TabsContent value="week">…</TabsContent>
</Tabs>
```

#### Verified

Server HTML: title "November 2026" in the live heading, "Previous month" / "Next month" labels, Month tab selected, month panel `tabindex="-1"`. Node 22 in the container: `formatWeekTitle` gives the three formats above; `CALENDAR_STEPS.month('2027-01-31', 1)` = `2027-02-28`, `('2028-03-31', -1)` = `2028-02-29`, `week('2026-12-29', 1)` = `2027-01-05`. `tsc --noEmit` passes.

#### Notes for later

- **Double announcement:** selecting a day in another month from the grid announces the day (focus) and the new title (live region). Acceptable; revisit if screen-reader testing finds it noisy.
- **Phase 7 i18n:** `STEP_LABELS`, `CALENDAR_VIEWS` labels, "Today", `formatWeekTitle` patterns.

### 6.4 DayAgenda & event times (Step 4.4)

**Files:** `src/components/calendar/DayAgenda.tsx` (new, no `'use client'` needed: no state or handlers); `src/lib/calendar.ts` (added `EventTimes`, `getEventTimes`, `formatAgendaTime`; `getEventIdsByDay` now shares `getEventDaySpan`). Test: `src/app/test/CalendarDemo.tsx`, `src/app/test/page.tsx`. Also fixed the stale "UTC+1 in November" comment in `src/lib/mockData.ts`.
**Status:** ✅ Validated (2026-11-04).

#### Business & Product Purpose

The grid shows *that* a day is busy; the agenda shows *what* is on: time, title, club, place, category, and whether you're going. Each row opens the event page.

#### Core Concepts & Engineering Decisions

- **Times per event, wording per day.** The server sends `EventTimes = { startDay, endDay, start, end }` per event (`getEventTimes`, formatted in campus time). `formatAgendaTime(times, day)` (pure, client-safe) turns that into the label for the day shown: `5:00 PM – 8:00 PM` for a one-day event; for multi-day events `From 8:00 AM` (first day), `All day` (middle days), `Until 5:00 PM` (last day).
- **One source for "which days does an event cover".** `getEventDaySpan` is used by both `getEventIdsByDay` (grid) and `getEventTimes` (agenda), so the two can never disagree.
- **Stretched link per row**, same as `EventCard`: the title is the only link and its `::after` covers the row, so the whole row is clickable and the focus ring wraps the row.
- **Category accent with `border-s-4`** (logical "start" side) from `accentStyles: Record<EventCategory, string>`: it moves to the right edge in RTL with no extra code. Category and "Going" use the existing `Badge`.
- **Landmark:** `<section aria-labelledby>` named by the day heading ("Thursday, November 5"), then the count, then a `<ul>` of links. The empty day reuses `EmptyState` (as planned in §5.8) with tighter padding.
- **Tab order:** header controls → selected day in the grid → the day's events. The grid arrows update the list; no live region, since the grid cell's label already says "N events".
- **Layout (page's job):** under the grid below `lg`; from `lg` a `minmax(0,1fr) 20rem` two-column grid with the agenda `sticky top-20` (below the navbar).

#### Deviation from the plan: no drawer on phones

The brief said "selected-day agenda drawer". On phones the list is placed **under the grid** instead:
- A drawer opening on every tap gets in the way of browsing days (tap, close, tap, close).
- The 6-row grid on a phone is ~400px tall, so the list starts within the first screen and is reached by scrolling.
- No extra overlay, focus trap or scroll lock to maintain.
Revisit if phone testing shows the list is too far down.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Server sends start/end day + time; client picks the wording | Server sends a label per (event, day) | One entry per event instead of one per day it covers, and the wording rules stay in one pure function. |
| `DayAgenda` gets `events` for one day | It gets `eventsByDay` + `dayKey` and looks up itself | It stays reusable for any list of events on a day (e.g. the week view's selected day). |
| List under the grid on phones | Bottom-sheet drawer | See "Deviation" above. |
| Badges for category and "Going" | Coloured text only | Same visual language as the feed cards; `Badge` already handles dark mode. |

#### Component Contract

```ts
// src/components/calendar/DayAgenda.tsx (forwardRef<HTMLElement>)
interface DayAgendaProps extends React.HTMLAttributes<HTMLElement> {
  dayKey: DayKey;
  events: EventItem[];                        // that day's events, start-time order
  eventTimes: Record<string, EventTimes>;     // getEventTimes (server)
  headingLevel?: 'h2' | 'h3';                 // default 'h2'
}

// src/lib/calendar.ts
interface EventTimes { startDay: DayKey; endDay: DayKey; start: string; end: string }
getEventTimes(events): Record<string, EventTimes>   // server only (time zone)
formatAgendaTime(times, day): string                 // client-safe
```

#### Usage Example

```tsx
<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <Tabs value={view} onValueChange={…}>…header + MonthGrid…</Tabs>
  <DayAgenda
    dayKey={selected}
    events={eventsByDay[selected] ?? []}
    eventTimes={eventTimes}
    className="lg:sticky lg:top-20"
  />
</div>
```

#### Verified

Server HTML: busy day lists 5 events in time order (8:00 AM … 5:00 PM – 8:00 PM masterclass) with "Going" badges; the default scenario shows today's heading and "Nothing on this day"; hackathon times are `8:00 AM` / `5:00 PM` (container Node, tzdata **2026e**: campus time is UTC+0 in Nov 2026). `tsc --noEmit` passes. Layout, keyboard, RTL: manual checks on `/test`.

#### Notes for later

- Rows link to `/events/[id]`, which 404s until the event page (next after `/calendar`).
- **Phase 7 i18n:** "From / Until / All day", "No events / N events", empty-state copy.

### 6.5 WeekGrid, shared day styles & `useDayGridNavigation` (Step 4.5)

**Files:** `src/components/calendar/WeekGrid.tsx` (new), `src/components/calendar/dayStyles.ts` (new), `src/hooks/useDayGridNavigation.ts` (new), `src/components/calendar/MonthGrid.tsx` (refactored onto the two shared modules, no visible change except `text-left` → `text-start` for RTL), `src/lib/calendar.ts` (`buildWeekDays`). Test: `/test?view=week` (combine with `scenario=busy`).
**Status:** ✅ Validated (2026-11-05). Live on `/calendar` (§6.6).

#### Business & Product Purpose

The week view answers "what does my week look like?" with times: seven columns, each listing that day's events with their time, so students can plan around classes.

#### Core Concepts & Engineering Decisions

- **Same grid, one row.** `<table role="grid">` named by the week title ("Nov 2 – 8, 2026"), weekday `<th>`s, one `<tr>` of 7 day buttons. Same labels, `aria-current="date"`, `aria-selected` and roving `tabIndex` as the month view, so screen-reader users meet one pattern.
- **Shared keyboard logic: `useDayGridNavigation(selectedKey, onSelectDay)`** returns `{ gridRef, selectDay, handleKeyDown }`. It holds `GRID_MOVES` (arrows, Home/End, PageUp/PageDown, RTL swap) and the "focus the day after re-render" effect that used to live in `MonthGrid`. In the week view ↑/↓ (±7 days) and ←/→ past Sunday/Monday move to the next/previous week; the week shown follows `selectedKey`.
- **Shared look: `dayStyles.ts`** holds `DayTone`, `getDayTone`, `dayNumberStyles`, `dayCellStyles`, `chipStyles`, `dotStyles`, `describeCount`, `MAX_DOTS`. Today/selected/category colours can't drift between the views.
- **Responsive content.** From `md` (768px) each column is `h-80` and shows up to 4 chips (time from `formatAgendaTime` + 2-line title) and "+N more"; overflow is clipped so long titles can't break the row. Below `md` a column is ~45–100px wide: day number + dots only, and the agenda underneath has the details (same split as the month view at `sm`).
- **`buildWeekDays(key)`** returns Monday → Sunday with `inMonth: true`: a week view doesn't dim days of the next month.
- **Test page:** `?view=week` opens the demo in week view (so the server HTML can be checked and the view linked to).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Day columns listing events | Hour-by-hour time grid (events positioned by start/end) | Positions need campus hours computed on the server per event and overlap handling; student events are few per day, so a list is clearer and works at every width. Revisit if days get crowded. |
| Extract a hook + style module now | Copy MonthGrid's code into WeekGrid | Two copies of keyboard and focus logic would drift; the second user is the right time to extract. |
| Hook returns a `selectDay` used for clicks too | Hook only handles keys | Clicking a day of another month re-renders the button elsewhere; the same "focus after render" path keeps focus on it. |
| Chips from `md`, dots below | Chips at every width | Seven columns on a 390px phone are ~50px wide: text would be unreadable. |

#### Component Contract

```ts
// src/components/calendar/WeekGrid.tsx ('use client', forwardRef<HTMLTableElement>)
interface WeekGridProps extends React.TableHTMLAttributes<HTMLTableElement> {
  selectedKey: DayKey;                        // also picks the week shown
  todayKey: DayKey;
  eventsByDay: Record<DayKey, EventItem[]>;
  eventTimes: Record<string, EventTimes>;     // getEventTimes (server)
  onSelectDay: (key: DayKey) => void;
}

// src/hooks/useDayGridNavigation.ts
useDayGridNavigation<T extends HTMLElement>(selectedKey, onSelectDay): {
  gridRef: RefObject<T | null>;               // put on the grid element (merge with a forwarded ref)
  selectDay: (key: DayKey) => void;           // use for clicks too
  handleKeyDown: (event: KeyboardEvent<T>) => void;
}
// Day buttons must carry data-day={key}; only the selected one has tabIndex 0.

// src/lib/calendar.ts
buildWeekDays(key): CalendarDay[]             // Monday → Sunday
```

#### Usage Example

```tsx
<TabsContent value="week" tabIndex={-1}>
  <WeekGrid
    selectedKey={selected}
    todayKey={todayKey}
    eventsByDay={eventsByDay}
    eventTimes={eventTimes}
    onSelectDay={setSelected}
  />
</TabsContent>
```

#### Verified

Server HTML of `/test?scenario=busy&view=week`: grid named "Nov 2 – 8, 2026", 7 cells, "Thursday, November 5, 5 events", 4 chips + "+1 more", chip times `8:00 AM – 9:00 AM` … and `7:00 PM – 10:00 PM` (jam session, Nov 7). Month view after the refactor: 42 cells, "+3 more" on Nov 5 as before. `tsc --noEmit` passes. Keyboard, widths, RTL: manual checks on `/test`.

### 6.6 `/calendar` page & EventCalendar (Step 4.6): calendar done

**Files:** `src/app/calendar/page.tsx` (new, Server Component), `src/components/calendar/EventCalendar.tsx` (new, `'use client'`). `/test` reset to "nothing under test"; `src/app/test/CalendarDemo.tsx` removed.
**Status:** ✅ Live (2026-11-05). The navbar and tab-bar "Calendar" links no longer lead to the 404 page.

#### Business & Product Purpose

Students can browse every campus event by month or week, pick a day, and open an event from that day's list, on the page the navigation has pointed to since Phase 2.

#### Core Concepts & Engineering Decisions

- **Same server/client split as `/` (§5.9).** `page.tsx` calls `await connection()` (render per request, so "today" is the request date), then computes everything that needs the campus time zone: `todayKey` (`toCampusDayKey`), `eventIdsByDay` (`getEventIdsByDay`), `eventTimes` (`getEventTimes`). `EventCalendar` gets plain data and owns the interactive state.
- **`EventCalendar` = the validated demo minus the test parts** (RTL checkbox, `initialKey` / `initialView`): `selectedKey` (starts at today) + `view` (starts at month); `eventsByDay` resolved from ids with `useMemo`; header + month/week panels inside one `<Tabs>`, `DayAgenda` beside (lg) or under the grid.
- **All events, not only upcoming.** Unlike the feed, a calendar also shows what already happened.
- **Headings.** The visible title is the month/week (an `h2` in the header, it changes as you browse), so the page `h1` "Calendar" is `sr-only`. Outline: h1 Calendar → h2 "November 2026" → h2 day agenda.
- **Metadata:** `title: 'Calendar | Campus Hub'` plus a description.

#### Verified (server HTML via nginx)

`/calendar` 200, `<title>Calendar | Campus Hub</title>`, h1 "Calendar", grid "November 2026" with 42 days, today (Nov 5) marked `aria-current="date"` with "1 event" and its agenda; navbar link and phone tab bar both `aria-current="page"` on Calendar; no test-page leftovers. `/` and `/test` still 200. `tsc --noEmit` passes.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| New `EventCalendar` component, page stays tiny | Put the state in `page.tsx` | A page with state must be a Client Component, which would move the time-zone work to the browser (§5.2). |
| sr-only `h1` | Visible "Calendar" heading above the header | The month title already says where you are; two big titles stacked is noise. Screen readers still get a page heading. |
| Selected day/view in React state | In the URL (`?date=2026-11-05&view=week`) | Simpler for now; see notes. |

#### Component Contract

```ts
// src/components/calendar/EventCalendar.tsx ('use client')
interface EventCalendarProps {
  events: EventItem[];
  eventIdsByDay: Record<DayKey, string[]>;     // server
  eventTimes: Record<string, EventTimes>;      // server
  todayKey: DayKey;                            // server
}
```

#### Usage Example

```tsx
// src/app/calendar/page.tsx
export default async function CalendarPage() {
  await connection();
  const events = mockEvents;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Calendar</h1>
      <EventCalendar
        events={events}
        eventIdsByDay={getEventIdsByDay(events)}
        eventTimes={getEventTimes(events)}
        todayKey={toCampusDayKey(Date.now())}
      />
    </div>
  );
}
```

#### Notes for later

- ~~**URL state:** the selected day and view reset on reload and can't be shared.~~ Done in §6.18 (2026-11-17), with `history.replaceState` instead of `router.replace`.
- **Phase 7:** fetch only the visible range (the 42-day window / the week) from the API, loading and error states, i18n of all calendar strings.
- **Not verified:** a production build (`next build`), same as `/`.

### 6.7 Event page data & EventDetails (Step 4.7)

**Files:** `src/components/events/EventDetails.tsx` (new, Server Component), `src/components/events/eventStyles.ts` (new: `flyerFallbackStyles`, moved out of `EventCard`), `src/lib/events.ts` (`getEventById`, `getClubById`), `src/lib/calendar.ts` (`EventDateDetails`, `getEventDateDetails`), `src/lib/mockData.ts` (3 clubs added, hackathon organizer fixed). Test: `/test?event=<id>`.
**Status:** ✅ Validated (2026-11-05).

#### Business & Product Purpose

Everything a student needs to decide whether to go: what it is, when, where, and who organizes it, with the flyer up top. This is the content the feed cards and the calendar agenda link to.

#### Core Concepts & Engineering Decisions

- **Mock data fixed first.** `mockClubs` was missing the organizers of two events (`club_um6p_sports`, `club_bde`), and the hackathon belonged to the media club with the wrong `club_name` (noted in §5.3). Added `LEET Dev` (`club_leet_dev`, now the hackathon organizer), `UM6P Sports Association` and `Student Events Committee`. Every event now has a club.
- **Lookups as pure functions** (`getEventById(events, id)`, `getClubById(clubs, id)`), taking the list as an argument: the page passes mocks today, Phase 7 swaps the call for the API without touching components.
- **`getEventDateDetails(event)` (server only)** gives the two "When" lines in campus time. One day: "Thursday, November 5, 2026" / "5:00 PM – 8:00 PM". Multi-day: "Friday, November 13 – Sunday, November 15, 2026" / "Starts 8:00 AM, ends 5:00 PM" (a range like "8:00 AM – 5:00 PM" would wrongly read as daily hours). It reuses `getEventDaySpan`, so the page and the calendar agree on which days an event covers. Built by hand like `formatWeekTitle` (no `formatRange`, §6.3).
- **`EventDetails` is a Server Component** (no state, no handlers): zero JavaScript for the biggest part of the page. Interactive parts (RSVP, attendees dialog) come as separate client components in 4.8/4.9.
- **Semantics.** `<article aria-labelledby>` named by the `h1` title; facts as a `<dl>` (When / Where / Organizer as `<dt>`, values as `<dd>`), icons `aria-hidden` (via `IconBase`); `<time dateTime>` on the date; "About this event" is an `h2` section.
- **Flyer** via `CardBanner` (16:9, rounded, bordered), `loading="eager"` because it's the first thing on screen (LCP), `sizes` matching the main column. No flyer → the same category tint + icon as the cards (`flyerFallbackStyles`, now shared).
- **Organizer link** to `/clubs/<slug>` (404 until the clubs step); if the club isn't known, the event's `club_name` is shown as text.
- **Description:** `whitespace-pre-line` keeps organizers' line breaks without rendering any HTML from user content.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Server Component | One client component for the whole page | Only RSVP and the attendee dialog need state; the rest ships no JS and renders with the HTML. |
| `<dl>` for the facts | Icon + text rows in `<div>`s | Screen readers get term/value pairs; the visual result is the same. |
| Separate "Starts …, ends …" wording for multi-day | Always "start – end" | "8:00 AM – 5:00 PM" over three days reads as daily hours. |
| `whitespace-pre-line` text | Markdown/HTML description | No sanitizer needed; the API sends plain text. Rich text can come later if organizers need it. |
| Fixed ids (`event-title`, `event-about`) | `useId()` | One event per page (also in a modal over the feed, 4.11), and fixed ids make in-page links possible. |

#### Component Contract

```ts
// src/components/events/EventDetails.tsx (Server Component, forwardRef<HTMLElement>)
interface EventDetailsProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  event: EventItem;
  club?: Club;                       // undefined → organizer name without link
  dateDetails: EventDateDetails;     // getEventDateDetails (server)
}

// src/lib/calendar.ts (server only)
interface EventDateDetails { date: string; time: string; isMultiDay: boolean }
getEventDateDetails(event): EventDateDetails

// src/lib/events.ts
getEventById(events, id): EventItem | undefined
getClubById(clubs, id): Club | undefined
```

#### Usage Example

```tsx
const event = getEventById(mockEvents, id);
if (!event) notFound();
<EventDetails event={event} club={getClubById(mockClubs, event.club_id)} dateDetails={getEventDateDetails(event)} />
```

#### Verified (server HTML)

No flyer (`evt_workshop_cine`): no `<img>`, fallback shown, "Thursday, November 5, 2026 · 5:00 PM – 8:00 PM", organizer link `/clubs/leet-frame`. Multi-day (`evt_hackathon_ai`): "Friday, November 13 – Sunday, November 15, 2026 · Starts 8:00 AM, ends 5:00 PM", organizer `LEET Dev` → `/clubs/leet-dev`. Unknown club: name as text, no link. `/` and `/calendar` still 200; `tsc --noEmit` passes.

#### Notes for later

- `evt_workshop_cine`'s description says "A 2-day practical session" but the event lasts 3 hours: mock copy only, fix with the API data.

### 6.8 RsvpCard & `useRsvpToast` (Step 4.8)

**Files:** `src/components/events/RsvpCard.tsx` (new, `'use client'`), `src/hooks/useRsvpToast.ts` (new; `EventFeed` now uses it). Test: `src/app/test/RsvpDemo.tsx` + `/test?event=<id>` (session switcher, "Ended" scenario).
**Status:** ✅ Validated (2026-11-05).

#### Business & Product Purpose

The one action on the page: say you're going (or not). It's always within reach, beside the content on desktop and as a bar above the tab bar on phones, and it explains itself when you can't act: signed out ("Log in to RSVP") or the event is over.

#### Core Concepts & Engineering Decisions

- **One element, two layouts.** Below `lg` the `<aside>` is `fixed` at the bottom, above the phone tab bar (`bottom-[calc(4rem+1px+env(safe-area-inset-bottom))]`, the tab bar's height; `md:bottom-0` once the tab bar is gone, with safe-area padding). From `lg` the same element is `sticky top-20` in the page's second grid column. A single DOM node means a single RSVP control for screen readers and keyboard users at every width.
- ~~**Spacer.** The component renders an `aria-hidden` `h-20 lg:hidden` div before the bar, so the end of the content can scroll above it.~~ Replaced in §6.19: the phone bar is now `sticky`, no spacer.
- **Controlled.** `event` and `onRsvpToggle` come from the parent (the page owns RSVP state so the attendee list in 4.9 updates with it), like `EventCard` in the feed.
- **State resolved once, then tables.** `getRsvpState(event, hasEnded, session.status)` → `'ended' | 'loading' | 'signedOut' | 'going' | 'notGoing'` (ended wins over everything). `STATUS: Record<RsvpState, …>` gives the status line and colour, an `actions` record gives the control: "RSVP" (primary), "Cancel RSVP" (secondary), "Log in to RSVP" (a `Link` styled as a primary button, `?next=/events/<id>` for Phase 5), a disabled spinner while the session loads, nothing once ended.
- **`hasEnded` comes from the server** (request time vs `end_time`), so server HTML and hydration agree.
- **Session from `useSession()`**, so Phase 5's real auth changes nothing here.
- **Counts:** "42 going" / "Be the first to RSVP"; after the end "87 went" / "Nobody RSVP'd".
- **Landmark:** `<aside aria-labelledby>` named by an "RSVP" heading that is `sr-only` in the phone bar and visible on the desktop card.
- **`useRsvpToast()`** returns `announceRsvp(before)`: "You're going" (success) / "RSVP cancelled" (info) with the event title. Feed and event page share one wording; it is called outside state updaters (Strict Mode runs those twice).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Same element repositioned by breakpoint | Inline card + separate fixed mobile bar | Two RSVP buttons in the DOM: duplicate tab stops, duplicate announcements, two places to keep in sync. |
| Bottom bar on phones | Card at the end of the content | The action stays reachable without scrolling past a long description. |
| "Cancel RSVP" label | "Going" toggle (as on the feed cards) | On a page with one action the explicit verb is clearer; the card's compact "Going" fits a grid. |
| Login link for signed-out users | Disabled RSVP button | A disabled button explains nothing and drops out of the Tab order; the link says what to do. |
| Controlled component | Card keeps its own RSVP state | The attendee list (4.9) must change with the RSVP. |

#### Component Contract

```ts
// src/components/events/RsvpCard.tsx ('use client', forwardRef<HTMLElement> → the <aside>)
interface RsvpCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  event: EventItem;                          // current RSVP state (controlled)
  hasEnded: boolean;                         // server: Date.parse(end_time) <= now
  onRsvpToggle: (before: EventItem) => void;
}
// Place it as the second child of: grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start

// src/hooks/useRsvpToast.ts
useRsvpToast(): (before: EventItem) => void
```

#### Usage Example

```tsx
const [event, setEvent] = useState(initialEvent);
const announceRsvp = useRsvpToast();

<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <EventDetails … />
  <RsvpCard
    event={event}
    hasEnded={hasEnded}
    onRsvpToggle={(before) => {
      setEvent(toggleRsvp);
      announceRsvp(before);
    }}
  />
</div>
```

#### Verified (server HTML)

Going (`evt_workshop_cine`): "You're going · 42 going · Cancel RSVP". Not going (jam session): "87 going · RSVP". Zero: "Be the first to RSVP". Ended: "This event has ended · 87 went", no control. Spacer present. `/` still 200 after the `useRsvpToast` refactor; `tsc --noEmit` passes. Clicks, toasts, sessions and the layouts: manual checks on `/test`.

#### Notes for later

- ~~**Footer under the phone bar:** the spacer sits in `<main>`, so at the very bottom of the page the bar covers the last ~5rem of the footer. Fix in 4.10 if it bothers (e.g. hide the bar once the footer is in view).~~ Fixed in §6.19 (`sticky` instead of `fixed`).
- **Toasts on phones** appear just above the tab bar, i.e. over the RSVP bar, for 4 s. Acceptable (they report the RSVP itself); revisit with the Phase 6 toasts.
- **Phase 7:** send the RSVP (optimistic, roll back + danger toast on failure); `/auth/login` must honour `?next=`.

### 6.9 AttendeesSection & mock attendee list (Step 4.9)

**Files:** `src/components/events/AttendeesSection.tsx` (new, `'use client'`), `src/lib/mockData.ts` (`getMockAttendees`), `src/components/ui/Modal.tsx` (accessibility upgrade, §2.4). Test: `src/app/test/RsvpDemo.tsx` (the card and the list share one RSVP state).
**Status:** ✅ Validated (2026-11-05). Live on `/events/[id]` (§6.10).

#### Business & Product Purpose

"Who else is going?" is often what decides it. The section shows faces and names at a glance, and the full list on demand; your own RSVP shows up in it immediately.

#### Core Concepts & Engineering Decisions

- **The user is added on the client.** `attendees` never includes the current user; `AttendeesSection` prepends "You" when the session is signed in and `event.has_user_rsvpd` is true. RSVP clicks change `event` (shared with `RsvpCard`), so "You" appears and disappears at once, without refetching the list.
- **Mock list:** `getMockAttendees(event)` = the event's `attendees_preview`, then deterministic generated names (fixed pools, no randomness, so server and client agree) until the length is `rsvps_count` minus the user if going. Phase 7: `GET /api/events/:id/attendees` (paginated).
- **Summary sentence for everyone, avatars for the eyes.** `AvatarGroup` (6 + "+N" from `total`) is `aria-hidden`; the visible sentence "You, Salma Idrissi and 40 others" is what screen readers read. `summarize(names, total)` handles 1 name, 2 names, "and N others", and the case where only a count is known.
- **Dialog for the full list** (`Modal` + `ModalHeader` + `ModalTitle` + `ModalContent`, scrolling at 65vh): avatar + name rows, a green "You" badge. The trigger has `aria-haspopup="dialog"`.
- **Ended events** say "Who went" (heading and dialog title, `HEADINGS` table) and "Nobody RSVP'd to this event."; upcoming with no RSVPs: "Nobody has RSVP'd yet." and no button.
- **Placement:** the main column under "About this event", inside `<section aria-labelledby>` named by its `h2` ("Who's going (42)").

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Add "You" on the client from the session | Server list includes the user | The list would go stale after every RSVP click until a refetch. |
| `aria-hidden` avatars + sentence | Each avatar with alt text | Six initials circles read as noise ("M N, S I, …"); one sentence says it all. |
| Dialog for the full list | Expand the list inline | 120 names would push the rest of the page down; a dialog scrolls on its own and closes back to where you were. |
| Fix `Modal` now | Use it as is | It had no focus handling and no name, which CLAUDE.md requires for modals; this is its first user. |

#### Component Contract

```ts
// src/components/events/AttendeesSection.tsx ('use client', forwardRef<HTMLElement> → <section>)
interface AttendeesSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  event: EventItem;                  // controlled, shared with RsvpCard
  attendees: AttendeePreview[];      // everyone else (never the current user)
  hasEnded: boolean;                 // "Who went"
}

// src/lib/mockData.ts
getMockAttendees(event: EventItem): AttendeePreview[]
```

#### Usage Example

```tsx
<div className="space-y-8">
  <EventDetails … />
  <AttendeesSection event={event} attendees={attendees} hasEnded={hasEnded} />
</div>
```

#### Verified (server HTML)

Going, 42: 6 avatars + "+36", "You, Salma Idrissi and 40 others". 1: one name, no "+N". 0: "Nobody has RSVP'd yet.", no button. Ended: "Who went (87)", "You, Hamza El Amrani and 85 others". 120: "Youssef Benali, Imane Chraibi and 118 others". `tsc --noEmit` passes. The dialog (client only), focus return and RSVP sync: manual checks on `/test`.

#### Notes for later

- **Privacy (Phase 5):** signed-out visitors currently see attendee names, as on the feed cards. Decide with the backend whether names are public or members-only.
- **Phase 7:** paginate the dialog list ("Load more") instead of loading everyone.

### 6.10 `/events/[id]` page & EventPageShell (Step 4.10)

**Files:** `src/app/events/[id]/page.tsx` (new, Server Component + `generateMetadata`), `src/app/events/[id]/not-found.tsx` (new), `src/components/events/EventPageShell.tsx` (new, `'use client'`). `/test` reset; `src/app/test/RsvpDemo.tsx` removed.
**Status:** ✅ Live (2026-11-05). Event cards on `/` and the calendar agenda now open real pages.

#### Business & Product Purpose

The event page is the destination of every event link in the app, and the page students share ("are you coming?"). Unknown or removed events get a clear 404 with ways back.

#### Core Concepts & Engineering Decisions

- **Server page, one client shell.** `page.tsx` awaits `params` (a Promise in Next.js 16), calls `await connection()` (per-request render: "has it ended?" uses the request time), looks the event up, and computes everything server-side: `hasEnded`, `getEventDateDetails`, the club, `getMockAttendees`. `EventDetails` is rendered on the server and passed as `children` through `EventPageShell` (client), which owns the shared RSVP state (`toggleRsvp` + `useRsvpToast`) and lays out content + `AttendeesSection` (left) and `RsvpCard` (right / bottom bar). Server-rendered children inside a client component stay server-rendered: no JS for the details.
- **`loadEvent = cache(id => …)`**: `generateMetadata` and the page both need the event; React `cache` makes it one lookup per request (one API call in Phase 7).
- **`generateMetadata`:** `"<title> | Campus Hub"`, description truncated to 160 chars, Open Graph `title`/`description`/`type: 'article'` for link previews. The flyer as `og:image` needs an absolute URL → `metadataBase` in Phase 7. Unknown id → `"Event not found | Campus Hub"`.
- **`notFound()` + route-level `not-found.tsx`:** unknown ids return HTTP 404 (Next adds `noindex`; **since §6.21 HTTP 200 + `noindex`**, because the loading skeleton streams first) with event-specific copy ("doesn't exist or was removed by its organizer") and links to Discover and the calendar, inside the normal shell. In dev the 404 UI arrives in the streamed payload because the page is dynamic; the status code is already 404.
- **Back link "All events"** → `/`, chevron flipped in RTL. A link (not `history.back()`): it works when the page was opened from a shared link.

#### Verified (server HTML via nginx)

`/events/evt_hackathon_ai` 200: title "42 Campus Hackathon: Edge AI & Systems | Campus Hub", description + `og:type article`, h1 = event title, h2s About / Who's going (120) / RSVP, multi-day date, "All events" link. `/events/evt_jam_session`: RSVP card "87 going · RSVP". `/events/evt_nope` 404 with `noindex` and the "Event not found" UI/title in the payload. `/` links to `/events/…`, `/calendar` agenda links to `/events/evt_workshop_cine`. `tsc --noEmit` passes.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `EventDetails` passed as `children` to the client shell | Shell imports `EventDetails` | Importing it into a client file would make it client code and ship its JS. |
| React `cache` around the lookup | Look up twice | Free with mocks, one request instead of two with the API. |
| Route-level `not-found.tsx` | Global 404 | "Event not found" with a link to the calendar is more useful than "Page not found". |
| Back link to `/` | Browser back | Works for people arriving from a shared link; from the calendar it loses the selected day (see URL-state note in §6.6). |

#### Component Contract

```ts
// src/components/events/EventPageShell.tsx ('use client')
interface EventPageShellProps {
  initialEvent: EventItem;
  hasEnded: boolean;                 // server
  attendees: AttendeePreview[];      // server (never the current user)
  children: React.ReactNode;         // <EventDetails>, server-rendered
}

// src/app/events/[id]/page.tsx
generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata>
```

#### Usage Example

```tsx
const event = loadEvent((await params).id);
if (!event) notFound();

<EventPageShell initialEvent={event} hasEnded={Date.parse(event.end_time) <= Date.now()} attendees={getMockAttendees(event)}>
  <EventDetails event={event} club={getClubById(mockClubs, event.club_id)} dateDetails={getEventDateDetails(event)} />
</EventPageShell>
```

#### Notes for later

- **RSVP state is per page.** RSVP on the event page, go back to `/`: the feed shows the old state until reload (each page holds its own copy). Phase 7's API (server is the source of truth) fixes it; a shared client store isn't worth it with mocks.
- ~~**Footer under the phone RSVP bar** (§6.8) still open.~~ Fixed in §6.19.
- **4.11 (optional):** open the page as a modal over the feed via an intercepting route (`@modal/(.)events/[id]`); a shared link still opens this full page.

### 6.11 Club helpers & ClubCard (Step 4.12)

**Files:** `src/lib/clubs.ts` (new), `src/components/clubs/ClubCard.tsx` (new, Server Component), `src/components/ui/Avatar.tsx` (`'use client'`, §2.3), `src/lib/mockData.ts` (club `logo_url` → `''`). Test: `/test`.
**Status:** ✅ Validated (2026-11-05), after the footer fix below.

#### Business & Product Purpose

The directory card answers "what is this club and is it active?": name, campus, what they do, and how many events are coming up. One tap opens the club.

#### Core Concepts & Engineering Decisions

- **Mock logos fixed.** Every club had `logo_url: '/placeholder-club.png'`, a file that doesn't exist: each logo made a failing request before `Avatar` fell back to initials. Now `''` (no logo uploaded), so initials show immediately.
- **`lib/clubs.ts` (pure):** `getClubBySlug`, `getUpcomingEventCounts(events, now)` (club id → count of events not yet ended; server side because it depends on the request time), `formatUpcomingCount` ("No upcoming events" / "1 upcoming event" / "3 upcoming events"), `sortClubsByName` (`localeCompare` with `sensitivity: 'base'`: case and accents ignored).
- **`ClubCard` is a Server Component**: `Card` + `CardBanner` (`wide` 21:9; violet gradient fallback, so cards with and without banners keep the same height) + `Avatar` logo overlapping the banner (`-mt-6`, ring in the card colour, `aria-hidden` since the name is next to it) + heading + campus + description (`line-clamp-2`) + upcoming count.
- **Footer = `CardFooter`** (full-width divider, `p-5 pt-4`), like `EventCard`. The first version put the count inside the padded body, so its divider stopped short of the edges and the row sat tight against the card bottom (spotted in review).
- **One link per card**: stretched link on the club name (same pattern as `EventCard` / `DayAgenda`), so each card is one tab stop and its accessible name is the club name.
- **`headingLevel`** (`'h2'` default) for the directory under the page `h1`.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Count on the server, pass a number | Card counts from the events list | "Upcoming" depends on the request time; a number is all the card needs. |
| Gradient fallback | Default `CardBanner` placeholder | Same visual weight as a real banner, no "Campus Hub Event" text on a club card. |
| `logo_url: ''` in mocks | Add a placeholder image file | Initials are more distinctive than one shared placeholder, and no request is made. |
| Alphabetical order | Most active first | Predictable for scanning; activity is shown on each card. Revisit with real data. |

#### Component Contract

```ts
// src/components/clubs/ClubCard.tsx (Server Component, forwardRef<HTMLDivElement>)
interface ClubCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  club: Club;
  upcomingCount: number;           // getUpcomingEventCounts (server)
  headingLevel?: 'h2' | 'h3';      // default 'h2'
}

// src/lib/clubs.ts
getClubBySlug(clubs, slug): Club | undefined
getUpcomingEventCounts(events, now): Record<string, number>   // read with ?? 0
formatUpcomingCount(count): string
sortClubsByName(clubs): Club[]
```

#### Usage Example

```tsx
await connection();
const counts = getUpcomingEventCounts(mockEvents, Date.now());

<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {sortClubsByName(mockClubs).map((club) => (
    <li key={club.id}>
      <ClubCard club={club} upcomingCount={counts[club.id] ?? 0} />
    </li>
  ))}
</ul>
```

#### Verified (server HTML)

8 cards (6 clubs + 2 test clubs) sorted A → Z ("Association…", "EMINES…", "LEET Dev", "Leet Frame", "LEET Music", …), each linking to `/clubs/<slug>`, initials logos, gradient fallback (image for the banner test club), "1 upcoming event" / "No upcoming events"; no `placeholder-club` requests. `/`, `/calendar`, `/events/…` still 200 after the `Avatar` change; `tsc --noEmit` passes.

### 6.12 ClubDirectory & shared CampusToggle (Step 4.13)

**Files:** `src/components/clubs/ClubDirectory.tsx` (new, `'use client'`), `src/components/filters/CampusToggle.tsx` (new, extracted from `FeedToolbar`), `src/lib/events.ts` (`matchesCampus` exported, used by `filterEvents`), `src/lib/clubs.ts` (`filterClubsByCampus`, `formatClubCount`), `src/components/events/FeedToolbar.tsx` (uses `CampusToggle`). Test: `/test` (scenario `noEmines`).
**Status:** ✅ Live (2026-11-05) on `/clubs` (`src/app/clubs/page.tsx`: `connection()`, `sortClubsByName`, `getUpcomingEventCounts`, metadata "Clubs | Campus Hub"). Club cards link to `/clubs/<slug>`, a 404 until Step 4.15.

#### Business & Product Purpose

Students browse every club, narrowed to their campus with the same control they already know from Discover.

#### Core Concepts & Engineering Decisions

- **One campus control, one campus rule.** The All / 1337 / EMINES toggle group moved out of `FeedToolbar` into `CampusToggle` (same markup: `role="group"` + `aria-pressed` buttons, `Record<'selected' | 'idle', string>` styles). `matchesCampus(departmentName, campus)` is now the single rule used by `filterEvents` and `filterClubsByCampus`: campus-wide (UM6P Central) items only appear under All, on both pages.
- **`ClubDirectory` (client)** owns the campus state. Structure mirrors the feed: `h1` "Clubs" + polite live count ("6 clubs" → "1 club"), intro line, `<search aria-label="Filter clubs">` landmark around the toggle, then the `ClubCard` grid (1/2/3 columns) or an `EmptyState` with "Show all clubs".
- **Server does the time/data work:** the page sorts (`sortClubsByName`) and counts (`getUpcomingEventCounts` with the request time) and passes plain data.
- **`ClubCard` now renders inside a client component**, so it ships as client code here. It has no server-only logic, so nothing changes in behaviour; the cost is a few hundred bytes.

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Extract `CampusToggle` | Copy the buttons into the clubs page | Two copies of a control drift (styles, ARIA). The second user is the time to extract (as with `useDayGridNavigation`). |
| `matchesCampus` shared | Separate club rule (e.g. campus-wide clubs under every campus) | One mental model across pages. If students expect UM6P-wide clubs under each campus, change the rule once for both. |
| Filter on the client | `?campus=` URL + server filtering | Instant, no request, tiny list. A URL param can come with the API if the list grows. |
| Cards become client code | Server-render all cards, hide with CSS | Hiding keeps hidden cards in the accessibility tree unless also `hidden`; plain filtering is simpler and correct. |

#### Component Contract

```ts
// src/components/filters/CampusToggle.tsx (forwardRef<HTMLDivElement>)
interface CampusToggleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: CampusFilter;
  onChange: (campus: CampusFilter) => void;
}

// src/components/clubs/ClubDirectory.tsx ('use client')
interface ClubDirectoryProps {
  clubs: Club[];                              // sorted on the server
  upcomingCounts: Record<string, number>;     // server, request time
}

// src/lib/events.ts
matchesCampus(departmentName: string, campus: CampusFilter): boolean
// src/lib/clubs.ts
filterClubsByCampus(clubs, campus): Club[]
formatClubCount(count): string
```

#### Usage Example

```tsx
// src/app/clubs/page.tsx (Step 4.13 integration)
await connection();
<ClubDirectory clubs={sortClubsByName(mockClubs)} upcomingCounts={getUpcomingEventCounts(mockEvents, Date.now())} />
```

#### Verified (server HTML)

`/test`: h1 "Clubs", "6 clubs", toggle with All pressed, 6 cards; `?scenario=noEmines`: "5 clubs", 5 cards. `/` still renders its toggle (All pressed) and "6 events" after the extraction. `tsc --noEmit` passes. Filtering, empty state and keyboard: manual checks on `/test`.

### 6.13 ClubHeader (Step 4.14)

**Files:** `src/components/clubs/ClubHeader.tsx` (new, Server Component), `src/components/clubs/ClubContactCard.tsx` (new, `'use client'`), `src/lib/clubs.ts` (`ClubContact`, `getClubContact`, `formatClubSince` (server only), `formatPhone`). Test: `/test?club=<slug>` (incl. `test-banner`, `test-long`, `&contact=none`) + `src/app/test/SessionSwitcher.tsx`.
**Status:** ✅ Validated (2026-11-05).

#### Business & Product Purpose

The top of a club's page: who they are, where, since when, what they do, and, for signed-in students only, how to reach the president by email or a tap-to-call number.

#### Core Concepts & Engineering Decisions

- **Server Component** (no state): banner (`CardBanner` `wide`, `loading="eager"` as the LCP image, same violet gradient fallback as `ClubCard`), `xl` initials logo overlapping the banner edge (ring in the *page* colour, `slate-50` / `slate-950`, since it sits on the page, not a card), `h1` club name (`text-balance`), "campus · Since January 2026".
- **Responsive header:** logo + name side by side from `sm`, stacked on phones. Below: About (left) + Contact card (right) from `lg` (`minmax(0,1fr) 20rem`, the same right column as the event page's RSVP card), stacked below.
- **Contact details are for signed-in students only (product decision, 2026-11-05).** Name, email and phone of the president are hidden from visitors; everything else on the page stays public. Two layers:
  1. **Server (the real protection):** the page passes `contact={getClubContact(club)}` only for a signed-in session and `null` otherwise, so the details are never in a visitor's HTML or RSC payload. With mock auth the session is always signed in; **Phase 5** reads the real session here, and the **Django API must omit these fields for anonymous requests** (hiding them in the UI alone is not privacy).
  2. **Client (`ClubContactCard`):** `getContactState(session.status, contact)` → `'loading'` (skeleton, `aria-busy`, so nothing flashes) · `'locked'` (lock icon, "Contact details are only shown to signed-in students.", "Log in to see them" → `/auth/login?next=/clubs/<slug>`) · `'visible'` (needs a signed-in session **and** data). The `body: Record<ContactState, ReactNode>` table picks the content.
- **Contact card (visible state):** president avatar + name + "President"; `mailto:` and `tel:` links with a visible label (not icon-only), so they're tappable on phones and readable on desktop. Long emails `truncate`.
- **`formatPhone`** groups Moroccan numbers for display ("+212 6 00 00 00 00"); the `tel:` href keeps the raw value; other formats pass through unchanged. The number is `dir="ltr"` so it doesn't reorder in Arabic pages.
- **`formatClubSince(created_at)`** (server, campus time zone, like every moment-to-date format).
- **Semantics:** `<header>` with `h1`, then `section`s labelled "About" and "Contact" (`h2`); decorative avatars `aria-hidden`; description keeps line breaks (`whitespace-pre-line`).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Visible email/phone text links | "Email" / "Call" icon buttons | Students copy the address or read the number; a visible label also names the link for screen readers. |
| Contact card in the right column | Contact line under the name | Mirrors the event page layout (content left, action right); keeps the header itself short. |
| Display-only phone formatting | Store formatted numbers | The API keeps one canonical value; formatting stays a view concern. |
| Server omits the data + client locked state | Only hide it with CSS / client check | Anything sent to the browser is readable in View Source; only not sending it protects it. The client check still handles the session changing after load. |
| Contact card as its own client component | Make `ClubHeader` a client component | Only the card needs the session; the rest of the header stays server-rendered with no JS. |

#### Component Contract

```ts
// src/components/clubs/ClubHeader.tsx (Server Component, forwardRef<HTMLElement> → <header>)
interface ClubHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  club: Club;
  since: string;                    // formatClubSince(club.created_at), server
  contact: ClubContact | null;      // getClubContact(club) if signed in, else null (server decides)
}

// src/components/clubs/ClubContactCard.tsx ('use client', forwardRef<HTMLElement> → <section>)
interface ClubContactCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  contact: ClubContact | null;
  clubSlug: string;                 // login link ?next=
}

// src/lib/clubs.ts
type ClubContact = Pick<Club, 'president_name' | 'president_email' | 'president_phone'>
getClubContact(club): ClubContact
formatClubSince(createdAt: string): string   // server only
formatPhone(phone: string): string
```

#### Usage Example

```tsx
// Phase 5: isSignedIn comes from the real session on the server
<ClubHeader club={club} since={formatClubSince(club.created_at)} contact={isSignedIn ? getClubContact(club) : null} />
```

#### Verified (server HTML)

Leet Frame: "1337 Coding School · Since January 2026", About, Contact "Mouad Najjar / President", `mailto:leetframe@1337.ma`, `tel:+212600000000` displayed "+212 6 00 00 00 00". `test-banner` renders the banner image; `test-long` keeps both paragraphs. `&contact=none` (LEET Music): locked card, and the president's name, email and phone appear **nowhere** in the HTML or payload (0 matches each). `tsc --noEmit` passes.

#### Notes for later

- **Test switcher leak (fixed):** picking "Loading" on `/test` and then following a link left the whole app in a loading session (the session lives in the root layout and survives client navigation), so the event page's RSVP card spun forever. `SessionSwitcher` now restores the default signed-in mock session when `/test` unmounts.
- **Phase 5 must wire the server side:** today `contact` is always sent because the mock session is always signed in; switching to "Signed out" on `/test` only exercises the client lock. Same check needed in the API.

### 6.14 ClubEvents (Step 4.15)

**Files:** `src/components/clubs/ClubEvents.tsx` (new, `'use client'`), `src/lib/clubs.ts` (`getClubEvents`), `src/components/events/EventGrid.tsx` (new optional props `cardHeadingLevel`, `eagerFirstRow`), `src/components/clubs/ClubDirectory.tsx` (`grid-cols-1` fix). Test: `/test?club=<slug>` (Leet Frame has 2 test-only past events).
**Status:** ✅ Validated (2026-11-05). Live on `/clubs/[slug]` (§6.15).

#### Business & Product Purpose

What is this club doing next, and what has it done? Upcoming events are the same cards as on Discover (RSVP works here too); past events show the club is active.

#### Core Concepts & Engineering Decisions

- **`getClubEvents(events, clubId, now)`** (server, request time) → `{ upcoming (soonest first), past (most recent first) }`, split on `end_time` like the feed (an ongoing event is upcoming).
- **Upcoming = `EventGrid`** reused with two new optional props: `cardHeadingLevel="h3"` (cards sit under the "Upcoming events" `h2`) and `eagerFirstRow={false}` (the grid is below the header, not the LCP). Defaults (`'h2'`, `true`) keep `/` unchanged. Empty: `EmptyState` "Nothing scheduled right now".
- **RSVP state** lives in `ClubEvents` (`toggleRsvp` + `useRsvpToast`), exactly like `EventFeed`.
- **Past events = compact list** (date from the server schedules, title as a stretched link to the event page's "ended" view, location), only rendered when there are some.
- **`grid-cols-1` added to the clubs directory grid** (Step 4.13 had missed it): without it a card with a long unbreakable line widens the phone page (§5.7).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Reuse `EventGrid` + 2 props | A club-specific grid | Same cards, same RSVP, same phone-width fix; the props only expose what differs (heading level, image priority). |
| Compact list for past events | Cards for past events too | Past events don't need flyers or RSVP; a dense list keeps the page short. |
| Hide "Past events" when empty | Show an empty past section | An empty history says nothing useful. |

#### Component Contract

```ts
// src/components/clubs/ClubEvents.tsx ('use client', forwardRef<HTMLDivElement>)
interface ClubEventsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  upcoming: EventItem[];                       // getClubEvents (server)
  past: EventItem[];
  schedules: Record<string, EventSchedule>;    // getEventSchedules([...upcoming, ...past])
}

// src/components/events/EventGrid.tsx (added)
cardHeadingLevel?: 'h2' | 'h3';   // default 'h2'
eagerFirstRow?: boolean;          // default true

// src/lib/clubs.ts
getClubEvents(events, clubId, now): { upcoming: EventItem[]; past: EventItem[] }
```

#### Usage Example

```tsx
const { upcoming, past } = getClubEvents(mockEvents, club.id, Date.now());
<ClubEvents upcoming={upcoming} past={past} schedules={getEventSchedules([...upcoming, ...past])} />
```

#### Verified (server HTML)

Leet Frame: "Upcoming events (1)" with the masterclass card (`h3`, no eager image), "Past events (2)": "Sun, Oct 11 · Golden Hour Photo Walk", "Fri, Sep 25 · Short Film Night: Student Premieres". Banner test club: "(0)" + "Nothing scheduled right now", no past section. `/` unchanged: 6 `h2` card titles, eager first row. `tsc --noEmit` passes.

**Incident during this step:** a `{/* */}` JSX comment placed before `<ul>` inside a `? … : (…)` branch made two sibling expressions, a syntax error that took the whole dev app down (500 on every page) until fixed a minute later with a `//` comment. Comments in a parenthesized JSX branch must be JS comments or go inside the element.

#### Notes for later

- **Phase 7:** paginate past events (they grow every semester).

### 6.15 `/clubs/[slug]` page (Step 4.15 integration): clubs done

**Files:** `src/app/clubs/[slug]/page.tsx` (new, Server Component + `generateMetadata`), `src/app/clubs/[slug]/not-found.tsx` (new). `/test` reset (`SessionSwitcher.tsx` kept as a reusable test tool).
**Status:** ✅ Live (2026-11-05). Club cards on `/clubs` and organizer links on event pages open real pages.

#### Core Concepts & Engineering Decisions

- **Same shape as `/events/[id]` (§6.10):** `params` awaited, `await connection()` (upcoming vs past at request time), `loadClub = cache(slug => …)` shared by `generateMetadata` and the page, `notFound()` → route-level `not-found.tsx` ("Club not found", links to the directory and Discover, HTTP 404 + `noindex`; since §6.21 HTTP 200 + `noindex`), back link "All clubs" (chevron flipped in RTL).
- **Composition:** `ClubHeader` (server) with `contact`, then `ClubEvents` (client) with `getClubEvents` + `getEventSchedules` from the server.
- **Contact decided on the server:** `contact={IS_SIGNED_IN ? getClubContact(club) : null}`. `IS_SIGNED_IN` is a `true` constant because mock auth is always signed in; **Phase 5 replaces it with the real server-side session** (§6.13).
- **Metadata:** `"<club> | Campus Hub"`, the description, Open Graph `type: 'profile'`.

#### Verified (server HTML via nginx)

`/clubs/leet-frame` and `/clubs/um6p-sports` 200 with title "<club> | Campus Hub", h1 = club name, h2 About / Contact / "Upcoming events (1)", "All clubs" link. `/clubs/nope` 404 + `noindex`. `/clubs` links to all 6 club pages; the hackathon page's organizer link is `/clubs/leet-dev`. `/`, `/calendar`, `/test`, `/clubs` 200. `tsc --noEmit` passes. (The "Club not found" text also appears in valid pages' payload: Next ships the segment's not-found boundary definition; it isn't rendered.)

### 6.16 Search logic & SearchPalette (Step 4.16)

**Files:** `src/lib/search.ts` (new), `src/hooks/useCampusSearch.ts` (new), `src/components/search/SearchPalette.tsx` (new, `'use client'`), `src/components/ui/Modal.tsx` (`position` prop, §2.4), `src/lib/events.ts` (`normalizeText` exported). Test: `src/app/test/SearchDemo.tsx` ("Open search" button).
**Status:** ✅ Validated (2026-11-05). Live through the navbar and ⌘K (§6.17).

#### Business & Product Purpose

The navbar promises "Search events…" and ⌘K since Phase 2. This is the window behind it: type a few letters, jump straight to an event or a club, without leaving the keyboard.

#### Core Concepts & Engineering Decisions

- **`searchCampus(query, { events, clubs }, now)` (pure):** same text rules as the feed (`normalizeText`: case, Latin accents and Arabic harakat ignored; every word must match somewhere). Events match on title, club, location, category label; clubs on name, campus, description. Ranking: events upcoming before past, then name starts-with (0) < name contains (1) < other field (2), then soonest; clubs by rank then A → Z. `SEARCH_LIMIT = 5` per group. `getSearchSuggestions` = next 4 upcoming events for the empty state ("Coming up").
- **`useCampusSearch(query)` is the only data source.** Today: synchronous filtering of the mocks (`useMemo`). Phase 7: debounce (`useDebouncedValue`) + `GET /api/search?q=` behind the same return shape, so the palette doesn't change. It runs in the browser only (the palette content mounts after opening), so `Date.now()` there can't cause a hydration mismatch.
- **WAI-ARIA combobox + listbox.** The input is `role="combobox"` with `aria-controls`, `aria-expanded`, `aria-autocomplete="list"` and `aria-activedescendant`; results are a `role="listbox"` with `role="group"` sections ("Coming up" / "Events" / "Clubs", each `aria-labelledby` its label) of `role="option"` rows (`aria-selected` on the active one). Focus never leaves the input: ↑/↓ move the active option (wrapping, `scrollIntoView({ block: 'nearest' })`), Enter opens it, Escape / outside click close (Modal). A polite live region announces "3 results" while typing.
- **Mouse:** `mousemove` sets the active option, `mousedown` is prevented (keeps focus in the input), click opens. Opening = close + `router.push(href)`.
- **No dates in results.** Formatting dates in the browser would use the browser's time-zone data (§5.2); rows show club · place · category (events) or "Club · campus".
- **Built on `Modal`** (portal, scroll lock, focus trap, focus return, `ModalTitle` as an `sr-only` name), with the new `position="top"`, `size="lg"`, no padding (`p-0!`).

#### Architectural Tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Combobox with `aria-activedescendant` | Move real focus into the list | The user keeps typing while arrowing; this is the APG pattern for search popups. |
| Hook as the data boundary | Pass events/clubs as props from the layout | Props would put every event in every page's payload; the hook can switch to an API call without touching the UI. |
| Client-side ranking now | Wait for a search endpoint | Mocks are tiny; the same pure function can rank API results or be dropped when the server ranks. |
| Results without dates | Format dates in the browser | Avoids the server/browser time-zone disagreement entirely. |

#### Component Contract

```ts
// src/components/search/SearchPalette.tsx ('use client')
interface SearchPaletteProps { isOpen: boolean; onClose: () => void }

// src/hooks/useCampusSearch.ts
useCampusSearch(query: string): { results: SearchResults; suggestions: EventItem[] }

// src/lib/search.ts
interface SearchResults { events: EventItem[]; clubs: Club[] }
SEARCH_LIMIT = 5
searchCampus(query, { events, clubs }, now): SearchResults
getSearchSuggestions(events, now): EventItem[]
```

#### Usage Example

```tsx
const [isOpen, setIsOpen] = useState(false);
<NavbarSearch onOpen={() => setIsOpen(true)} />
<SearchPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
```

#### Verified

Node 22 in the container, `searchCampus` at 2026-11-05 12:00Z: "leet" → jam session (title starts with LEET) then workshop, hackathon; clubs leet-dev, leet-frame, leet-music. "CINÉMATIC" = "cinematic". "jam music" → jam session + LEET Music. "emines" → basketball final (title contains EMINES) before the case competition (club only) + EMINES Consulting. "zzz" and blank → nothing. Suggestions: the next 4 upcoming events. `/test` 200, `tsc --noEmit` passes. The dialog itself (keyboard, screen reader, navigation): manual checks.

### 6.17 Search wired to the navbar & ⌘K (Step 4.17): Phase 4 complete

**Files:** `src/components/ui/layout/AppShell.tsx` (toast placeholder → `SearchPalette`). `/test` reset; `src/app/test/SearchDemo.tsx` removed.
**Status:** ✅ Live (2026-11-05). **Phase 4 is complete.**

#### Core Concepts & Engineering Decisions

- **One palette for the whole app.** `AppShell` owns `isSearchOpen`; `openSearch` / `closeSearch` are stable `useCallback`s (`NavbarSearch` re-binds its window ⌘K listener whenever `onOpen` changes, §3.3). The navbar button (icon-only on phones) and ⌘K / Ctrl+K on any page open the same `SearchPalette`, rendered once next to the tab bar and portalled to `<body>` when open.
- **Nothing else changed:** `NavbarSearch` already had `aria-haspopup="dialog"`, the shortcut, `aria-keyshortcuts` and the platform hint (§3.3); `Modal` returns focus to the navbar button on close.
- **Window vs. inline search box (decided 2026-11-05):** kept the palette over a text box with a dropdown in the navbar: the phone navbar only has room for an icon, ⌘K works the same on every page, and results have room for two groups.

#### Verified

`/`, `/calendar`, `/clubs`, `/clubs/leet-dev`, `/events/evt_hackathon_ai`, `/test`: 200 with the search button, no "Search is coming soon" left in the source. Production build (`next build` in a throwaway copy inside the container) passes with all routes: `/`, `/calendar`, `/clubs`, `/clubs/[slug]`, `/events/[id]` dynamic, `/test` static (404 in production). `tsc --noEmit` passes.

#### Phase 4 summary

| Route / feature | Section |
| --- | --- |
| `/calendar` (month/week, day agenda) | §6.1–6.6 |
| `/events/[id]` (details, RSVP card, attendees, 404) | §6.7–6.10 |
| `/clubs`, `/clubs/[slug]` (directory, campus filter, header, contact for signed-in students, events, 404) | §6.11–6.15 |
| ⌘K search palette | §6.16–6.17 |

**Open items carried forward:** ~~calendar day/view in the URL (§6.6)~~ done §6.18; ~~footer under the phone RSVP bar (§6.8)~~ done §6.19; RSVP state per page until the API (§6.10); Phase 5: server-side session for club contact (§6.13) and attendee-name privacy (§6.9); Phase 7: API, `metadataBase` + flyer `og:image`, search endpoint, pagination; ESLint not runnable in the container; no volume mount for live reload in Docker.


---

### 6.18 Calendar place in the URL & EventBackLink (Step 4.18, 2026-11-17)

**Status:** ✅ Validated on `/test` and live on `/calendar` and `/events/[id]`.

**Files:** `src/lib/calendar.ts` (URL helpers), `src/components/calendar/EventCalendar.tsx` (`urlState`), `src/components/calendar/DayAgenda.tsx` (`eventHref`), `src/components/events/EventBackLink.tsx` (new), `src/app/calendar/page.tsx`, `src/app/events/[id]/page.tsx`.

#### Business & product purpose

Before, the calendar's selected day and view lived **only in React state**, which is memory inside the open tab. The address bar always said `/calendar`. So:

- **Reload** → React starts from scratch → back to today, Month view.
- **Copy the link** to a friend → they get `/calendar` → today, Month view, not the day you meant.
- **Open an event, then go back** (link or Back button) → the calendar page is rendered again from `/calendar` → today again. The event page's only link was "All events" → `/`, the feed, even when you came from the calendar.

A student planning "what's on next Saturday" lost their place every time. Now the place is in the URL: `/calendar?date=2026-11-21&view=week`. The URL is the only part of the page state that survives a reload, a shared link, and history navigation.

#### Core concepts & engineering decisions

- **URL as state, read once.** `EventCalendar` reads `date`/`view` from `useSearchParams()` in a `useState` initialiser, then React state leads and every change writes the URL (`show(date, view)`). One function for all changes: header arrows, Today, day clicks, view tabs.
- **`window.history.replaceState`**, which Next.js 16 integrates with its router (`useSearchParams`/`usePathname` stay in sync, no server request). `router.replace` would re-render the dynamic page on the server for every click.
- **Replace, not push:** clicking through days doesn't fill the Back button's history. Back leaves the calendar in one press.
- **`useSearchParams`, not server props, for the start value.** On Back/Forward, Next restores a cached server render made for the *old* URL; the client hook reads the URL we wrote, so the calendar reopens where it was.
- **Defaults stay out of the URL:** today and Month are omitted, so a shared plain `/calendar` means "today" for whoever opens it.
- **Validation, never errors:** `isDayKey` checks the format and that the date exists (round trip rejects `2026-02-30`); `isCalendarView` checks the view. Anything invalid is ignored → today / Month.
- **Back link that knows the origin:** agenda links become `/events/<id>?from=calendar&date=…&view=…` (`eventFromCalendarHref`). The event page reads only `from`, `date` and `view`, validates them, and `EventBackLink` builds the href itself, so a crafted URL can't turn the back link into a link to another site (no open redirect).
- **`urlState` is opt-in** (default `false`): a calendar embedded elsewhere later (e.g. on a club page) shouldn't rewrite that page's URL.

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `history.replaceState` | `router.replace` / `<Link>` per day | No server round trip or re-render per click; focus stays on the grid day |
| Read from `useSearchParams` on mount | Server `searchParams` → props | Back/Forward restore the URL we wrote, not the server render's |
| `replaceState` | `pushState` per day | Back shouldn't step through every clicked day |
| `?from=calendar` + validated date/view | `history.back()` button | Works from shared links and new tabs; no open redirect |
| Omit today / Month | Always write both | Shared plain links stay "today" |

#### Component contract

```ts
// lib/calendar.ts (client-safe)
interface CalendarLocation { date?: DayKey; view?: CalendarView }
isDayKey(value): value is DayKey
readCalendarLocation(get: (name) => string | null | undefined): CalendarLocation
calendarQuery(location): string            // '' | '?date=…&view=week'
calendarHref(location?): string            // '/calendar…'
eventFromCalendarHref(eventId, location): string

// EventCalendar: new prop
urlState?: boolean                          // default false

// DayAgenda: new prop
eventHref?: (event: EventItem) => string    // default `/events/${id}`

// EventBackLink (forwardRef<HTMLAnchorElement>, server-safe)
calendar?: CalendarLocation                 // set → "Back to calendar" (that day); omitted → "All events" (/)
```

#### Usage

```tsx
<EventCalendar events={events} eventIdsByDay={…} eventTimes={…} todayKey={todayKey} urlState />
<EventBackLink calendar={{ date: '2026-11-21', view: 'week' }} className="mb-6" />
```

#### Notes

- If a page links to `/calendar?date=…` **while the calendar is already open**, the calendar keeps its current state (the URL is read once). Nothing does this today; add a `key` or a sync effect if it's ever needed.
- The URL keeps `from=calendar` when an event link is shared from the calendar. Harmless: the recipient's back link goes to that calendar day.

### 6.19 Phone RSVP bar no longer covers the footer (Step 4.19, 2026-11-17)

**Status:** ✅ Validated (2026-11-17) on phone and tablet widths, live on `/events/[id]`.

**Files:** `src/components/events/RsvpCard.tsx` (one className change, spacer removed). No API change.

#### Business & product purpose

Below `lg` (1024px) the RSVP control is a bar at the bottom of the screen. It was `position: fixed`, so it stayed on screen **all the way to the end of the page**. The page reserved room for it with an empty `h-20` block, but that block sat at the end of the event content, *before* the footer. Result: at the very bottom, the bar covered the last ~5rem of the footer (links and copyright could not be read or tapped on a phone). Now the bar follows the reader while they read, then stops at the end of the event and the whole footer shows below it.

#### Core concepts & engineering decisions

- **`sticky` instead of `fixed`.** A sticky element sticks to its `bottom` offset **only while its containing block is on screen**. Its containing block is the event's grid in `<main>`, which ends before the footer. So while reading, the bar is pinned at the bottom (same look as before); once the end of the event scrolls into view, the bar settles at its normal place in the page, the footer scrolls in under it, and nothing is covered.
- **Same offsets as before:** `bottom-[calc(4rem+1px+env(safe-area-inset-bottom))]` on phones (sits above the tab bar), `md:bottom-0` with safe-area padding on tablets (no tab bar). At `lg` the same element is still `sticky lg:top-20 lg:bottom-auto` in the side column: desktop is unchanged.
- **Edge to edge with negative margins.** A `fixed` bar used `inset-x-0` to span the screen. A sticky bar lives inside the page's padding, so `-mx-4 sm:-mx-6` pulls it back to the screen edges and `px-4 sm:px-6` restores the inner padding; `lg:mx-0` removes it for the side card.
- **No spacer.** A sticky element takes up its own space in the flow, so the content can never end hidden behind it. One fewer element, and no magic height to keep in sync with the bar.
- **The trap to remember:** `sticky` silently stops working if **any ancestor** has `overflow: hidden | auto | scroll` (that ancestor becomes the scroll box). Checked: none in `layout.tsx`, `AppShell`, `globals.css` or the event page. Don't add one around the event page.

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| `sticky` bottom | Keep `fixed` + hide the bar when the footer is visible (`IntersectionObserver`) | Pure CSS, no JavaScript, no listener, no flash on hydration; the bar never disappears, it just stops |
| `sticky` bottom | Keep `fixed` + spacer after the footer | The spacer would need to know the bar's height on every page; the bar would still hide content while reading other sections |
| Negative margins for full width | Move the bar out of the padded container | Would split the phone and desktop layouts into two DOM nodes (two RSVP controls for screen readers, §6.8) |

The `fixed` vs `sticky` choice is the opposite of the tab bar's (§3, `MobileTabBar`): the tab bar must be on screen **everywhere**, including over the footer, so it stays `fixed` with `MobileTabBarSpacer`. The RSVP bar belongs to the event, so it should stop where the event stops.

#### Component contract

Unchanged (§6.8): `event`, `hasEnded`, `onRsvpToggle`, `className`, `ref` → `<aside>`.

#### Usage

Unchanged; `EventPageShell` renders it in the grid's second column:

```tsx
<RsvpCard event={event} hasEnded={hasEnded} onRsvpToggle={handleRsvpToggle} />
```

### 6.20 Error pages: `ErrorState`, `error.tsx`, `global-error.tsx` (Step 4.20, 2026-11-17)

**Status:** ✅ Validated (2026-11-17) on `/test` (browser crash, server error, retry, keyboard, phone, dark mode). Live on every route.

**Files:** `src/components/ui/ErrorState.tsx` (new), `src/app/error.tsx` (new, `'use client'`), `src/app/global-error.tsx` (new, `'use client'`).

#### Business & product purpose

Until now a page that threw (a bug, bad data, and from Phase 7 the API being down or slow to answer) showed Next's bare built-in error screen: no navbar, no way back, nothing a student understands. Now it shows **"Error · Something went wrong"** inside the normal site (navbar, tab bar and footer stay), with **Try again** and **Discover events**, plus a short **error code** the student can send to the team. This matters most once real API calls exist: a failed request should cost one tap, not a lost tab.

#### Core concepts & engineering decisions

- **`error.tsx` = a React error boundary around a route segment.** Placed at `src/app/error.tsx`, it wraps every page (and nested layouts, `loading.tsx`, `not-found.tsx`) but **not** the root layout above it, which is why the shell survives. Any page can add its own `error.tsx` later for page-specific copy; the nearest one wins.
- **Must be a Client Component** (`'use client'`): error boundaries catch errors while React renders in the browser, and the "Try again" button needs `onClick`.
- **`retry()`, not `reset()`.** Next.js **16.3** made `retry` the standard prop: it **re-fetches the segment from the server** and re-renders it, so a temporary server/API failure can actually recover. The older `reset()` (still there) only re-renders what the browser already has, which can't fix a server error. Older tutorials use `reset`; in this codebase use `retry`.
- **Server vs browser errors.** Thrown during the server render (e.g. a failed fetch in a page): the HTTP status is **500**, and in production the browser only receives a generic message plus `error.digest`, a hash that matches the server log. Thrown in the browser (a component crashing): no digest. So `ErrorState` shows **only the code**, never `error.message` (generic or technical either way).
- **Focus management.** The error replaces the page without a navigation. `error.tsx` focuses the message container (`tabIndex={-1}`, `focus:outline-none`), so screen readers read it and the next Tab lands on "Try again" instead of on a control that no longer exists. Not `role="alert"`: focus already announces it, and an alert would be read twice.
- **Logging:** `console.error(error)` in an effect. Phase 7: send it to a reporting service at the same spot.
- **`global-error.tsx` = last resort for the root layout.** If `layout.tsx` itself throws (e.g. a future server-side session read fails), `error.tsx` can't help: it lives inside that layout. `global-error.tsx` **replaces the whole document**, so it renders its own `<html>`/`<body>`, imports `globals.css` itself, sets the title with React 19's `<title>` (metadata exports don't work in error files), and has no navbar/footer (they belong to the broken layout). Its home link is a plain `<a href="/">` (full page load), because the client router is part of what failed. Dark mode still works: Tailwind's `dark:` follows the OS setting here. Fonts fall back to the system font (the Geist variables come from the layout).
- **`ErrorState` is server-safe and generic** (title, description, code, actions as children), so a future per-page `error.tsx` or a failed widget can reuse it. Same centered layout as the 404 pages, rose label instead of violet.
- **In development** Next draws its own error overlay / "Issues" badge on top. Students never see it; close it to see our page.

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| One root `error.tsx` | One per route now | Same message fits every page today; add per-page files only when the copy must differ |
| `retry()` | `reset()` | Re-fetches from the server, so API/server hiccups can recover |
| Show only the digest | Show `error.message` | Production server messages are generic; client ones are technical and may leak details |
| Focus the container | `role="alert"` live region | Announces once and fixes keyboard position too |
| `global-error.tsx` with its own `<html>` | Rely on Next's default | Default is unbranded English text with no way home |
| `ErrorState` in `ui/` (server-safe) | Markup inside `error.tsx` | Reusable by `global-error.tsx` and future per-page boundaries |

#### Component contract

```ts
// components/ui/ErrorState.tsx — forwardRef<HTMLDivElement>, server-safe
interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: string;        // default 'Something went wrong'
  description?: string;  // default 'This page couldn’t load. It’s probably temporary: try again in a moment.'
  code?: string;         // error.digest; omitted → no code line
  children?: ReactNode;  // actions, stacked on phones, in a row from sm
}

// app/error.tsx and app/global-error.tsx (Next.js file conventions)
{ error: Error & { digest?: string }; retry: () => void }
```

#### Usage

```tsx
// A future page-specific boundary, e.g. app/events/[id]/error.tsx
'use client';
export default function EventError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorState title="This event couldn’t load" code={error.digest}>
      <Button onClick={() => retry()} className="h-10">Try again</Button>
    </ErrorState>
  );
}
```

#### Notes

- **Testing again:** the 4.20 test bench was not committed. Recreate it in a minute: a client component that does `if (broken) throw new Error('test')` after a button click (browser error, no code), and `throw new Error('test')` at the top of a page for a server error (500 + code). Try again recovers the first, the second fails again on purpose.
- **`global-error.tsx` was not seen in a browser** (triggering it needs the root layout to throw). Type-checked only; check it once when Phase 5 adds server-side work to the layout.
- `notFound()` is **not** an error: it still shows the `not-found.tsx` pages (404), not this one.

### 6.21 Loading skeletons: `loading.tsx` per route (Step 4.21, 2026-11-17)

**Status:** ✅ Validated (2026-11-17) on `/test` (each skeleton next to its real page, phone/tablet/desktop, dark mode, a 3-second page). Live on `/`, `/calendar`, `/clubs`, `/clubs/[slug]`, `/events/[id]`.

**Files:** `src/components/events/EventSkeletons.tsx` (new: `EventCardSkeleton`, `EventGridSkeleton`, `EventFeedSkeleton`, `EventPageSkeleton`), `src/components/calendar/CalendarSkeleton.tsx` (new), `src/components/clubs/ClubSkeletons.tsx` (new: `ClubCardSkeleton`, `ClubDirectorySkeleton`, `ClubPageSkeleton`), `src/components/ui/Skeleton.tsx` (+ `SkeletonRegion`), `src/app/(feed)/loading.tsx`, `src/app/calendar/loading.tsx`, `src/app/clubs/loading.tsx`, `src/app/clubs/[slug]/loading.tsx`, `src/app/events/[id]/loading.tsx` (new). **Moved:** `src/app/page.tsx` → `src/app/(feed)/page.tsx` (same URL `/`).

#### Business & product purpose

Every page renders on the server. Today, with mock data, that takes milliseconds; from Phase 7 each page waits for the Django API, and on campus Wi-Fi that can be a second or more. Without a loading state, a tap on an event card did **nothing visible** until the whole new page was ready: students tap again, or think the site is broken. Now the tap answers instantly with grey shapes in the exact layout of the coming page (banner, title, grid, side card), and the real content replaces them in place. The navbar, tab bar and footer never disappear.

#### Core concepts & engineering decisions

- **`loading.tsx` = an automatic `<Suspense>` boundary.** Next.js wraps the segment's `page.tsx` in `<Suspense fallback={<Loading />}>`. On a link tap the fallback is shown at once (it is prefetched with the link); on a direct visit it is sent in the first HTML chunk and the page **streams** in after it.
- **Skeletons copy the real geometry.** Same container classes, paddings, grid columns, aspect ratios (16:9 flyers, 21:9 club banners), avatar sizes (logo 48px on cards, 64px on the club page) and button heights. When the content arrives nothing moves (no layout shift, good for Core Web Vitals CLS). The month grid is always 6 weeks (`lib/calendar.ts`), so the calendar skeleton's height is exact. **Rule:** change a real component's layout → change its skeleton (each skeleton file says which component it mirrors).
- **Shared pieces:** `EventCardSkeleton` / `EventGridSkeleton` are used by the feed skeleton *and* the club page skeleton (its events grid); `EventGridSkeleton` copies `EventGrid`'s `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`. Built on the existing `Skeleton` + `Card` / `CardFooter` primitives, so borders, radius and footer padding are the real ones.
- **Accessibility: `SkeletonRegion`.** The shapes are `aria-hidden`; the wrapper is `role="status"` + `aria-busy="true"` with one sr-only label ("Loading events", "Loading calendar", "Loading event", "Loading clubs", "Loading club"). A screen-reader user hears one short message instead of silence or a list of boxes.
- **Phone RSVP bar not in the event skeleton.** Below `lg` the real bar appears with the content; a placeholder bar would only flash. The `lg` side card is drawn (it's part of the layout).
- **Route group `(feed)`.** A `loading.tsx` wraps **every route below its folder**. At `src/app/loading.tsx` the feed skeleton also wrapped `/calendar`, `/clubs`…: on a direct visit to `/calendar` the browser showed the *feed* skeleton, then the calendar one, then the page (verified in the streamed HTML). Moving the feed into `src/app/(feed)/` (parentheses = folder ignored in the URL) scopes its `page.tsx` + `loading.tsx` to `/` only. No root `loading.tsx` on purpose.
- **Nested boundaries:** `/clubs/[slug]` sits under both `clubs/loading.tsx` and `clubs/[slug]/loading.tsx`. Going from `/clubs` to a club shows only the club skeleton (the directory segment is already there).
- **After moving or adding route folders, restart the dev server** (`docker compose restart frontend`): Turbopack kept the old route list and `/` answered 404 until restarted.

#### The trade-off: 404 → 200 for unknown events and clubs (decided 2026-11-17)

Once the skeleton is sent, the HTTP status (200) has already gone out with it, so `notFound()` in the page can no longer turn it into a 404. Measured: `/events/nope` and `/clubs/nope` now answer **200**, still showing "Event/Club not found" and with `<meta name="robots" content="noindex">` (Next adds it), so search engines don't index them (Next's docs: treated as a "soft 404", not indexed). Unknown URLs (`/nope`) still answer **404** (no loading boundary above the global not-found). The team chose instant feedback for students over the exact status code for bots. If a real 404 is ever required (analytics, compliance), the documented fix is a check in `proxy.ts` that rewrites unknown ids to the not-found page before streaming starts (costs one quick lookup per request).

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| A skeleton per route | One generic spinner at the root | Spinner shifts everything when content lands and says nothing about what's coming; one root boundary also flashes on every route |
| `loading.tsx` per route | Manual `<Suspense>` inside each page | Same mechanism with zero wiring; manual boundaries make sense later for one slow widget (e.g. attendees) while the rest shows |
| Skeletons on detail pages (soft 404) | No skeleton on `/events/[id]`, `/clubs/[slug]` (real 404) | Detail pages are what students tap most; `noindex` keeps unknown ids out of search |
| `(feed)` route group | Root `loading.tsx` | Root boundary flashed the feed skeleton on every other route |
| Copies of real classes | Rendering the real components with empty data | Real components need data and client state; skeletons stay server-only, zero JavaScript |

#### Component contract

```ts
// components/ui/Skeleton.tsx
SkeletonRegion: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { label: string }>  // role="status", aria-busy

// components/events/EventSkeletons.tsx (server-safe, all forwardRef<HTMLDivElement>)
EventCardSkeleton   // one card, aria-hidden
EventGridSkeleton   // { count?: number = 6 }
EventFeedSkeleton   // label "Loading events"
EventPageSkeleton   // label "Loading event"

// components/calendar/CalendarSkeleton.tsx
CalendarSkeleton    // label "Loading calendar"

// components/clubs/ClubSkeletons.tsx
ClubCardSkeleton, ClubDirectorySkeleton ("Loading clubs"), ClubPageSkeleton ("Loading club")
```

#### Usage

```tsx
// src/app/<route>/loading.tsx: same container as the page
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <CalendarSkeleton />
    </div>
  );
}
```

#### Notes

- **Seeing them today:** the mocks are instant, so skeletons only flash. To look at one, add `await new Promise((r) => setTimeout(r, 3000))` at the top of a page temporarily (that's how 4.21 was tested on `/test`).
- **Reduced motion:** the `animate-pulse` animation still runs with "reduce motion" on (it's a slow fade, not movement). Add `motion-reduce:animate-none` to `Skeleton` if anyone asks.
- The old Phase 1 `CardSkeleton` (with description lines) doesn't match `EventCard` and isn't used by these; kept for generic cards.

## 7. Phase 5 — Student Authentication (prep notes, 2026-11-06)

Started 2026-11-19 (§7.4). Ayoub's login (organizer dashboard, branch `Ayoub`, `dashboard_campus/`) will be handed over and adapted here. Read-only review of that branch:

### 7.1 What Ayoub's login does

- **Auth.js v5** (`next-auth@^5.0.0-beta.32`) with the **`42-school` provider** only; `session: { strategy: 'jwt' }` (encrypted session cookie, no DB); `pages: { signIn: '/login', error: '/login' }`.
- **`signIn` callback → `syncWithBackend(profile)`**: `POST ${BACKEND_URL}/auth/sync` with header `x-internal-key: ${BACKEND_INTERNAL_KEY}` and `{ fortyTwoId, login, email, firstName, lastName, imageUrl, campus }`; expects `{ token, user: { id, role } }`. Non-OK → sign-in refused (`/login?error=AccessDenied`). **Dev fallback:** without `BACKEND_URL` it returns a fake `dev-token` / role `member`.
- **Session shape** (`types/next-auth.d.ts`): `session.backendToken`, `session.user.{ id, role, login }` + Auth.js defaults (`name`, `email`, `image`).
- **Login page**: split layout (campus photo `/UM6P_Campus.webp` left from `lg`, form right), email/password form **that is a stub** (always "Use the 42 Intra button to sign in."), "Continue with 42 Intra" → `signIn('42-school', { callbackUrl: '/admin' })`, copy for club managers ("CampusPulse").
- **`middleware.ts`** redirects signed-out users to `/login?callbackUrl=…`.

### 7.2 Gaps to close when integrating

| Gap | Detail | Proposed fix |
| --- | --- | --- |
| Backend endpoint | `POST /auth/sync` (internal key) doesn't exist in Ahmed's backend (branch `Ahmed`: `api/signup/` returns a DRF `Token`; JWT only for WebSockets) | Agree the endpoint with Ahmed: create/update the `UserMember` from the 42 profile, return a token the REST API accepts |
| `middleware.ts` | Deprecated in Next.js 16 (renamed `proxy.ts`, see `node_modules/next/dist/docs/.../proxy.md`); its matcher `/dashboard/:path*` doesn't match the dashboard's real routes (`/admin`, `/super_admin`), so it currently protects nothing | Here: `proxy.ts` (or server-side checks in pages) matching `/profile` |
| Email/password | UI only, no backend | Keep 42 only for students at first, or define `POST /api/auth/login` with Ahmed |
| Versions | Dashboard: Next 16.4.2 / React 19.3; here: Next 16.3.5 / React 19.2.8 | Install `next-auth@5 beta` here and check it builds; or align versions |
| 42 OAuth app | Redirect URI must include this app: `https://<host>/api/auth/callback/42-school` | Ask Ayoub which 42 app (client id) and add our URI, or a second app |
| Env | `AUTH_SECRET`, `AUTH_42_SCHOOL_ID`, `AUTH_42_SCHOOL_SECRET`, `AUTH_TRUST_HOST=true` (behind nginx), `BACKEND_URL`, `BACKEND_INTERNAL_KEY` | `.env` for the frontend service (never committed) |
| Naming / copy | "CampusPulse", "manage your club", `callbackUrl: '/admin'` | "Campus Hub", student copy, `callbackUrl` = the `?next=` our pages already send (`/auth/login?next=…`) |
| Two apps, one host? | Both use Auth.js cookies; on the same host they'd share cookie names | Different subdomains, or different `AUTH_URL` / cookie prefix |

### 7.3 How it plugs into this app

1. **Route** `/auth/login` (our links already point there with `?next=`) using our primitives and layout (inside the shell, campus background), reusing Ayoub's 42 button and error handling.
2. **`src/auth.ts`** (Auth.js config) + `src/app/api/auth/[...nextauth]/route.ts`.
3. **Session:** the root layout calls `await auth()` on the server and passes the mapped user to `SessionProvider` (`INITIAL_SESSION` mock goes away); `useSession()` consumers (navbar, RSVP card, attendees, contact card) don't change. Map Auth.js `{ name, email, image, login, role }` → our `User`.
4. **Server-side privacy (Phase 4 debts):** `/clubs/[slug]` replaces `IS_SIGNED_IN = true` with the real session (§6.13); decide attendee-name visibility (§6.9).
5. **Guards:** `/profile` redirects signed-out visitors to `/auth/login?next=/profile`.
6. **Logout** in the navbar session menu → `signOut()`.

### 7.4 Login page: `LoginLayout`, `LoginPanel`, `FortyTwoButton`, `lib/login.ts` (Step 5.1, 2026-11-19)

**Files:** `src/components/auth/LoginLayout.tsx`, `src/components/ui/layout/AppShell.tsx` + `src/lib/navigation.ts` (full-screen routes), `src/app/test/login/page.tsx` (bench), `src/components/auth/LoginPanel.tsx`, `src/components/auth/FortyTwoButton.tsx`, `src/lib/login.ts`, `public/UM6P_Campus.webp` (copied from Ayoub's branch)
**Status:** ✅ Validated (2026-11-19). Live on `/auth/login` since Step 5.2 (§7.5); the `/test/login` mock bench was removed then.

#### Business & product purpose

Every "Log in" link (navbar, tab bar, RSVP card, club contact card) points to `/auth/login?next=<page>`, which was a 404. This is what that page will show: one clear way in (**Continue with 42 Intra**), what signing in gives the student (RSVP, attendees, club contacts), what data we receive, and a readable message when a sign-in fails. After login the student lands back on the page they came from.

#### Core concepts & engineering decisions

- **Same design as Ayoub's dashboard login (decided 2026-11-19).** The first version was a card inside the shell; the team chose to copy Ayoub's split layout so both apps look the same: campus photo left from `lg` (1024 px), form right (`max-w-[22rem]`, "Welcome back" at `1.75rem`, secondary 42 button full width, same "42" tile). Only the wording changes (Campus Hub, students). `LoginLayout` (photo + column) and `LoginPanel` (column content) are separate so the layout can also host a future register/EMINES form.
- **Why not send students to Ayoub's page itself:** it's a different Next.js app. Logging in there creates the *dashboard's* session cookie and redirects to `/admin`; the student site wouldn't know the student is signed in. Sharing it would need one domain, one `AUTH_SECRET`, shared cookie settings and changes to his redirects. Copying the design gives the same look with none of that coupling.
- **Full screen, no shell (decided 2026-11-19).** Like Ayoub's page, the login shows only the login: no navbar, tab bar or footer. `AppShell` checks `isFullScreenRoute(usePathname())` (`lib/navigation.ts`, `FULL_SCREEN_ROUTES = ['/auth', '/test/login']`) and renders only `<main id="main-content">` for those routes. `usePathname` is known during the server render, so the shell is never sent and then removed (no flash). The check runs **after all of AppShell's hooks** (rules of hooks: the hook count must not change between renders). The way out is the **"← Campus Hub"** link at the top of the form column (and browser Back). The split fills the screen (`min-h-dvh`); the form column has a solid background so the site-wide campus line art doesn't show behind the form.
- **Bench:** `/test` holds the scenario controls; **`/test/login`** shows the page alone, full screen, with the same query (`?error=…&next=…`).
- **The photo is decorative (`alt=""`),** `priority` (above the fold on desktop), `sizes="50vw"`. The original is 4996 px / 795 KB; Next's image service serves a resized copy (~72 KB at 1080 px).
- **42 only, no email/password form (for now).** The backend has no password login (Ayoub's form is a stub that always says "use 42"), and showing a form that can't work is worse than not showing it. The first 42 sign-in creates the account, so `/auth/register` isn't needed as a separate page. **Open question:** EMINES students have no 42 Intra account; how they log in is still to be decided with Ayoub (TEAM_NEEDS §1b.1).
- **`<form action={serverAction}>` + hidden `redirectTo`.** The panel never calls Auth.js itself; the page passes the action. Step 5.2 passes `signIn('42-school', { redirectTo })` (Auth.js v5 server-side sign-in); `/test` passes a mock that waits 1.5 s and redirects. A form posting to a server action works **before JavaScript loads and with it off** (progressive enhancement), unlike an `onClick` that calls `signIn()` from `next-auth/react`.
- **`useFormStatus()` (React 19, `react-dom`)** in `FortyTwoButton` reads the pending state of the form it is inside: spinner + "Opening 42 Intra…" + disabled (no double submit), with no `useState`. It only works in a component rendered *inside* the `<form>`, which is why the button is its own client component (Next.js forms guide, `node_modules/next/dist/docs/01-app/02-guides/forms.md`).
- **`LoginPanel` stays a Server Component;** only the button ships JavaScript.
- **`safeNextPath(raw)` blocks open redirects.** `?next=` comes from the URL, so anyone can craft `/auth/login?next=https://evil.com` and send it to a student; after a real 42 login the site would forward them to a phishing page. Rules: must start with `/`, ≤ 512 chars, no control characters; parsed with `new URL(value, base)` and rejected if the origin changed (catches `//evil.com` and `/\evil.com`, which browsers read as `//evil.com`); `/auth/*` rejected (no login loop). Anything rejected → `/`. **The server action cleans it again**: the hidden field can be edited in DevTools.
- **Error codes → three messages.** Auth.js returns to the login page with `?error=`: `AccessDenied` (our sign-in callback / Django `/auth/sync` said no) → "We couldn't sign you in"; `Configuration` (secret, 42 keys, backend down) → "temporarily unavailable"; anything else (e.g. `OAuthCallbackError` when the student cancels on 42) → "Sign-in didn't finish". The raw code is never shown. The box is `role="alert"` and sits above the button, so it's read first.
- **Named `lib/login.ts`,** not `lib/auth.ts`, so it isn't confused with `src/auth.ts` (the Auth.js config, Step 5.2).

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Server action form | `onClick={() => signIn('42-school')}` (client) | Works without JS; no `next-auth/react` in the bundle; the redirect target is checked on the server |
| `useFormStatus` in a child | `useState(isLoading)` + `onSubmit` | No state to keep in sync; React resets it when the action ends |
| `action` passed as a prop | `LoginPanel` imports `signIn` | Testable on `/test` with a mock; the panel doesn't depend on Auth.js |
| Whitelist-by-parsing (`new URL` + origin) | Regex on the string | Uses the same parser as the browser, so tricks like `/\evil.com` are caught |
| 42 only | Email/password form like the dashboard's | No backend for it; a fake form misleads students |
| Copy Ayoub's design into this app | Redirect to the dashboard's `/login` | No shared session/cookies/domain to set up; same look for users |
| Pathname check in `AppShell` | Route groups with a second layout (move every page into `(site)/`) | One small check vs. moving every route and the root not-found/error pages; easy to add routes to the list |
| Full screen + "← Campus Hub" link | Keep the navbar | Same as Ayoub's login, nothing to distract; the back link and browser Back still lead out |

#### Component contract

```ts
LoginLayout: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { children: ReactNode }>  // full screen, photo left from lg, "← Campus Hub" link

// lib/navigation.ts
FULL_SCREEN_ROUTES: readonly string[]          // ['/auth', '/test/login']: AppShell hides navbar, tab bar, footer
isFullScreenRoute(pathname: string | null): boolean   // segment-aware ('/authors' is not full screen)
LoginPanel: forwardRef<HTMLDivElement, Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  action: (formData: FormData) => void | Promise<void>; // gets `redirectTo`
  next: string;                     // already cleaned with safeNextPath()
  error?: LoginErrorKind | null;    // default null
}>
FortyTwoButton: forwardRef<HTMLButtonElement, Omit<ButtonProps, 'type' | 'isLoading' | 'leftIcon' | 'children'>>
  // defaults: variant 'secondary', size 'md', full width; must be inside a <form>

// lib/login.ts
safeNextPath(raw: string | string[] | undefined | null): string   // '/' when unsafe
loginHref(next: string): `/auth/login?next=${string}`
getLoginErrorKind(code): 'access-denied' | 'unavailable' | 'generic' | null
LOGIN_ERROR_MESSAGES: Record<LoginErrorKind, { title; description }>
DEFAULT_AFTER_LOGIN = '/'
```

#### Usage

```tsx
// app/auth/login/page.tsx (Step 5.2)
const params = await searchParams;
<LoginLayout>
  <LoginPanel
    action={signInWith42}          // 'use server': signIn('42-school', { redirectTo: safeNextPath(formData.get('redirectTo')) })
    next={safeNextPath(params.next)}
    error={getLoginErrorKind(params.error)}
  />
</LoginLayout>
```

#### Verified

`tsc --noEmit` and ESLint pass. `/test` 200 for every scenario; the hidden `redirectTo` is `/` for `//evil.com`, `/\evil.com`, `https://evil.com` and `/auth/login`, and keeps `/events/evt_hackathon_ai` and `/calendar?date=2026-11-21&view=week`. `safeNextPath` in Node 22: `javascript:…`, newline, > 512 chars → `/`; `/authors` kept (segment check, not prefix); `/%2F%2Fevil.com` kept (it's an encoded path on our own site, not another host). `/test/login?error=AccessDenied&next=/clubs/leet-dev` 200 with no `<nav>` and no `<footer>`, the alert, and `redirectTo=/clubs/leet-dev`; `/` and `/test` still have navbar and footer. The three error boxes render their titles; the page contains "Welcome back" and the campus photo (resized copy 200, ~72 KB). Clicking the button (spinner, redirect), keyboard, screen reader, JS off, phone and dark mode: manual checks.

### 7.5 Real login: Auth.js + 42 on `/auth/login` (Step 5.2, 2026-11-19)

**Files:** `src/auth.ts` (Auth.js config), `src/app/api/auth/[...nextauth]/route.ts`, `src/app/auth/login/page.tsx`, `src/components/auth/DevLoginForm.tsx`, `src/types/next-auth.d.ts`, `LoginPanel` (`children` slot), `/test` (real session box + sign out). Infra: `docker-compose.yml` (frontend `environment`), `infrastructure/nginx/nginx.conf` (`/api/auth/`), root `.env` (values, never committed). Dependency: `next-auth@5.0.0-beta.32` (exact, same as Ayoub's dashboard; peer range includes Next 16).
**Status:** ✅ Built (2026-11-19); the whole site reads this session since Step 5.3 (§7.6).

#### Business & product purpose

The login page now really signs students in. "Continue with 42 Intra" starts the 42 OAuth flow; after 42, the student comes back to the page they were on, signed in. Until Ayoub provides the 42 keys and Django's `/auth/sync`, a **Dev login** button (developer machines only) signs in as the mock student so the team can build and test the signed-in pages (Step 5.3+).

#### How a login flows

1. `/auth/login` form → server action `signIn('42-school', { redirectTo })` → redirect to `api.intra.42.fr/oauth/authorize` (PKCE + state cookies set by Auth.js).
2. The student approves on 42 → 42 redirects to **`https://<host>/api/auth/callback/42-school`** → nginx sends it to Next.js (not Django) → Auth.js exchanges the code and reads `/v2/me`.
3. `signIn` callback → `syncWithBackend(profile)`: `POST ${BACKEND_URL}/auth/sync` with `x-internal-key` and `{ fortyTwoId, login, email, firstName, lastName, imageUrl, campus }` → expects `{ token, user: { id, role } }` (Ayoub's contract, TEAM_NEEDS §1b.1). Not OK / bad shape / Django down → login refused → `/auth/login?error=AccessDenied`.
4. `jwt` callback stores `backendToken`, `userId`, `role`, `login` in the **encrypted session cookie** `__Secure-authjs.session-token` (30 days). `session` callback exposes `{ id, role, login, name, email, image }`.
5. Redirect to `redirectTo` (cleaned by `safeNextPath`; Auth.js also refuses other origins: `callbackUrl=https://evil.com` → `/`).

#### Core concepts & engineering decisions

- **Same config as Ayoub's dashboard** (provider, `/auth/sync` body, dev fallback without `BACKEND_URL` → role STUDENT), so Django serves both apps with one endpoint. Differences: our `pages` point to `/auth/login`; the sync response is validated (`token`, `user.id`, a known role); the role is typed `UserRole`.
- **The Django token is NOT in the session.** Ayoub's puts `backendToken` on the session, but the session is also served to the browser at `/api/auth/session`, where any injected script could read it. Ours keeps it only in the encrypted cookie; server code that calls Django will read it on the server (decided when Phase 7 needs it).
- **Dev login (`AUTH_DEV_LOGIN=true`).** A Credentials provider with id `dev`, no password, returning `mockCurrentUser` as a STUDENT. Registered only when the flag is `true` **and** it's not a production build; the server action re-checks the flag. Important: our container runs `next dev` even with `make up`, so `NODE_ENV` alone is not a guard: **the flag must stay off on any shared or public deployment**. Dashed amber button so nobody mistakes it for a real option.
- **Signed-in visitors skip the form:** `/auth/login` calls `await auth()` and redirects to `next`.
- **`/api/auth/*` belongs to Next.js.** nginx sent all `/api/` to Django; a new `location /api/auth/` (longest prefix wins) sends Auth.js URLs to the frontend. Django has no `/api/auth/` routes (checked on `Ahmed`).
- **`AUTH_URL` is required behind nginx.** Without it Auth.js built every URL with the container port (`https://localhost:3000/api/auth/callback/42-school`): the 42 redirect URI and post-login redirects were wrong. `X-Forwarded-Host` doesn't help for the route handlers (they use Next's request URL). One value per environment: `https://localhost` in dev, `https://campusplus.ma` in production.
- **Session cookie typing:** in Auth.js v5 a `declare module 'next-auth/jwt'` extension doesn't reach the callbacks' `token`, so `src/auth.ts` checks each cookie field with `typeof` instead of trusting a type.

#### Environment variables (root `.env` → `docker-compose.yml` → frontend container)

| Variable | Dev value | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | random (`openssl rand -base64 32`) | Encrypts the session cookie. Different per environment; changing it signs everyone out. |
| `AUTH_URL` | `https://localhost` | Public address, no trailing slash |
| `AUTH_TRUST_HOST` | `"true"` (set in compose) | Behind nginx |
| `AUTH_42_SCHOOL_ID` / `AUTH_42_SCHOOL_SECRET` | empty until Ayoub shares them | Read automatically by the 42 provider. The 42 app's redirect URI must include `https://localhost/api/auth/callback/42-school` (and the production one). |
| `BACKEND_URL` / `BACKEND_INTERNAL_KEY` | empty | Empty URL = dev fallback (no Django call, everyone is STUDENT). Later: `http://web:8000` + the shared key. |
| `AUTH_DEV_LOGIN` | `true` | Dev login button. Compose default `false`. |

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Auth.js v5 beta (same as the dashboard) | Hand-written OAuth + cookies (Next's auth guide) | PKCE/state/CSRF/cookie encryption done and audited; same code as Ayoub's app |
| JWT session (cookie) | Database sessions | No DB on the Next side; Django owns users |
| Token only in the cookie | `session.backendToken` (Ayoub's) | Not readable from browser JavaScript |
| Dev login provider behind a flag | Wait for 42 keys and `/auth/sync` | Steps 5.3+ (navbar, guards, logout) can be built and tested now |
| `AUTH_URL` per environment | nginx `X-Forwarded-*` only | Route handlers ignore them in this setup; measured |
| nginx `/api/auth/` → Next | Auth.js `basePath` outside `/api` | Keeps the standard callback path Ayoub's 42 app already uses |

#### Contract

```ts
// src/auth.ts (server only)
export const { handlers, auth, signIn, signOut }   // NextAuth(...)
export const DEV_LOGIN_ENABLED: boolean           // AUTH_DEV_LOGIN === 'true' && not a production build
auth(): Promise<Session | null>
Session['user']: { id: string; role: UserRole; login: string | null; name?; email?; image? }

// DevLoginForm: forwardRef<HTMLFormElement, { action: (fd: FormData) => void | Promise<void>; next: string }>
// LoginPanel: + children?: ReactNode (rendered under the 42 button)
```

#### Verified (curl through nginx, 2026-11-19)

`/api/auth/providers` answered by Next with `42-school` + `dev`, URLs on `https://localhost` (after `AUTH_URL`). Dev login (`POST /api/auth/callback/dev`) → 302 to `/test`; `/api/auth/session` = `{ name: "Mouad Najjar", role: "STUDENT", id: "usr_01", login: null }` (no token); `/test` box "signed in". `/auth/login?next=/calendar` while signed in → 307 to `/calendar`. Cookies `__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`, `__Secure-authjs.session-token`. `callbackUrl=https://evil.com` → `/`. 42 sign-in → 302 to `api.intra.42.fr/oauth/authorize` with `redirect_uri=https://localhost/api/auth/callback/42-school` (`client_id` empty: no keys yet). Sign-out → 302 `/test`. `/api/auth/error?error=AccessDenied` → `/auth/login?error=AccessDenied`. `/api/health/` still Django (200). `tsc --noEmit` and ESLint on the changed files pass. **Not tested:** a real 42 round trip (no keys) and the form buttons in a browser.

#### Notes / gotchas

- **Editing `infrastructure/nginx/nginx.conf` needs `docker compose restart nginx`,** not `nginx -s reload`: the file is a single-file bind mount, and editors replace the file, so the container keeps the old one (reload then fails with "default.conf: No such file").
- **New env variables need the container recreated** (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend`), a restart is not enough.
- `npm install` inside the container rewrote `package-lock.json` without the `libc` fields (different npm version); harmless.
- ~~`npm audit`: Next 16.3.5 has critical advisories~~ upgraded to 16.4.6 (§7.9).
- ~~The navbar's "Sign up" still links to `/auth/register` (404)~~ removed in Step 5.3 (§7.6).
- Ayoub's dashboard and this app must not share cookie names on one host (both `authjs.*`): different hosts/subdomains, or set `cookies` names in one of them.

### 7.6 The whole site uses the real session (Step 5.3, 2026-11-19)

**Files:** `src/app/layout.tsx`, `src/auth.ts` (`getSessionState`), `src/lib/session.ts` (`toSessionState`), `src/components/providers/SessionProvider.tsx`, `src/app/clubs/[slug]/page.tsx`, `src/components/ui/layout/Navbar.tsx` + `MobileNav.tsx` (no "Sign up"), `src/types/navigation.ts` (`/auth/register` removed), `/test` + `SessionSwitcher`.
**Status:** 🧪 Live on every page, waiting for validation.

#### Business & product purpose

Until now every visitor was shown as signed in (a mock). Now the navbar, phone tab bar, drawer, RSVP card, attendees list and club contact card follow the real login: a visitor sees **Log in**, a student who logged in sees their avatar and the bell, and **club presidents' contact details are only sent to signed-in students** (Phase 4 privacy debt §6.13 closed).

#### Core concepts & engineering decisions

- **Server reads, client displays.** The root layout (`async`) calls `getSessionState()` and passes the result to `SessionProvider`; every client component keeps calling `useSession()` unchanged. Because the first HTML already contains the right state, there's no "Log in" → avatar flash and no client-side session fetch (no `next-auth/react` `SessionProvider` in the bundle).
- **`getSessionState` = `cache(auth → toSessionState)`.** React `cache` dedupes per request, so the layout and the club page share one cookie decode. It **never throws**: if Auth.js fails (e.g. `AUTH_SECRET` missing), the error is logged and the site shows signed out instead of the global error page.
- **`toSessionState` (pure, `lib/session.ts`)** maps the Auth.js user to our `User` (`full_name` ← name ‖ 42 login ‖ "Student", `avatar_url` ← image, `club_id: null` until Django's `/api/me/`). The app keeps one user shape, the one the API will return.
- **`SessionProvider` no longer copies the prop into state.** `useState(initialSession)` would freeze the first value; after a login/logout in a server action Next re-renders the layout with a new prop, and the UI must follow it. The provider now uses the prop directly, plus a test-only override (`setSession(state | null)`, `null` = back to real) used by `/test`'s `SessionSwitcher`.
- **Club contact decided on the server:** `isSignedIn = (await getSessionState()).status === 'signed-in'`; signed out → `contact={null}` → the email/phone are not in the HTML or RSC payload (measured).
- **No "Sign up".** With 42 the first login creates the account, so the navbar shows one primary **Log in** button and the drawer one full-width Log in; `/auth/register` is gone from `AppRoute`. If EMINES email sign-up arrives (TEAM_NEEDS §1b.1) it comes back as its own step.
- **Every page renders per request** because the layout reads cookies. They already did (`connection()` in each page), so nothing got slower.

#### Architectural tradeoffs

| Chosen | Alternative | Why |
| --- | --- | --- |
| Session read in the server layout, passed down | `next-auth/react` `SessionProvider` + `useSession()` (fetches `/api/auth/session` in the browser) | Correct first paint, no extra request, no extra JS; our consumers don't change |
| Prop used directly + test override | `useState(initialSession)` | Follows login/logout without a full reload |
| `cache()` wrapper | Call `auth()` in each place | One decode per request; one place that handles errors |
| Fail to signed-out | Let the error bubble | A broken auth config shouldn't take the public site down |
| One Log in button | Log in + Sign up to the same page | Two buttons for one action confuse; 42 makes them the same |

#### Contract

```ts
// src/auth.ts (server only)
getSessionState(): Promise<SessionState>   // cached per request, never throws
// src/lib/session.ts
toSessionState(session: Session | null): SessionState
// SessionProvider
useSession(): { session: SessionState; setSession(state: SessionState | null): void }  // setSession: /test only
```

#### Usage

```tsx
// A server page that hides private data from visitors
const isSignedIn = (await getSessionState()).status === 'signed-in';
<ClubHeader contact={isSignedIn ? getClubContact(club) : null} />

// A client component (unchanged since Phase 2)
const { session } = useSession();
```

#### Verified (curl through nginx, 2026-11-19)

Signed out on `/`, `/clubs/leet-frame`, `/events/evt_hackathon_ai`, `/calendar`: "Log in" present, no "Sign up" / `/auth/register`, no profile avatar link; `leetframe@1337.ma` absent from the club page. After a dev login: avatar link "My Profile (Mouad Najjar)" on all four, no "Log in", the club email present. `/auth/login` signed in → 307. All routes 200, `/nope` 404. `tsc --noEmit` passes; ESLint on the changed files only reports the known `Date.now` purity rule in the club page (§1.5b). **Not tested in a browser:** the navbar updating after Dev login without a reload, and the phone tab bar/drawer.

#### Notes

- **No logout button in the UI yet** (only on `/test`). It comes with `/profile` in Step 5.4, together with the route guard.
- Attendee names for signed-out visitors (§6.9) are still a team decision (TEAM_NEEDS §4); the attendees section already follows the session.

### 7.7 Profile page from the Figma design (Step 5.4, 2026-11-19)

**Design:** Figma `ft_transcendence-ui` › frames "My Profile · Desktop · Light / Dark / Phone · Light / Phone · Empty / Desktop · Loading" (node `155:3` "Profile ui"). Generated from our design-system prompt, then implemented here with our components.
**Files:** `src/components/profile/` (`ProfileView`, `ProfileHero`, `ProfileActivity`, `AttendedEventList`, `ProfileSkeleton`, `profileIcons.tsx`, `profileStyles.ts`), `src/components/auth/LogoutForm.tsx`, `Avatar` (`2xl` = 104px), `lib/time.ts` (`formatDateTile` / `getDateTiles`), `lib/events.ts` (`splitEventsByTime`, `getMyEvents`; `getClubEvents` uses the split), `PastEventList` (extracted from `ClubEvents`, still used there), session `campus` (`src/auth.ts`, `types/next-auth.d.ts`), `mockData` (basketball final RSVP'd).
**Status:** ✅ Validated (2026-11-19). Live on **`/profile`** (alias `/me`) since Step 5.4b (§7.8). First version (a plain card) was replaced the same day after review ("layout super simple" + a bug, below).

#### Business & product purpose

The navbar avatar links to `/profile`, which didn't exist (404). A student needs one place to see **who they're signed in as**, **what they're going to and went to**, quick numbers, and **Log out** (until now only on `/test`).

#### Layout (matches the Figma frames)

1. **Heading row:** "My profile" (muted) + **Log out** (44px secondary, out-arrow icon).
2. **`ProfileHero`:** violet gradient banner (104px; "CAMPUS HUB / Your campus. Your community." on desktop, "1337 × EMINES" on phones), 104px avatar overlapping it (absolute from `sm`, pulled up in the flow on phones), name = the page's only `h1`, `@login` (mono) + role chip (violet Student / emerald Club board / neutral Admin) + campus chip, email, "Member since" (hidden until Django sends it), disabled **"Edit profile · Soon"** and **"Change photo · Soon"**.
3. **Stats** (in `ProfileActivity`): Upcoming RSVPs · Events attended · Clubs followed ("—" + "Coming soon"). Desktop: icon tile + value + label; phones: centered value over a short label.
4. **"Your events"** + segmented tabs **Going (n) / Went to (n)** (our `Tabs` primitive: roving focus, arrow keys; active tab violet via `aria-selected:` classes). Going = our `EventGrid`/`EventCard` (RSVP cancellable); Went to = `AttendedEventList`.
5. **"Recently attended":** latest 3 past events + "Latest 3 of N events" ("3 of N" on phones).
6. **Empty states:** Going → card with calendar tile, "No upcoming events yet", "Find your next workshop, match, or campus night out.", primary "→ Discover events"; past → "No past events yet / The events you attend will appear here."
7. **`ProfileSkeleton`:** the loading frame, same boxes as the page.

#### Core concepts & engineering decisions

- **Reuse over Figma markup.** The Figma code is a reference: event cards are our real `EventCard` (the design's card was drawn from it), tabs are our `Tabs`, avatar is `Avatar` (new `2xl` size). Figma's absolute positions became flex/grid; 1440px frame padding became our `max-w-7xl` container.
- **Icons:** the design's six SVGs (`out`, `chevron`, stat `calendar` / `check` / `club`) are reproduced in `profileIcons.tsx` with the **same paths, viewBoxes and stroke widths**, but `stroke="currentColor"` instead of the baked hex, because the dark frame uses lighter tints. Event-card icons stay those of `EventCard`.
- **`ProfileActivity` is one client component** (stats + tabs + recently attended) so the counts follow RSVP changes on the cards. A cancelled card stays until reload (undo on the spot).
- **Bug fixed: "schedule is undefined".** The first version kept its RSVP list in `useState(upcoming)`; when the server sent a new list (switching scenarios, later a refresh), the old cards were rendered with the new `schedules` map. Now the component resets its list when the `upcoming` prop changes (React's "adjust state when a prop changes" pattern, during render).
- **Date tiles ("NOV / 14")** are formatted on the server in campus time (`getDateTiles`), like every date in the app (§5.2).
- **`ProfileView`** (Server Component) composes the page and formats dates; used by the `/test` bench and (next) `app/profile/page.tsx`, so both render the same thing.
- **`LogoutForm`**: server-action form (`signOut({ redirectTo })` passed as a prop), `useFormStatus` spinner + "Logging out…", works without JavaScript.
- **Chips** (`profileStyles.ts`): the design's violet role tint isn't in the `Badge` primitive's palettes, so a small `Record<tone, classes>` map is used for the profile only.
- **Campus in the session** (42 `campus[0].name`, dev login "Benguerir"); sessions created before 5.4 don't have it: log out and in again.
- **Mock data:** the two events the mock student had RSVP'd to have ended (today 2026-11-19), so the basketball final (Nov 21) is now RSVP'd (`rsvps_count` 1 → 2). All mock events are past after Nov 27.

#### Not in the design data yet (shown as placeholders or hidden)

"Member since" (needs `/api/me/`), "Clubs followed" (needs the join/follow API), photo change and profile edit ("· Soon"), real RSVP list (`GET /api/me/rsvps/`, Phase 7).

#### Component contract

```ts
ProfileView: { user: User; login: string | null; campus: string | null; upcoming: EventItem[]; past: EventItem[]; logoutAction: () => void | Promise<void> }
ProfileHero: { user; login; campus; memberSince?: string | null }
ProfileActivity: { upcoming; past; schedules: Record<string, EventSchedule>; dateTiles: Record<string, DateTile> }   // 'use client'
AttendedEventList: { events: EventItem[]; dateTiles: Record<string, DateTile> }
LogoutForm: { action: () => void | Promise<void> }   // 'use client'
ProfileSkeleton: HTMLAttributes<HTMLDivElement>       // "Loading profile"
getMyEvents(events, now) / splitEventsByTime(events, now): { upcoming; past }
getDateTiles(events): Record<id, { month: 'NOV'; day: '14' }>
```

#### Verified (curl, 2026-11-19)

Signed in (dev login): h1 "Mouad Najjar"; "My profile", "Log out", both banner texts, both "· Soon" buttons, the three stat labels + "Coming soon", two tabs, the basketball card, "Recently attended" with "Latest 2 of 2", "Attended" chips, date tiles 18 / 05 (NOV). `?scenario=no-events`: "No upcoming events yet" + "No past events yet". No server errors. `tsc --noEmit` and ESLint pass (only the known `<img>` warning in `Avatar`). **Not done:** screenshot comparison with Figma (the headless browser download didn't finish); visual check, keyboard, dark mode and phone are the user's browser checks.

### 7.8 `/profile` route, guard, `/me` alias (Step 5.4b, 2026-11-19)

**Files:** `src/app/profile/layout.tsx` (guard), `page.tsx`, `loading.tsx`; `next.config.ts` (`/me` redirect); `/test` reset to "nothing under test" (keeps a real-session box + `SessionSwitcher`).
**Status:** ✅ Live.

- **Guard in `profile/layout.tsx`, not the page.** `loading.tsx` streams the skeleton as soon as the page starts rendering, and after that the HTTP status is already sent (§6.21), so a `redirect()` in the page would become a client-side redirect behind a 200. The segment's layout runs **before** the loading boundary, so a signed-out visitor gets a real **307 → `/auth/login?next=%2Fprofile`** and comes back to `/profile` after login. Uses the cached `getSessionState()` (no second cookie decode).
- **`page.tsx`**: `connection()` (request time), session (+ `auth()` for 42 login/campus), `getMyEvents(mockEvents, now)`, `ProfileView`. Logout = `signOut({ redirectTo: '/' })` (a signed-out visitor can't stay on `/profile`). `noindex, nofollow` (personal page). Title "My profile | Campus Hub".
- **`/me`** → `/profile` via `next.config.ts` `redirects()` (307, not permanent, in case `/me` becomes its own page). Changing `next.config.ts` needs `docker compose restart frontend`.
- The navbar avatar (and the phone tab "Profile") now land on a real page and show as active there (`aria-current="page"`, `PROFILE_NAV_ITEM` with the `/me` alias).

**Verified (curl, 2026-11-19):** signed out `/profile` → 307 `/auth/login?next=%2Fprofile`; `/me` → 307 `/profile`. Dev login → `/profile` 200, title "My profile | Campus Hub", h1 "Mouad Najjar", basketball card, "Recently attended", `noindex`; avatar link `aria-current="page"`. `/`, `/calendar`, `/clubs`, a club, an event, `/test` 200; `/auth/login` signed in → 307. No server errors. `tsc` and ESLint pass.

### 7.9 Next.js 16.4.6 security upgrade, session error fix, housekeeping (2026-11-19)

- **`next` and `eslint-config-next` 16.3.5 → 16.4.6** (exact). `npm audit` reported **critical** advisories for 16.0–16.4.4 (RCE in the image optimizer with SVG, RCE and cache leaks in `use cache`, cache poisoning, SSRF in image optimization, DoS via Server Actions). React stays 19.2.8 (peer range `^19`). `npm audit fix` also updated `source-map-js` (high). Result: **0 vulnerabilities**. Upgrade guide checked (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`): the only 16.4 change is the removal of `experimental.appNewScrollHandler`, which we don't use. The dashboard (Next 16.4.2) is still affected → TEAM_NEEDS §2.4.
- **Bug fixed in `getSessionState()` (§7.6):** its `try/catch` swallowed Next.js's internal "dynamic server usage" signal (thrown when a page reads cookies during the build's static attempt). The production build logged it as "[auth] could not read the session", and in the worst case a page could be cached as signed out for everyone. Now `unstable_rethrow(error)` (from `next/navigation`) lets Next's control-flow errors through before logging real ones. Rule: **any `try/catch` around code that can call `cookies()`, `headers()`, `redirect()` or `notFound()` must call `unstable_rethrow` first.**
- **Production build check:** `next build` in a throwaway copy inside the container (`/tmp/bc`, `node_modules` **copied**, not symlinked: Turbopack refuses files outside the project root). All routes dynamic (ƒ), no errors.
- **`tsconfig.tsbuildinfo` untracked** (`*.tsbuildinfo` in `frontend/.gitignore`): `tsc --noEmit` rewrote it on every run, leaving the tree dirty.
- **Root `.env.example`** (TEAM_NEEDS 0.3): DB, Django and every login variable with comments; `AUTH_DEV_LOGIN=false` by default.

**Verified (2026-11-19):** served version 16.4.6; signed out `/`, `/calendar`, `/clubs`, a club, an event, `/auth/login`, `/test` 200, `/profile` 307, `/nope` 404; dev login → `/profile` 200, `/me` 307, `/auth/login` 307, club email shown, session role STUDENT. `tsc` passes; ESLint shows only the known older errors (§1.5b, next on the list). No server errors.

---

## 8. Lint cleanup (2026-11-20)

Goal: `make lint` with zero errors, so it can become a required check (§1.5b). Starting point: 10 errors + 1 warning, all in code from before ESLint was configured. Done step by step:

| Step | Fixes | Status |
| --- | --- | --- |
| L.1 | `react-hooks/purity`: `Date.now()` in the 6 per-request server pages | ✅ Done (§8.1) |
| L.2 | `react-hooks/set-state-in-effect`: `setMounted(true)` mount guards in `Modal`, `MobileNav`, `NotificationPopover`; update CLAUDE.md rule 5 | ⏳ |
| L.3 | `NotificationPopover` clock (`setNow` in an effect), `useCampusSearch` (`Date.now()` in `useMemo`) | ⏳ |
| L.4 | `@next/next/no-img-element` warning in `Avatar` | ⏳ |

### 8.1 `getRequestTime()`: "now" for Server Components (Step L.1)

**File:** `src/lib/requestTime.ts` (new). **Used by:** `(feed)/page.tsx`, `calendar/page.tsx`, `clubs/page.tsx`, `clubs/[slug]/page.tsx`, `events/[id]/page.tsx`, `profile/page.tsx`.
**Status:** ✅ Done.

#### Business & Product Purpose
No visible change. Every page that hides ended events or picks "today" still uses the request time. The point is that lint can pass without hiding errors, and that nobody can read "now" on a page and forget to make it per-request (the bug in §5.5: ended events kept showing in production).

#### Core Concepts & Engineering Decisions
- `getRequestTime()` = `await connection()` + `return Date.now()`. One call does both, so "per-request" and "now" can't drift apart.
- React's `react-hooks/purity` rule flags `Date.now()` **in a component body** (a component should give the same output for the same input). Reading it inside a helper outside the component is fine: the page receives `now` as a value, and it is still read once per request.
- `/profile` had silenced the same error with `// eslint-disable-next-line react-hooks/purity`; that comment is gone.
- **Rule from now on:** a Server Component that needs the time writes `const now = await getRequestTime();` and passes `now` down. Never `Date.now()` in a component.

#### Architectural Tradeoffs
| Chosen | Alternative | Why not |
| --- | --- | --- |
| A helper that does `connection()` + `Date.now()` | `eslint-disable` comment on each page (what `/profile` did) | Six comments that hide the rule; a new page would copy the comment, not the reason |
| Same | Turn `react-hooks/purity` off in `eslint.config.mjs` | Loses the rule for Client Components, where `Date.now()` in render really is a bug (`useCampusSearch`, L.3) |
| Same | Read time in the browser | Browser clock and time-zone data differ from the server's, hydration mismatch (§5.5, ARCHITECTURE §7.2) |

#### Contract
```ts
getRequestTime(): Promise<number>   // ms since epoch, at request time; makes the calling route dynamic. Server only.
```

#### Usage Example
```tsx
export default async function Page() {
  const now = await getRequestTime();
  return <EventGrid events={getUpcomingEvents(mockEvents, now)} />;
}
```

#### Verified (2026-11-20)
`tsc --noEmit` passes. ESLint 11 → 6 findings (all 6 server-page purity errors gone; left: L.2–L.4). `/`, `/calendar`, `/clubs`, `/clubs/1337`, `/events/1`, `/test` 200; `/profile` and `/me` 307 signed out (unchanged). No server errors. Nothing to try on `/test`: no visible change.

---

## 9. Privacy Policy & Terms of Service (mandatory, subject v21.2)

The subject rejects the project if these pages are missing, empty or placeholders, or not easy to reach (e.g. footer links) (TEAM_NEEDS §5.1).

| Step | Deliverable | Status |
| --- | --- | --- |
| 9.1 | `LegalPage` layout + the text of both documents | ✅ Built (previewed on `/test`, then moved to the routes in 9.2) |
| 9.2 | Routes `/privacy` and `/terms`, metadata, footer "Legal" links (page footer + phone drawer) | ✅ Live (§9.2), waiting for the user's browser check |
| 9.3 | Event page: attendee names and faces for signed-in students only, signed-out visitors see the count (matches the policy) | ✅ live |
| 9.4 | Only signed-in students can RSVP: event cards show "Log in to RSVP" when signed out, no "Going" for signed-out visitors | ✅ live |

### 9.1 `LegalPage`, `legalContent`, `lib/legal.ts` (Step 9.1, 2026-11-20)

**Files:** `src/components/legal/LegalPage.tsx` (layout + `LegalList`, `LegalTerm`, `LegalTable`, `legalLinkStyles`), `src/components/legal/legalContent.tsx` (`PRIVACY_POLICY`, `TERMS_OF_SERVICE`), `src/lib/legal.ts` (contact email, last-updated date, session lifetime), `types/navigation.ts` (`AppRoute` + `/privacy`, `/terms`), `/test` (`?doc=privacy|terms`).
**Status:** ✅ Live on `/privacy` and `/terms` (§9.2).

#### Business & Product Purpose
Students must know what Campus Hub collects (42 profile, email sign-up, RSVPs, memberships, roles, uploads), who sees it, which cookies we set and how to get their data deleted; and the rules for RSVPs, clubs and acceptable use. Mandatory for the evaluation.

#### Core Concepts & Engineering Decisions
- **Text written from the code, not a template:** the 42 fields come from `auth.ts` (`syncWithBackend`), the cookies are Auth.js's (`authjs.session-token` 30 days default, `csrf-token`, `callback-url`) plus Ahmed's `ws_access` (5 min). No `localStorage`, no analytics, so no cookie banner. Email + password sign-up is described already (mandatory, being built with Ayoub).
- **Moroccan law:** rights under Law No. 09-08, complaints to the CNDP; governing law Moroccan.
- **Content as data:** each document is `{ title, summary, sections: { id, title, body }[], related }`. The same list draws the table of contents and the sections, so they never disagree. Section `id`s are anchors (`/privacy#cookies`).
- **Server Component, zero JS:** no hooks; the table of contents is plain `#anchor` links. `scroll-mt-24` keeps a jumped-to heading below the sticky navbar; on `lg` the contents column is `sticky`.
- **Accessibility:** one `h1`; `nav` labelled by its "On this page" heading; each `section` labelled by its `h2`; the cookie table has a `caption` (sr-only) and `th scope="col"`; external links say "(opens in a new tab)" to screen readers; `ps-5` (logical) so lists mirror in Arabic.
- **One place for shared facts:** `lib/legal.ts` (contact email, "last updated" as a fixed string, not a `Date`: same label on server and browser).

#### Architectural Tradeoffs
| Chosen | Alternative | Why |
| --- | --- | --- |
| Typed section data with JSX bodies | Markdown/MDX files | No new dependency or build step; bodies still use our link/list components and constants (contact email) |
| Same | One big JSX page per document | TOC would be written twice and drift |
| Plain `<a href="#…">` contents | Client scroll-spy highlighting | Zero JS; scroll-spy is decoration for a page read once |
| Fixed date string | `new Date().toLocale…` | No hydration/time-zone differences; the date is a legal fact, not "now" |

#### Component Contract
```ts
LegalPage: { document: LegalDocument; lastUpdated: { iso: string; label: string } } & HTMLAttributes<HTMLElement>  // forwardRef → <article>
LegalDocument: { title: string; summary: ReactNode; sections: readonly LegalSection[]; related: { label: string; href: AppRoute } }
LegalSection: { id: string; title: string; body: ReactNode }
LegalTable: { caption: string; columns: readonly string[]; rows: readonly (readonly ReactNode[])[] }
LegalList / LegalTerm: { children: ReactNode }
LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, SESSION_LIFETIME_DAYS   // lib/legal.ts
```

#### Usage Example
```tsx
<LegalPage document={PRIVACY_POLICY} lastUpdated={LEGAL_LAST_UPDATED} />
```

#### To confirm with the team
- ✅ **Contact:** `campushub.1337.team@gmail.com`, the team's shared Gmail (2026-11-20). Every member can read it; someone must answer within 30 days (the policy promises it).
- ✅ **Attendee names: signed-in students only** (team decision, 2026-11-20, TEAM_NEEDS §4). Signed-out visitors see the count. Done on our side in Step 9.3 (§9.3); Ahmed's API must enforce it too (TEAM_NEEDS §1.1).
- When a feature changes data or cookies (uploads, avatars, live updates), update `legalContent.tsx` and `LEGAL_LAST_UPDATED` in the same change.

#### Verified (2026-11-20)
`tsc` passes; ESLint: no new findings (6 known, §8). `/test` 200 with h1 "Privacy Policy" and 10 sections; `?doc=terms` 200 with h1 "Terms of Service" and 11 sections; `/`, `/calendar`, `/clubs` 200; no server errors after the restart. Browser checks (keyboard, phone, dark mode, reading the text) are the user's, listed on `/test`.

### 9.2 `/privacy`, `/terms` and the footer's "Legal" links (Step 9.2, 2026-11-20)

**Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` (metadata title + description, `LegalPage` with the document), `lib/navigation.ts` (`LEGAL_LINKS`), `components/ui/layout/Footer.tsx` (`FooterLegal` renders them), `/test` reset to "nothing under test".
**Status:** ✅ Live.

- **Where the links are:** `FooterLegal`'s bottom row, so they are on **every page** (page footer, `full`) and in the **phone drawer** (`compact`, under the campus links). Links are in a `<nav aria-label="Legal">` landmark. The drawer closes by itself on navigation (it already watches the pathname).
- **Not a third footer column:** the bottom row next to the copyright is where people look for legal links, and the two columns (Explore, Campuses) stay as they are on phones.
- **Rendering:** the pages read nothing themselves, but they render per request anyway because the root layout reads the session cookie (§7.6). Cheap: no data, no JS.
- **Gotcha hit twice today:** new route folders were 404 / "Module not found" until `docker compose restart frontend` (§1.5b).

**Verified (2026-11-20):** `/privacy` 200 "Privacy Policy | Campus Hub", `/terms` 200 "Terms of Service | Campus Hub"; the footer of `/calendar` links to `/privacy` and `/terms`; `/terms` links back to `/privacy`; `/`, `/calendar`, `/clubs`, `/test` 200; `tsc` passes; ESLint no new findings; no server errors.

### 9.3 Attendee names for signed-in students only (Step 9.3, 2026-11-21)

**Files:** `lib/events.ts` (`withoutAttendees`, renamed `forSignedOutVisitor` in §9.4, `eventsForVisitor`), `components/events/AttendeesSection.tsx` (states), `components/events/EventCard.tsx` (faces only when signed in, now `'use client'`), `components/ui/layout/navIcons.tsx` (`LockIcon`, moved here from `ClubContactCard`), pages: `app/events/[id]/page.tsx`, `app/(feed)/page.tsx`, `app/clubs/[slug]/page.tsx` (server filtering). Tested on `/test` (session switcher + server check), then `/test` reset.
**Status:** ✅ Live (validated 2026-11-21). `/profile` needs nothing: it is signed-in only.

**Business purpose.** The Privacy Policy ("Who can see it") promises that only signed-in students see who is going to an event; signed-out visitors see how many. This step makes the site keep that promise, the same way the club president's contact is protected (§6.13).

**Core concepts & decisions.**
- **Two layers.** (1) The **server** decides what data leaves it: `eventsForVisitor(events, isSignedIn)` empties `attendees_preview` for signed-out visitors and the event page sends `attendees=[]`. Hiding names with CSS or a client check alone is not privacy: they would still be in the page's RSC payload (anyone can read it with "View source"). (2) The **client** decides what to draw from `useSession()`, which covers the session `loading` state and the `/test` session switcher.
- **`AttendeesSection` states** (`Record<AttendeesState, ReactNode>`, no nested ternaries): `empty` (count 0: "Nobody has RSVP'd yet", wins because there is nothing to hide) → `loading` (grey circles + line, `aria-hidden`, names never flash) → `locked` (signed out: lock line "Names are only shown to signed-in students." + "Log in to see who's going/who went" link built with `loginHref`, so the student comes back to the same event) → `visible` (as before: avatars, sentence, "See all" dialog). The heading keeps the count in every state: "Who's going (120)". The dialog can only open in `visible`.
- **`EventCard`**: draws the small faces only when `session.status === 'signed-in'`; otherwise just "120 going". It was already a client component (rendered inside `EventGrid`), the `'use client'` line now says so explicitly because it calls a hook.
- **Login link is a text link**, not a primary button: the RSVP card on the same page already has the primary "Log in to RSVP"; two violet buttons would compete.

**Tradeoffs.**
- *Server filtering vs. client-only hiding:* client-only is one line, but leaks the names in the page data. Server filtering costs one helper call per page and is the only version that matches the policy.
- *Strip in the page vs. trust the API (Phase 7):* Ahmed's API will return an empty list to anonymous requests (TEAM_NEEDS §1.1). We keep `eventsForVisitor` anyway as a second guard: if the API ever forgets, the frontend still doesn't leak.
- *Blurred/anonymous faces vs. no faces:* grey placeholder faces would hint at a list you can't see and look broken; a lock line says why and how to fix it.

**Contract.**
```ts
forSignedOutVisitor(event: EventItem): EventItem            // was withoutAttendees; same object if nothing to hide
eventsForVisitor(events: EventItem[], isSignedIn: boolean): EventItem[]
// AttendeesSection props unchanged: { event, attendees, hasEnded } (attendees = [] for signed-out visitors)
```

**Usage (as in the real pages):**
```tsx
const isSignedIn = (await getSessionState()).status === 'signed-in';
<EventPageShell initialEvent={isSignedIn ? event : forSignedOutVisitor(event)}
  attendees={isSignedIn ? getMockAttendees(event) : []} … />
<EventFeed initialEvents={eventsForVisitor(upcomingEvents, isSignedIn)} … />
```

---

### 9.4 Only signed-in students can RSVP (Step 9.4, 2026-11-21)

**Files:** `components/events/EventCard.tsx` (RSVP slot per session state), `lib/events.ts` (`withoutAttendees` → `forSignedOutVisitor`, now also clears `has_user_rsvpd`), pages: `app/events/[id]`, `app/(feed)`, `app/clubs/[slug]`, `app/calendar` (now filtered too).
**Status:** ✅ Live (2026-11-21). Bug fix reported by the user, checked on the real pages (no `/test` step).

**Business purpose.** Signed-out visitors could press "RSVP" on the event cards (feed, club pages): the count went up and a "You're going" toast appeared, for a visitor with no account. The event page's RSVP card already did the right thing ("Log in to RSVP", §6.9); the cards didn't. Also, signed-out visitors saw "Going" on events the mock user RSVP'd to.

**Core concepts & decisions.**
- **Card RSVP slot = exhaustive state table** (`CardRsvpState`: `loading` → disabled "RSVP"; `signedOut` → "Log in to RSVP" **link** to `loginHref('/events/:id')`; `going` → "Going ✓" button; `notGoing` → "RSVP" button), same states as `RsvpCard`. The link lands on the event page after login, where the student can RSVP with the full details in view. Each entry keeps the sr-only "to <event title>" so the buttons/links stay distinguishable in a screen reader's list.
- **Link, not a button that redirects:** it navigates, so it is an `<a>` (opens in a new tab, shows its URL). Styled like Button primary/sm; `relative z-10` keeps it above the card's stretched link.
- **Server guard:** `forSignedOutVisitor` now also sets `has_user_rsvpd: false`, so no page tells a signed-out visitor "Going" (cards, event page, calendar agenda badge). The calendar page now runs `eventsForVisitor` as well.
- **The backend is the real lock:** Ahmed's `POST /api/events/:id/rsvp` must answer 401 without a session (TEAM_NEEDS §1.1). The UI only stops offering the action.

**Tradeoffs.**
- *Hide the button vs. "Log in to RSVP":* hiding it leaves signed-out visitors without the main call to action; the link explains why and leads to login.
- *Guard in each `onRsvpToggle` handler (EventFeed, ClubEvents, ProfileActivity) vs. in the card:* the card is the one place every grid goes through, and it already reads the session for the faces (§9.3).

**Contract.** `EventCard` props unchanged. `forSignedOutVisitor(event): EventItem` (empty `attendees_preview`, `has_user_rsvpd: false`; same object if nothing to change).

**Usage:** unchanged for callers: `<EventCard event={…} schedule={…} onRsvpToggle={…} />`; server pages pass `eventsForVisitor(events, isSignedIn)`.

---

## 10. Logo (2026-11-20)

### 10.1 `Logo`, `LogoMark`, tab icons

**Files:** `src/components/ui/Logo.tsx` (new), `src/app/icon.svg` + `src/app/favicon.ico` (replace Next's default favicon), `Navbar.tsx` (`NavbarBrand`), `Footer.tsx` (`FooterBrand`), `auth/LoginLayout.tsx` (back link).
**Source:** the designer's exports `Primary logo, light-html.zip` and `Primary logo, dark-html.zip` (Mouad's Downloads, 2026-11-20): an 880×560 SVG artboard; the zips' `support.js` / React files are only the design tool's viewer and were not used.
**Status:** ✅ Live.

#### Business & Product Purpose
The site now carries the real Campus Hub brand instead of the "CH" placeholder square, in the navbar, footer, login page and browser tab.

#### Core Concepts & Engineering Decisions
- **Inline SVG component, one file for both themes.** The light and dark exports differ only in colors, so each shape gets Tailwind `fill-`/`stroke-` classes with `dark:` variants (site dark mode = the system setting): "campus" `slate-900`/`slate-50`, "hub" `violet-600`/`violet-400`, cap `violet-600`, tassel `amber-500`, the cap's cut line the page color (`slate-50`/`slate-950`). Colors = the design's hex values (`#0f172a`, `#7c3aed`, `#a78bfa`, `#f59e0b`, `#f8fafc`, `#020617`).
- **Lettering converted to shapes.** The design writes "campus"/"hub" with the Fredoka Bold web font. They were turned into SVG paths with the real font (google/fonts `ofl/fredoka`, SIL OFL: outlines allowed), shaped with HarfBuzz (kerning) at weight 700, the design's sizes (132 / 148), positions and `letter-spacing: -2`. No font download, no flash of a fallback font, identical in every browser.
- **Cropped viewBox:** `184 139 498 268` = the drawing's measured bounds + 8 px, in the artboard's own coordinates (the design's outer `translate(16 0)` is baked in). Height is set with a class (`h-10` default), width follows (`w-auto`).
- **Accessible name:** `role="img"` + `aria-label="Campus Hub"`, or `decorative` → `aria-hidden` when a parent already names it (navbar link "Campus Hub home"; login link with sr-only "Back to Campus Hub"). The footer logo is the named one.
- **Hub square removed from the full logo** (Mouad, 2026-11-20: "too much detail" next to "hub"). The viewBox didn't change: "campus" sets the right edge and "hub" the bottom.
- **`LogoMark`** = the design's hub square alone (no longer in `Logo`): the navbar under 360 px (where "CH" used to be) and the tab icons. `app/icon.svg` (modern browsers) and `app/favicon.ico` (16/32/48 px, for browsers that ask for `/favicon.ico`: a 404 there could show in the console, which the subject forbids). Next.js adds both `<link rel="icon">` tags from the file names.
- The navbar's "1337 · EMINES" subtitle is gone: the logo names the product, the footer names the campuses.

#### Architectural Tradeoffs
| Chosen | Alternative | Why |
| --- | --- | --- |
| Inline SVG component | `<Image src="/logo-light.svg">` + a dark copy | Two files and a theme switch (or two images, one hidden); an `<img>` SVG can't use our Tailwind colors |
| Text as paths | `<text>` + `next/font` Fredoka | A 2nd web font (~20 kB) for 9 letters; text in SVG can render differently per browser |
| Same | Keep the HTML export | It loads React + a 55 kB runtime from the zip just to draw one SVG |

#### Component Contract
```ts
Logo:     React.SVGAttributes<SVGSVGElement> & { decorative?: boolean }   // forwardRef<SVGSVGElement>; default class h-10 w-auto
LogoMark: same props                                                       // default class h-9 w-9
```

#### Usage Example
```tsx
<Logo className="h-12" />                                  // named "Campus Hub"
<Link href="/" aria-label="Campus Hub home"><Logo decorative /></Link>
```

#### Changing the logo later
Colors: edit the classes in `Logo.tsx`. New artwork: export the SVG again; if the lettering changes, re-run the conversion (fontTools `instancer` at `wght=700` + `uharfbuzz` shaping + `SVGPathPen`, then measure bounds for the viewBox) and replace the two `d` attributes. Update `icon.svg` and `favicon.ico` if the hub square changes.

#### Verified (2026-11-20)
Rendered previews of the converted logo (light and dark) match the design; re-checked without the hub square. `/` shows 2 full logos (navbar, footer) + 1 `LogoMark` (navbar < 360 px); `/auth/login` back link "Back to Campus Hub"; `/icon.svg` 200 `image/svg+xml`, `/favicon.ico` 200 `image/x-icon`, both `<link rel="icon">` in the page head. `tsc` passes; ESLint no new findings; no server errors (after `docker compose restart frontend`, §1.5b).


---

## 11. Email sign-up & login (mandatory, subject v21.2)

The subject requires sign-up and login with email + password (passwords hashed and salted). Until now the student site was 42-only. Backend: `POST /api/auth/login/` (Ayoub, `Ayoub-backend`, accounts app: `{email, password}` → `{token, user}` or 401) and `POST /api/signup/` (Ahmed / Ayoub: first/last name, email, password ≥ 8, year of study, department, optional club → 201 `{token, member}`). Django hashes the passwords; the frontend never stores one.

| Step | What | Status |
|---|---|---|
| 11.1 | Email + password form on `/auth/login`, under the 42 button | ✅ live (11.3) |
| 11.2 | `/auth/register` sign-up page, then automatic login | ✅ live (11.3) |
| 11.3 | Put both on the real routes (`/auth/login` form, `/auth/register` page), "Create an account" link, `?registered=1` notice | ✅ live |

### 11.1 `EmailLoginForm`, the `email` Auth.js provider, `signInWithEmail` (Step 11.1, 2026-11-21)

**Files:** `src/components/auth/EmailLoginForm.tsx` (form), `src/components/auth/LoginPanel.tsx` (`LoginDivider` "or with email", footer text now "First time with 42?"), `src/app/auth/login/actions.ts` (server action `signInWithEmail`), `src/auth.ts` (Credentials provider `email`, `loginWithBackend`, `BackendUnavailable`, `DEV_EMAIL_PASSWORD`), `src/lib/login.ts` (`validateEmailLogin`, `EmailLoginState`, messages). Test: `src/app/test/page.tsx`.
**Status:** ✅ Live on `/auth/login` (validated 2026-11-21, integrated in 11.3).

**Business purpose.** Students without a 42 account (EMINES) need a way in, and the subject makes email + password login mandatory. The 42 button stays first: it's the one-click path for 1337 students.

**Core concepts & decisions.**
- **Flow:** form → server action `signInWithEmail` (validates again) → Auth.js `signIn('email')` → provider `authorize()` → Django `POST /api/auth/login/` → `{token, user}` → the same JWT cookie as 42 (`backendToken` stays server-side, §7.5) → redirect to `?next=`. Same session shape as 42, so the rest of the app needs no change. `login` is `null` for email accounts (Django's username is a random `user_…`).
- **Two error kinds**, decided in `authorize()`: `null` → Auth.js `CredentialsSignin` → "Wrong email or password" (one message for both fields, so the form doesn't reveal which emails have accounts); Django unreachable / 5xx / bad JSON → `BackendUnavailable` (a `CredentialsSignin` with `code = 'backend_unavailable'`) → "Login is temporarily unavailable". With `signIn()` from a server action, Auth.js throws these errors to the caller (raw mode), so the action catches them and returns state instead of redirecting to `?error=`.
- **`useActionState`** (React 19): the action's return value is the form state (`error`, `fieldErrors`, `email`), `isPending` drives the button spinner ("Logging in…"). React resets the form after an action: `defaultValue={state.email}` keeps the email, the password is cleared (never sent back).
- **Validation twice, same rules** (`validateEmailLogin` in `lib/login.ts`): in the browser on submit (`noValidate` + our messages under the fields via `Input`'s `error` → `aria-invalid` + `aria-describedby`; focus moves to the first wrong field; nothing is posted), and again in the action and in `authorize()` (the browser check can be skipped, and the Auth.js endpoint can be posted to directly). Typing in a field clears its message.
- **Accessibility:** `<form aria-label="Log in with email">`, labelled inputs (`useId` in `Input`), error box `role="alert"`, `autocomplete="email"` / `"current-password"` so password managers work; the "or with email" divider is `aria-hidden` (two labelled forms already say it).
- **Dev fallback** (no `BACKEND_URL`, never in production, like the 42 `syncWithBackend` fallback): one account, `student@1337.ma` / `campushub-dev` (`DEV_EMAIL_PASSWORD`), signs in as the mock student; since 11.2 also any account made on the sign-up form (`lib/devAccounts.ts`). In production without `BACKEND_URL` the form answers "temporarily unavailable".

**Tradeoffs.**
- *Server action + `useActionState` vs. client `fetch` to `/api/auth/callback/email`:* the action keeps CSRF, cookies and redirects inside Auth.js, works without JavaScript (plain form post), and needs no client state machine.
- *Custom messages (`noValidate`) vs. browser bubbles:* bubbles look different per browser, vanish, and aren't styled like the rest; ours sit under the field and are announced.
- *One "wrong email or password" message vs. "no account with this email":* the second helps a little and leaks who has an account. Django already answers the same 401 for both.
- *Validate in the browser only vs. also on the server:* the server check is a few lines and is the one that counts.

**Contract.**
```ts
// EmailLoginForm (client)
interface EmailLoginFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'action'> {
  action: (previous: EmailLoginState, formData: FormData) => Promise<EmailLoginState>; // signInWithEmail, or a mock
  next: string; // cleaned with safeNextPath()
}
interface EmailLoginState { error: 'invalid' | 'unavailable' | null; fieldErrors: { email?: string; password?: string }; email: string }
// LoginDivider: { className?: string }
```

**Usage (integration step):**
```tsx
<LoginPanel action={signInWith42} next={next} error={getLoginErrorKind(params.error)}>
  <LoginDivider />
  <EmailLoginForm action={signInWithEmail} next={next} />
  {DEV_LOGIN_ENABLED && <DevLoginForm action={signInWithDevLogin} next={next} />}
</LoginPanel>
```

**Verified (2026-11-21):** `/test` 200 with the form; Auth.js `POST /api/auth/callback/email` with the wrong password → `/auth/login?error=CredentialsSignin&code=credentials`, with `campushub-dev` → redirect to `/test` and `/api/auth/session` shows the student (role STUDENT, login null); `tsc` passes; ESLint no new findings. Django's `Role` values (`STUDENT`, `BOARD_MEMBER`, `SUPERADMIN`) match `UserRole`.

### 11.2 `RegisterForm`, `RegisterPanel`, `registerWithEmail` (Step 11.2, 2026-11-21)

**Files:** `src/components/auth/RegisterForm.tsx` (form), `src/components/auth/RegisterPanel.tsx` (heading, 42 hint, "Already have an account? Log in", Terms/Privacy line), `src/app/auth/register/actions.ts` (server action `registerWithEmail` + `createAccount`), `src/lib/register.ts` (values, `validateRegistration`, `fromDjangoErrors`, messages), `src/lib/devAccounts.ts` (dev-only account store), `src/auth.ts` (email dev fallback now reads `devAccounts`). Test: `src/app/test/page.tsx` (both forms side by side). Backend needs: TEAM_NEEDS §1b.3.
**Status:** ✅ Live on `/auth/register` (validated 2026-11-21, integrated in 11.3).

**Business purpose.** Students without 42 (EMINES) create an account with email + password; the subject requires it. 1337 students are told the 42 button creates their account, so they don't make a second one.

**Core concepts & decisions.**
- **Flow:** form → `registerWithEmail` (validates again) → `createAccount` → Django `POST /api/signup/` (Django hashes the password) → 201 → `signIn('email')` with the same email and password → same session as the login form → redirect to `?next=`. If the account was created but that login fails, the student is sent to `/auth/login?…&registered=1` rather than shown a sign-up error for an account that exists.
- **Fields = Django's** (`first_name`, `last_name`, `email`, `password`, `year_of_study` 1–7, `department_id`, optional `club_id`) plus our `password_confirm`, which is never sent. Same limits as `SignupSerializer` (names ≤ 150, password ≥ 8; we cap at 128).
- **Errors:** field messages under fields; `fromDjangoErrors` maps DRF's `{field: ["msg"]}` 400 bodies onto our fields; an email message containing "already exists" becomes the `email-taken` box with a **"Log in instead"** link; other refusals → "We couldn't create your account"; network / 5xx → "Sign-up is temporarily unavailable".
- **Values kept after a failure** (`defaultValue` from `state.values`, React resets the form to them), **passwords never sent back**: `toPublicValues` lists the safe fields one by one, so a future secret field can't be copied by accident.
- **Club follows School:** the club `<select>` lists only the chosen school's clubs, is disabled until a school is picked, and resets when the school changes (`key={departmentId}` remounts it with its default). A disabled select isn't posted: the action reads `''` = no club.
- **Accessibility:** same as 11.1 (labels via `useId`, `aria-invalid` + described-by messages, focus on the first wrong field in form order, `role="alert"` box), `autocomplete` `given-name` / `family-name` / `email` / `new-password` (password managers offer a strong password).
- **Dev fallback** (`lib/devAccounts.ts`, no `BACKEND_URL`, never in production): sign-ups are kept in memory on `globalThis` (survive hot reload, lost on container restart) and the email login reads them, so sign up → logged in → log out → log in again works locally. The mock student `student@1337.ma` is in it from the start ("email taken" case). Test values only: stored in plain text.

**Tradeoffs.**
- *Sign up then call the login (2 requests) vs. use the token `/api/signup/` returns:* signup returns a `member`, not the `user` shape the session needs; reusing the login path means one way to build a session, and login works the same whatever branch's signup is merged.
- *One page vs. a multi-step wizard:* 8 fields fit one screen; steps would hide errors from earlier steps and need state between them.
- *Departments/clubs as props vs. fetched in the form:* the server page already has them (Phase 7: `GET /api/departments/`, `/api/clubs/`), the form stays a plain client component with no loading state.

**Contract.**
```ts
interface RegisterFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'action'> {
  action: (previous: RegisterState, formData: FormData) => Promise<RegisterState>; // registerWithEmail, or a test wrapper
  next: string;                                                                   // cleaned with safeNextPath()
  departments: { id: string; name: string }[];
  clubs: { id: string; name: string; department_id: string }[];
}
interface RegisterState { error: 'email-taken' | 'rejected' | 'unavailable' | null; fieldErrors: RegisterFieldErrors; values: RegisterPublicValues }
interface RegisterPanelProps extends HTMLAttributes<HTMLDivElement> { next: string; children: ReactNode }
```

**Usage (11.3, `/auth/register/page.tsx`):**
```tsx
<LoginLayout>
  <RegisterPanel next={next}>
    <RegisterForm action={registerWithEmail} next={next} departments={departments} clubs={clubs} />
  </RegisterPanel>
</LoginLayout>
```

**Verified (2026-11-21):** `/test` 200 with both forms (needed `docker compose restart frontend` for the new `app/auth/register` folder, §1.5b); year labels 1st…7th; `tsc` passes; ESLint no new findings.

### 11.3 Real routes: email form on `/auth/login`, `/auth/register` page (Step 11.3, 2026-11-21)

**Files:** `src/app/auth/login/page.tsx` (divider + `EmailLoginForm` + "No account and no 42? Create an account" + `?registered=1` notice), `src/app/auth/register/page.tsx` (new), `src/components/auth/LoginPanel.tsx` (`notice` prop), `src/lib/login.ts` (`registerHref`), `src/types/navigation.ts` (`'/auth/register'` back in `AppRoute`). `/test` reset to "nothing under test".
**Status:** ✅ Live (2026-11-21).

**Business purpose.** Both forms validated on `/test` (11.1 + 11.2) now live where students look for them. The login page stays 42-first; email is the second option; sign-up is one link away and keeps `?next=` both ways, so a student who clicked "Log in to RSVP" on an event comes back to that event whichever path they take.

**Core concepts & decisions.**
- **`/auth/register`** = `LoginLayout` + `RegisterPanel` + `RegisterForm`, full screen (`FULL_SCREEN_ROUTES` already covers `/auth`), `robots: noindex`. Signed-in visitors are redirected to `next` (no second account). Departments and clubs come from the mocks, trimmed to what the form needs (Phase 7: `GET /api/departments/`, `/api/clubs/`).
- **`?registered=1`**: if the account was created but the automatic login failed, the register action sends the student to `/auth/login?next=…&registered=1`; `LoginPanel`'s new `notice` prop shows "Your account was created. Log in with your email and password." in a green `role="status"` box (polite: good news, not an error).
- **Link wording** "No account and no 42? Create an account": 1337 students shouldn't create an email account next to their 42 one (two accounts, split RSVPs). The register page repeats it ("With 42, just continue with 42 Intra").
- **Mobile tab bar:** "Log in" stays highlighted on `/auth/register` (alias `/auth`, §2).

**Tradeoffs.** *Sign-up as a tab on `/auth/login` vs. its own route:* a route has its own URL to share and link (`registerHref(next)`), its own title, and the browser Back button works as expected.

**Contract.** `LoginPanelProps.notice?: ReactNode` (green status box above the error/42 button). `registerHref(next: string): '/auth/register?next=…'` (cleans `next` like `loginHref`).

**Usage:** `<Link href={registerHref(next)}>Create an account</Link>`; `<LoginPanel … notice={registered ? '…' : null}>`.

**Verified (2026-11-21):** `/auth/login?next=/calendar` 200 with the email form and a link to `/auth/register?next=%2Fcalendar`; `/auth/register?next=/calendar` 200 with the form and a link back to `/auth/login?next=%2Fcalendar`; `/auth/login?registered=1` shows the notice; `/test` back to "nothing under test"; `tsc` passes; ESLint no new findings; no server errors.

---

## 12. Languages: English, French, Arabic (RTL) (Phase 7, 2026-11-21)

Two accessibility modules of the subject: **≥ 3 languages with a switcher** (all user-facing text translated) and **RTL** (complete mirroring for Arabic, switching LTR ↔ RTL without breaking anything): 1 point each. English is the reference; French and Arabic are full translations. Event titles, club names and descriptions are **data** (written by clubs in the dashboard) and are shown as written; everything the site itself says is translated.

| Step | What | Status |
|---|---|---|
| 12.1 | Setup: next-intl, language from a cookie, `<html lang dir>`, Arabic font, `LanguageSwitcher` | ✅ validated 2026-11-21 (switcher placed in 12.2) |
| 12.2 | Shell: navbar (switcher in it), mobile tab bar + drawer, footer, search palette, notifications, toasts, modal close; RTL fixes found there (drawer side and slide, `Input`/`Select`/`Toast`/`Avatar` physical classes) | ✅ validated 2026-11-22 |
| 12.3 | Feed, event cards, event page, RSVP, attendees; event dates in the active language (Moroccan Arabic month names) | ✅ validated 2026-11-22 |
| 12.4 | Calendar (weekday names, month and week titles, agenda, times); server-made names so the browser re-renders the same text | ✅ validated 2026-11-22 |
| 12.5 | Clubs directory and club pages; "since" month in the active language | ✅ validated 2026-11-22 |
| 12.6 | Login, sign-up (validation and error messages as keys), logout, the rest of `/profile` (stats, tabs, date tiles) | ✅ validated 2026-11-22 |
| 12.7 | Privacy / Terms, error, loading and 404 pages, page titles (`metadata`), drop the `locale = 'en'` defaults once every caller passes a locale (all formatters take one since 12.6) | ⏳ |
| 12.8 | RTL audit (every `left/right/ml/mr/pl/pr` class, icons that point somewhere), check that no English string is left | ⏳ |

### 12.1 i18n setup and `LanguageSwitcher` (Step 12.1, 2026-11-21)

**Files:** `src/i18n/config.ts` (locales, `LOCALE_INFO`, `matchLocale`), `src/i18n/request.ts` (next-intl request config), `src/i18n/actions.ts` (Server Action `setLocale`), `src/i18n/global.d.ts` (typed keys), `src/i18n/messages/{en,fr,ar}.ts`, `src/components/ui/LanguageSwitcher.tsx`, `src/components/ui/layout/navIcons.tsx` (`GlobeIcon`), `next.config.ts` (plugin), `src/app/layout.tsx` (`lang`, `dir`, provider, Arabic font), `src/app/globals.css` (`html:lang(ar)` font), `package.json` (`next-intl` **4.14.9**, pinned). Test: `src/app/test/page.tsx`.
**Status:** ✅ Validated on `/test` (2026-11-21). The layout part (`lang`, `dir`, font) is live on every page; the switcher went into the navbar in 12.2.

**Business purpose.** Campus Hub serves 1337 (Benguerir) and EMINES (UM6P): students read French and Arabic as much as English. A student picks a language once (navbar, Step 12.2) and the whole site follows, on every page and every visit; in Arabic the layout mirrors, as Arabic readers expect.

**How it works, step by step (read this first).**

1. **The student opens any page.** Before rendering, next-intl calls `src/i18n/request.ts` (registered in `next.config.ts` by the plugin). It decides the language:
   - the `NEXT_LOCALE` cookie if it holds `en`, `fr` or `ar`;
   - otherwise the browser's `Accept-Language` header (`matchLocale` in `config.ts`);
   - otherwise English.
   It then loads **only that language's file** (`messages/fr.ts` for French) and sets the time zone to campus time.
2. **The root layout** (`src/app/layout.tsx`) asks `getLocale()` and writes `<html lang="fr" dir="ltr">` (Arabic: `lang="ar" dir="rtl"`). `dir="rtl"` alone mirrors the whole page, because our classes are logical (`ms-`, `ps-`, `text-start`…, see 12.8).
3. **Pages and components ask for text by key** instead of writing English:
   - Server Component: `const t = await getTranslations('Events'); t('count', { count: 3 })`;
   - Client Component: `const t = useTranslations('Events')` (works because the layout wraps the app in `<NextIntlClientProvider>`, which passes the same language and messages to the browser).
   `t` looks the key up in the loaded file: `"3 events"`, `"3 événements"` or `"3 فعاليات"`.
4. **The student changes language** in `LanguageSwitcher`. It calls the Server Action `setLocale('ar')` (`src/i18n/actions.ts`), which only writes the cookie. Next.js re-renders the current page on the server (step 1 now finds `ar` in the cookie) and sends it back in the same request: the text changes and `dir` becomes `rtl`, no reload.
5. **Next visits:** the cookie (1 year) is sent with every request, so step 1 picks the same language on every page.

**Where things live.**

| File | Role |
|---|---|
| `src/i18n/config.ts` | The list of languages (`LOCALES`), their names and direction (`LOCALE_INFO`), the browser-language matcher. No Next.js code: usable everywhere. |
| `src/i18n/request.ts` | Runs on each request: picks the language, loads its messages, sets the time zone. |
| `src/i18n/actions.ts` | `setLocale`: saves the choice in the cookie. |
| `src/i18n/messages/en.ts` | **All English texts**, grouped by namespace (`Events`, `LanguageSwitcher`, later `Navbar`, `Calendar`…). The reference. |
| `src/i18n/messages/fr.ts`, `ar.ts` | Same keys, translated. `satisfies Messages` = the build fails if a key is missing or extra. |
| `src/i18n/global.d.ts` | Tells TypeScript the keys, so a typo in `t('…')` is a compile error. |
| `src/components/ui/LanguageSwitcher.tsx` | The globe button + menu. |

**Adding or translating a text (the routine for Steps 12.2–12.7).**
1. In the component, replace `'Search events…'` with `t('search')` (`useTranslations('Navbar')` / `getTranslations('Navbar')`).
2. Add `Navbar: { search: 'Search events…' }` to `en.ts`.
3. `make typecheck` now fails: `fr.ts` and `ar.ts` are missing `Navbar.search`. Add `'Rechercher des événements…'` and `'ابحث عن الفعاليات…'`. It passes.
4. Values inside a text: `'Hello {name}'` → `t('hello', { name })`. Counts: `{count, plural, …}` (Arabic needs `zero one two few many other`).

**Core concepts & decisions.**
- **No locale in the URL.** The language is the `NEXT_LOCALE` cookie (httpOnly, 1 year, `SameSite=Lax`), or on a first visit the browser's `Accept-Language` (`matchLocale`: by `q` weight, only the language part, `fr-CA` → `fr`, nothing usable → `en`). An invalid cookie value is ignored. URLs stay `/events/…` in every language, so links shared between students work whatever their language.
- **next-intl in "without i18n routing" mode.** `src/i18n/request.ts` (`getRequestConfig`) gives each request its locale, its messages (lazy `import()`, only one language loaded) and the time zone **`Africa/Casablanca`** (same on server and browser: dates never differ at hydration). Server Components use `getTranslations` / `getFormatter`; Client Components `useTranslations` / `useFormatter`, fed by `<NextIntlClientProvider>` in the root layout (it inherits locale, messages and time zone from the server).
- **`<html lang={locale} dir={LOCALE_INFO[locale].dir}>`.** `dir="rtl"` mirrors everything written with logical classes (`ms-`, `ps-`, `start-`, `end-`, `text-start`, `border-s-4`), which the codebase has used since Phase 2 for this reason; `rtl:-scale-x-100` flips arrows. `lang` selects the font, the screen reader's voice and hyphenation.
- **Messages as TypeScript, not JSON.** `en.ts` is the reference and defines `type Messages`; `fr.ts` and `ar.ts` end with `satisfies Messages`, so a **missing or extra key fails `tsc`**. `global.d.ts` registers `Messages` and `Locale` with next-intl (`AppConfig`): `t('Events.cuont')` doesn't compile. This is how we prove "every string has 3 translations" at the evaluation.
- **ICU messages.** `{count, plural, =0 {…} one {…} other {…}}`. Arabic has **six** plural forms (zero/one/two/few 3–10/many 11–99/other) and each has its own wording (`فعالية واحدة`, `فعاليتان`, `3 فعاليات`, `11 فعالية`). Replaces hand-written helpers like `formatEventCount` (English-only) in later steps.
- **Arabic font: Noto Sans Arabic** via `next/font` (self-hosted at build, no request to Google from the browser), `preload: false` and only applied by `html:lang(ar)` in `globals.css`: English and French pages never download it. Latin words and digits inside Arabic text fall back to the system font.
- **`setLocale` Server Action.** Validates the value with `isLocale`, sets the cookie. Called from a Server Action, Next.js returns the re-rendered page in the same round trip: the new language and direction appear **without a reload and without losing scroll or open state** in the shell.
- **`LanguageSwitcher` = WAI-ARIA menu button.** `<button aria-haspopup="menu" aria-expanded aria-controls>` + `role="menu"` of `menuitemradio` (`aria-checked` on the current one). Each name is written in its own language ("Français", "العربية") with `lang` on the item so a screen reader pronounces it correctly. Keys: Enter/Space/↓ open on the current language, ↑ on the last; ↑ ↓ Home End move (roving `tabIndex=-1` items); Esc closes and returns focus to the button; Tab closes and moves on; a click outside closes. While the new page loads the globe spins (`aria-busy`, `motion-reduce` respected). The menu is anchored with `end-0`, so it opens toward the inside of the screen in both directions.

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| next-intl | Our own dictionary + `Intl.PluralRules` | Works in Server **and** Client Components with one API, ICU plurals/selects, date and number formatting tied to the locale and time zone, typed keys. A home-made layer would re-implement all of that and still need plural parsing for Arabic. |
| Cookie, no `/fr/…` URLs | `[locale]` route segment + middleware | A route segment means moving every page under `app/[locale]/`, a middleware next to Auth.js, and rewriting every link and redirect (`loginHref`, `safeNextPath`). SEO per language is not a need for a campus site. The cookie keeps every URL and every test we already have. |
| Messages in `.ts` with `satisfies` | JSON files | Same content, but the compiler checks that all three languages have exactly the same keys. JSON would need a separate script. |
| Menu button | Native `<select>` | A `<select>` would be simpler, but it can't show the check mark or the per-item `lang`, looks different on every OS, and doesn't fit the navbar's icon buttons. The menu-button pattern is fully specified by WAI-ARIA, so it stays accessible. |
| Pin 4.14.9 | Latest 4.15.3 | 4.15.x was released this week (Nov 11–19); 4.14.9 (Oct 2) has had time to be checked. Same API. |

**Contract.**
```ts
// src/i18n/config.ts
export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = 'en' | 'fr' | 'ar';
export const LOCALE_INFO: Record<Locale, { name: string; short: string; dir: 'ltr' | 'rtl' }>;
export const isLocale: (value: unknown) => value is Locale;
export const matchLocale: (acceptLanguage: string | null | undefined) => Locale;
// src/i18n/actions.ts ('use server')
export async function setLocale(locale: string): Promise<void>;
// src/components/ui/LanguageSwitcher.tsx
interface LanguageSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'compact' | 'full'; // default 'compact': globe + "EN"; 'full': globe + "English"
}
```

**Usage.**
```tsx
// Server Component
const t = await getTranslations('Events');
<p>{t('count', { count: 3 })}</p>           // "3 events" / "3 événements" / "3 فعاليات"
// Client Component
const t = useTranslations('Events');
// Anywhere in the shell
<LanguageSwitcher />                        // or variant="full"
// New text: add the key to en.ts, then fr.ts and ar.ts (tsc fails until both have it)
```

**Verified (2026-11-21, server HTML with curl).** No cookie → `<html lang="en" dir="ltr">`; `NEXT_LOCALE=fr` → `lang="fr"`, "Aucun événement / 1 événement / 2 événements", "vendredi 13 novembre 2026 à 17:00"; `NEXT_LOCALE=ar` → `lang="ar" dir="rtl"`, the six Arabic forms, "الجمعة، 13 نوفمبر 2026 في 5:00 م"; `NEXT_LOCALE=xx` → English; no cookie + `Accept-Language: fr-FR,…` → French. `tsc` passes; ESLint: the same 6 old findings, none new. In the browser (to check on `/test`): switching without reload, keyboard, screen reader, mirroring.

**Gotcha.** `next.config.ts` changed (next-intl plugin): run `docker compose restart frontend` after pulling, or the dev server keeps the old config. New dependency: `make up` / `make dev` rebuild the image with it (`npm install` in the Dockerfile). `make dev` now passes `--renew-anon-volumes`: `node_modules` is an anonymous volume (`docker-compose.dev.yml`) and without the flag Docker keeps the old one after a rebuild → "Module not found: next-intl". In a running container, `docker compose exec frontend npm install` does the same.

### 12.2 The shell in three languages, switcher in the navbar (Step 12.2, 2026-11-21)

**Files:** `src/i18n/messages/{en,fr,ar}.ts` (namespaces `Nav`, `Navbar`, `MobileNav`, `Footer`, `Notifications`, `Search`, `Categories`, `Common`), `src/types/navigation.ts` (`NavLabelKey`, `labelKey` / `titleKey`), `src/lib/navigation.ts`, `src/components/ui/layout/{Navbar,MobileNav,Footer,NotificationPopover,AppShell}.tsx`, `src/components/search/SearchPalette.tsx`, `src/components/ui/{Modal,Toast,Input,Select,Avatar,LanguageSwitcher}.tsx`, `src/lib/time.ts` (locale parameter), `src/app/globals.css` (`drawer-in-rtl`). Test: `src/app/test/page.tsx` + `ToastDemo.tsx`.
**Status:** ✅ Validated on `/test` (2026-11-22). Live in the shell, so it is on every page and there is nothing to move later.

**Business purpose.** The parts a student sees on every page now follow the chosen language, and the switcher is where people look for it: the navbar (from 640 px) and the phone menu.

**Core concepts & decisions.**
- **Config keeps keys, not words.** `NavItem.label: string` became `labelKey: NavLabelKey` (`keyof Messages['Nav']`), same for footer group titles and `LEGAL_LINKS`. `lib/navigation.ts` stays plain data (server-safe, no hook); each component translates with `useTranslations('Nav')(item.labelKey)`. A wrong key doesn't compile. External footer links keep a plain `label`: institution names (1337 Coding School, EMINES, UM6P) are the same in every language.
- **`useTranslations` in Server Components too.** `Footer`, `FooterBrand`, `FooterLegal` have no `'use client'` and still call `useTranslations` (next-intl supports it in non-async Server Components). The same components also render inside the client drawer: one code path for both.
- **Data vs. UI text.** Notification titles/bodies, event titles, club and department names are data and stay as written. Only the frame is translated: "New notification: {title}", "Club · {department}". Categories are a fixed list of ours, so they get their own `Categories` namespace (`t(event.category)`); the search palette uses it now, the feed in 12.3.
- **Plurals and counts through ICU:** bell label (`=0` → just "Notifications"), "N unread", "N results", "N new notifications": each with the six Arabic forms.
- **Dates:** `formatRelativeTime(iso, now, locale)` / `formatAbsoluteTime(iso, locale)` take the language (`useLocale()`), with one cached `Intl` formatter per language. "just now" was an English string: it is now `Intl`'s own word for 0 s ("now", "maintenant", "الآن").
- **Switcher placement.** `NavbarActions` shows `<LanguageSwitcher className="hidden sm:block" />` next to search. Below 640 px the bar is already full (burger, logo, search, bell, avatar), so the phone drawer gets `<LanguageSwitcher variant="full" />` under the account block.
- **RTL fixes in the shell and primitives** (physical → logical): skip link `left-4` → `start-4`; `NavbarActions`/kbd `ml-auto` → `ms-auto`; burger `-ml-2` → `-ms-2`; drawer `left-0 border-r` → `start-0 border-e`, close `-mr-2` → `-me-2`; bell badge `-right-0.5` → `-end-0.5`; notification panel `sm:right-0` → `sm:end-0`; toast viewport `right-4` → `end-4`, text `text-left` → `text-start`, close `-mr-1` → `-me-1`; `Input`/`Select` `text-left`, `left-0 pl-3`, `pl-10`/`pr-10`, `right-0 pr-3` → `text-start`, `start-0 ps-3`, `ps-10`/`pe-10`, `end-0 pe-3`; `Avatar` status dot `right-0` → `end-0`. `Input`'s props keep their names `leftIcon`/`rightIcon` (renaming would touch every form) but now mean the start/end side.
- **Drawer animation in Arabic.** `translateX` doesn't follow `dir`, so `drawer-in` (from -100%) would slide a right-side drawer in from the wrong edge. A second keyframe `drawer-in-rtl` (from +100%) is applied with `rtl:animate-drawer-in-rtl`; `rtl:motion-reduce:animate-none` keeps reduced motion working (the `rtl:` rule comes later in the CSS than plain `motion-reduce:`).

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| `labelKey` in the nav config | Translated labels built in a hook (`useNavItems()`) | The config stays plain data shared by server and client, and the active-route logic (`isNavItemActive`) doesn't change. A hook would force every reader to be a client component. |
| Switcher in navbar (sm+) and drawer (phones) | Footer only | The footer is at the bottom of long pages; a student who lands on an Arabic page by mistake needs the switch at the top. |
| Second keyframe for RTL | One keyframe using `translate: calc(-100% * var(--dir))` | Two plain keyframes are easier to read and need no custom property set per direction. |
| Keep `leftIcon`/`rightIcon` prop names | Rename to `startIcon`/`endIcon` | Same behaviour, no churn in every form; the comment in DOCS covers the meaning. Could be renamed in a later cleanup. |

**Contract.**
```ts
// src/types/navigation.ts
export type NavLabelKey = keyof Messages['Nav']; // 'discover' | 'calendar' | 'clubs' | 'profile' | 'login' | 'explore' | 'campuses' | 'privacy' | 'terms'
interface NavItem { labelKey: NavLabelKey; href: AppRoute; icon: NavIconName; match: NavMatchStrategy; aliases?: readonly string[] }
type FooterLink = { kind: 'internal'; labelKey: NavLabelKey; href: AppRoute } | { kind: 'external'; label: string; href: `https://${string}` };
interface FooterLinkGroup { id: 'explore' | 'campuses'; titleKey: NavLabelKey; links: readonly FooterLink[] }
// src/lib/time.ts
formatRelativeTime(iso: string, now: number, locale = 'en'): string;
formatAbsoluteTime(iso: string, locale = 'en'): string;
```

**Usage.**
```tsx
const t = useTranslations('Nav');
{PUBLIC_NAV.map((item) => <Link key={item.href} href={item.href}>{t(item.labelKey)}</Link>)}

const locale = useLocale();
<time title={formatAbsoluteTime(iso, locale)}>{formatRelativeTime(iso, now, locale)}</time>
```

**Verified (2026-11-21, server HTML with curl on `/clubs`).** `NEXT_LOCALE=fr`: "Aller au contenu", links Découvrir / Calendrier / Clubs, "Ouvrir le menu", "Rechercher des événements et des clubs", switcher "Langue : Français", footer Explorer / Campus, the French tagline and "© 2026 Campus Hub. Fait par des étudiants, pour les étudiants.", landmarks "Principale", "Pied de page", "Mentions légales". `NEXT_LOCALE=ar`: `dir="rtl"`, اكتشف / التقويم / الأندية, "انتقل إلى المحتوى", "اللغة: العربية", Arabic footer and landmarks. English unchanged. `@keyframes drawer-in-rtl` and the `rtl:animate-drawer-in-rtl` rule are in the CSS. `tsc` passes; ESLint: the same 6 old findings (line numbers moved), none new. No server errors. In the browser (checklist on `/test`): drawer side, panel side, toasts, keyboard, screen reader.

### 12.3 Feed, event cards, event page, RSVP and attendees in three languages (Step 12.3, 2026-11-22)

**Files:** `src/i18n/messages/{en,fr,ar}.ts` (new namespaces `Feed`, `Rsvp`, `Attendees`, `EventPage`), `src/i18n/config.ts` (`LOCALE_INFO[…].intl`, `intlLocale`), `src/lib/time.ts` (`cachedFormatter`, `eventTimeFormatter`, `formatEventSchedule` / `getEventSchedules` take a locale), `src/lib/calendar.ts` (`getEventDateDetails(event, locale)`), `src/lib/events.ts` (`CAMPUS_FILTERS`, `CAMPUS_NAMES`; `formatEventCount` removed), `src/lib/search.ts` + `src/hooks/useCampusSearch.ts` (category in the active language), `src/hooks/useRsvpToast.ts`, `src/components/filters/CampusToggle.tsx`, `src/components/events/{FeedToolbar,CategoryFilter,EventFeed,EventGrid,EventCard,RsvpCard,AttendeesSection,EventDetails,EventBackLink,EventSkeletons}.tsx`, `src/app/events/[id]/not-found.tsx`, the pages that format dates (`app/(feed)/page.tsx`, `app/events/[id]/page.tsx`, `app/clubs/[slug]/page.tsx`, `components/profile/ProfileView.tsx`). Test: `src/app/test/page.tsx` (links + checklist; `ToastDemo.tsx` from 12.2 removed).
**Status:** ✅ Validated on `/test` (2026-11-22). Live (shared components, like 12.2).

**Business purpose.** The feed and the event page are where students spend their time: what's on, when, and "am I going". A French or Arabic speaker now reads all of it in their language, dates included, and the RSVP flow (buttons, counts, toast, who's going) speaks the same language as the rest of the site.

**Core concepts & decisions.**
- **Dates in the visitor's language, still on the server.** The event formatters stay server-only (campus time zone, DOCS §5.2); they now take the request's language (`getLocale()` in async pages, `useLocale()` in `ProfileView`) and the page passes the finished strings down as before. `getEventSchedules(events, locale)` gives "Fri, Nov 27" / "ven. 27 nov." / "الجمعة، 27 نونبر". The `locale` parameter defaults to `'en'`, so callers not migrated yet (calendar) keep working.
- **Moroccan Arabic month names.** `Intl` with plain `ar` writes the Middle-East names (نوفمبر); Morocco uses the French-derived ones (نونبر). `LOCALE_INFO` now carries an `intl` tag per language (`ar` → `ar-MA`) and `intlLocale()` maps to it; every formatter in `lib/time.ts` goes through it. Digits stay Latin (0–9), as in Morocco. Pages keep `lang="ar"`: the tag only affects `Intl`.
- **One cache helper.** `cachedFormatter(build)` returns `(locale) => formatter`, building each language's `Intl` object once (building is the slow part). Used for relative, absolute, event day and event time formatters, and by `lib/calendar.ts` for the long date.
- **Event page dates with `formatRange`.** French writes "vendredi 13 – dimanche 15 novembre 2026" (shared month once), Arabic puts its own commas, English "Friday, November 13 – Sunday, November 15, 2026". A hand-built "a – b, year" was English grammar only. Its spacing differs between ICU versions, which is fine because this runs on the server only (the calendar's week title, which runs in both, stays hand-built). Multi-day times are worded by `<EventDetails>` with `EventPage.startsEnds` ("Starts 8:00 AM, ends 5:00 PM" / "Début 8:00, fin 17:00"), so `getEventDateDetails` returns `start` and `end` alone too.
- **Counts through ICU plurals:** feed result count (`Events.count`), card "N going" (`Rsvp.cardCount`), RSVP card upcoming/ended counts, attendee "N people" / "N others", each with the six Arabic forms.
- **"Salma, Youssef and 40 others" with `Intl.ListFormat`.** Each language joins lists its own way (English comma before "and", French "et", Arabic "و" attached to the next word). The summary is built from the names + a translated "N others" and joined by `ListFormat`; the hand-written `join(' and ')` is gone.
- **Screen-reader suffixes per language.** Card buttons stay "visible word + sr-only event title", so six RSVP buttons are told apart: `Rsvp.srTitle` = " to {title}" / " à {title}" / ": {title}". The visible word comes first in all three languages, so the label still starts with what is on screen (WCAG "label in name").
- **Keys, not words, in tables.** `RsvpCard`'s `STATUS` table holds message keys (`'ended' | 'youreGoing'`), `EventBackLink`'s `BACK_LABELS` too: still exhaustive `Record`s, type-checked against the messages.
- **Campus names stay, "All" is translated.** `CAMPUS_FILTERS` is now `['all', '1337', 'emines']` and `CAMPUS_NAMES` holds the proper names; `CampusToggle` shows `Feed.allCampuses` for `all`. Shared with the clubs directory, which gets the translated toggle already.
- **Categories.** Badges and chips use the `Categories` messages. `CATEGORY_LABELS` (English) stays for the ⌘K search: a query matches the English name and the name in the active language ("music", "musique", "موسيقى"), so someone who types English on a French page still finds things. The calendar agenda still shows `CATEGORY_LABELS` until 12.4.
- **Data stays as written:** event titles, descriptions, places, club and department names.
- **RTL:** nothing new to fix here: these components already used logical classes and `rtl:-scale-x-100` on the back arrow (checked on `/test`).

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| Format dates on the server with the request locale | Format in the browser with next-intl's `useFormatter` | The browser's time-zone data can disagree with the server's (Morocco's offset changes by decree, DOCS §5.2) and break hydration. Same reason as before; only the language is new. |
| `ar-MA` for `Intl` only | `lang="ar-MA"` everywhere / a fourth locale | Only the month names differ, so one tag in `LOCALE_INFO` fixes them. The cookie, the messages, the switcher and `<html lang>` stay as they are. |
| `formatRange` on the server | Hand-built ranges per language | Correct range grammar in every language for free; server-only, so ICU spacing differences can't cause hydration errors. |
| `Intl.ListFormat` for the attendee sentence | One ICU message per case ("{a} and {b}", "{a}, {b} and {n} others") | Covers every list length and language with one line; the plural part stays in ICU. |
| Search matches English + translated category | Translated only | Mixed-language typing is common on campus; matching both costs nothing. |
| `locale = 'en'` default on the formatters | Required parameter | Lets the calendar (12.4) migrate in its own step without breaking now; the default disappears once every caller passes it (12.7). |

**Contract.**
```ts
// src/i18n/config.ts
LOCALE_INFO: Record<Locale, { name: string; short: string; dir: Direction; intl: string }>; // intl: 'en' | 'fr' | 'ar-MA'
intlLocale(locale: string): string; // known locale → its intl tag; anything else unchanged
// src/lib/time.ts
cachedFormatter<T>(build: (intlTag: string) => T): (locale: string) => T;
eventTimeFormatter: (locale: string) => Intl.DateTimeFormat; // campus time zone
formatEventSchedule(iso: string, locale = 'en'): EventSchedule;           // server only
getEventSchedules(events: { id: string; start_time: string }[], locale = 'en'): Record<string, EventSchedule>;
// src/lib/calendar.ts
interface EventDateDetails { date: string; time: string; start: string; end: string; isMultiDay: boolean }
getEventDateDetails(event: EventItem, locale = 'en'): EventDateDetails;   // server only
// src/lib/events.ts
CAMPUS_FILTERS: CampusFilter[];              // ['all', '1337', 'emines']
CAMPUS_NAMES: Record<Campus, string>;
// src/lib/search.ts
searchCampus(query, data, now, categoryLabel = (c) => CATEGORY_LABELS[c]): SearchResults;
```

**Usage.**
```tsx
// Async server page: dates in the visitor's language, campus time zone
const schedules = getEventSchedules(events, await getLocale());

// Client or non-async server component
const t = useTranslations('Rsvp');
<p>{t('cardCount', { count: event.rsvps_count })}</p>
<Button>{t('rsvp')}<span className="sr-only">{t('srTitle', { title: event.title })}</span></Button>
```

**Verified (2026-11-22, server HTML fetched inside the container with `NEXT_LOCALE` set).** `/`: "Upcoming events · 1 event · Fri, Nov 27 · No RSVPs yet · Log in to RSVP"; French "Événements à venir · 1 événement · Tous / Toutes · ven. 27 nov. · Aucun participant pour l’instant · Se connecter pour participer"; Arabic "الفعاليات القادمة · فعالية واحدة · الكل · الجمعة، 27 نونبر · لا أحد مسجَّل بعد · سجّل الدخول لتأكيد الحضور", landmarks and group labels translated. `/events/evt_hackathon_ai` (ended, multi-day): "vendredi 13 – dimanche 15 novembre 2026 · Début 8:00, fin 17:00 · Qui a participé · Cet événement est terminé · 120 participants"; Arabic "الجمعة، 13 – الأحد، 15 نونبر، 2026 · تبدأ 8:00، تنتهي 17:00 · حضر 120 شخصًا". `/events/evt_welcome_bbq` (one day): "Friday, November 27, 2026 · 11:00 AM – 3:00 PM"; "vendredi 27 novembre 2026 · 11:00 – 15:00". `/events/nope`: the translated not-found body is in the response. `tsc` passes; ESLint: the same 6 old findings, none new.

**Notes for later.**
- `/events/nope` answers HTTP **200**, not 404, in dev, and it did before this step too (checked on the previous commit). The route has a `loading.tsx`, so the response starts streaming before `notFound()` runs; Next then sends the not-found UI with a `noindex` tag. To check in 12.7 with a production build (`next build && next start`).
- The browser tab title (`metadata`), e.g. "Event not found | Campus Hub", is still English: 12.7.

### 12.4 The calendar in three languages (Step 12.4, 2026-11-22)

**Files:** `src/lib/calendar.ts` (`getCalendarNames`, `CalendarNames`, `WeekdayNames`, `dayParts`, `weekBounds`, `getAgendaTimeKind`, `getEventTimes(events, locale)`; removed `WEEKDAYS`, `formatMonthTitle`, `formatDayLabel`, `formatWeekTitle`, `CALENDAR_TITLES`, `formatAgendaTime`; `CALENDAR_VIEWS` is now `CalendarView[]`), `src/hooks/useCalendarFormat.ts` (new), `src/i18n/messages/{en,fr,ar}.ts` (namespace `Calendar`), `src/components/calendar/{EventCalendar,CalendarHeader,MonthGrid,WeekGrid,DayAgenda,CalendarSkeleton,dayStyles}.tsx|ts`, `src/app/calendar/page.tsx`, `src/lib/events.ts` (comment). Test: `src/app/test/page.tsx` (links + checklist).
**Status:** ✅ Validated on `/test` (2026-11-22). Live on `/calendar`.

**Business purpose.** The calendar is how students plan their week. In French or Arabic it now reads like a local calendar: month names as Moroccans write them, Monday first, times in 24-hour format in French and Arabic, and the agenda's "from / until / all day" in their language.

**Core concepts & decisions.**
- **The hydration problem.** Unlike the feed, the calendar re-renders its labels in the browser on every click (next month, another day), so the same label is made on the server (first HTML) and in the browser (after hydration and clicks). Before this step the labels used `Intl` with `'en'` on both sides, which worked because English output is stable. In other languages `Intl` output depends on the ICU version: older browsers write "نوفمبر" where Node writes "نونبر", the Arabic comma and the spacing around dashes vary. A mismatch on first render is a React hydration error.
- **The fix: `Intl` on the server only, templates in the browser.** `getCalendarNames(locale)` (server, cached per language) returns the bare names: 12 long months, 12 short months, 7 weekdays (long, short, compact), Monday first. The page passes them as a `names` prop. In the browser, `useCalendarFormat(names)` only puts them into ICU message templates (`Calendar.monthTitle`, `dayLabel`, `weekSameMonth` / `weekCrossMonth` / `weekCrossYear`). Message formatting is plain string work, so server and browser produce the same characters on any browser.
- **Word order lives in the messages.** English "Thursday, November 5" / "Nov 2 – 8, 2026"; French "jeudi 5 novembre" / "2 – 8 nov. 2026" / "30 nov. – 6 déc. 2026"; Arabic "الخميس، 5 نونبر" / "2 – 8 نونبر 2026". Three week templates (same month, across months, across years) cover every week. Numbers are passed as strings (`dayParts`), so ICU never writes "2,026".
- **Weekday headers.** `short` from 640 px. On phones `compact`: the short name, except in Arabic, where the "short" names are the full words (الأربعاء is too wide for a seventh of a phone); there it is the one-letter form (ن ث ر خ ج س ح) that Arabic calendars use. The `<abbr title>` keeps the full name.
- **Agenda times.** `getEventTimes(events, locale)` writes start/end on the server in the visitor's language ("8:00 AM" / "8:00"). `getAgendaTimeKind` decides which of `timeRange`, `from`, `until`, `allDay` applies for a day, and the hook words it ("Dès 8:00", "حتى 17:00", "Toute la journée").
- **Counts and names:** day buttons read `Calendar.dayButton` ("jeudi 5 novembre, 1 événement", plural forms), agenda count `Events.count`, "+N more" `Calendar.more`, category badges `Categories`, the "Going" badge `Rsvp.going`, prev/next labels as message keys in the `STEP_LABELS` table, view tabs `t(view)`.
- **RTL fix found here:** the cell separators used `[&:not(:first-child)]:border-l`. In Arabic the first cell is on the right, so the lines sat on the wrong side of each cell (a double line at the left edge, none between the first two days). Now `border-s` in `MonthGrid`, `WeekGrid` and `CalendarSkeleton`. Arrow icons and arrow keys already followed the direction (`rtl:-scale-x-100`, `useDayGridNavigation`).
- **This replaces 12.3's note** that the calendar's week title stays hand-built for hydration reasons: it is now built from server-made names and message templates, which solves the same problem in every language.

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| Server-made names + message templates | `Intl` (or next-intl's `useFormatter`) in the browser | Safe for every browser: no ICU version can make the server and browser disagree. Costs one small prop (≈ 40 short strings). |
| Server-made names + templates | Format every label for every day on the server | The calendar can move to any month on click; precomputing all of them is impossible. Names + templates cover any date. |
| Names passed as a prop | A React context for the names | Only four components need them, all under `EventCalendar`; a prop is explicit and keeps `MonthGrid` / `WeekGrid` / `DayAgenda` usable on their own. |
| One-letter Arabic weekdays on phones | Truncate the full names | A cut Arabic word is unreadable; the one-letter forms are the usual Arabic calendar header. Other languages keep their 3-letter names. |
| Three week templates | `Intl.DateTimeFormat.formatRange` | `formatRange` runs `Intl` in the browser (the problem above). |

**Contract.**
```ts
// src/lib/calendar.ts
interface WeekdayNames { long: string; short: string; compact: string }
interface CalendarNames { months: string[]; monthsShort: string[]; weekdays: WeekdayNames[] } // Monday first
getCalendarNames(locale = 'en'): CalendarNames;                       // server only, cached per language
getEventTimes(events: EventItem[], locale = 'en'): Record<string, EventTimes>; // server only
type AgendaTimeKind = 'timeRange' | 'from' | 'until' | 'allDay';
getAgendaTimeKind(times: EventTimes, day: DayKey): AgendaTimeKind;   // any runtime
dayParts(key: DayKey): { year: string; monthIndex: number; day: string; weekdayIndex: number };
weekBounds(key: DayKey): { start: DayKey; end: DayKey };
CALENDAR_VIEWS: CalendarView[]; // ['month', 'week']
// src/hooks/useCalendarFormat.ts
useCalendarFormat(names: CalendarNames): {
  monthTitle(key): string; weekTitle(key): string; dayLabel(key): string;
  agendaTime(times: EventTimes, day: DayKey): string; title: Record<CalendarView, (key: DayKey) => string>;
};
// New required prop `names: CalendarNames` on EventCalendar, MonthGrid, WeekGrid, DayAgenda.
```

**Usage.**
```tsx
// app/calendar/page.tsx (server)
const locale = await getLocale();
<EventCalendar events={events} eventIdsByDay={getEventIdsByDay(events)} eventTimes={getEventTimes(events, locale)}
  names={getCalendarNames(locale)} todayKey={toCampusDayKey(now)} urlState />

// any calendar component (client)
const format = useCalendarFormat(names);
<h2>{format.dayLabel(selectedKey)}</h2>
```

**Verified (2026-11-22, server HTML fetched inside the container).** `/calendar?date=2026-11-14`: "November 2026" / "novembre 2026" / "نونبر 2026", Today / Aujourd’hui / اليوم, Month·Week / Mois·Semaine / شهر·أسبوع, headers Mon / lun. / ن + الاثنين, day labels "Thursday, November 5, 1 event" / "jeudi 5 novembre, 1 événement" / "الخميس، 5 نونبر، فعالية واحدة", "Previous month" / "Mois précédent" / "الشهر السابق". Week views: "Nov 9 – 15, 2026" / "9 – 15 nov. 2026" / "9 – 15 نونبر 2026" with the hackathon's "From 8:00 AM · All day · Until 5:00 PM" / "Dès 8:00 · Toute la journée · Jusqu’à 17:00" / "من 8:00 · طوال اليوم · حتى 17:00"; across months "Nov 30 – Dec 6, 2026" / "30 nov. – 6 déc. 2026" / "30 نونبر – 6 دجنبر 2026"; across years "Dec 28, 2026 – Jan 3, 2027" / "28 déc. 2026 – 3 janv. 2027" / "28 دجنبر 2026 – 3 يناير 2027"; empty day "Nothing on this day" / "Rien ce jour-là" / "لا شيء في هذا اليوم". `tsc` passes; ESLint: the same 6 old findings, none new. In the browser (checklist on `/test`): clicking through months and weeks, no hydration warning, the Arabic grid separators.

**Notes for later.**
- French writes the first of the month "1er" in running text ("dimanche 1er novembre"); `Intl` and these templates write "1". Left as is, to match the event page (which uses `Intl` directly). An ICU `select` on `day` could add it if wanted.
- Counts with `#` in client components (here and in 12.2–12.3) are formatted with `Intl.NumberFormat('ar')`. Current browsers and Node write Latin digits (0–9) for `ar`; a very old browser could write Arabic-Indic digits (١٢) and show a hydration warning. Not seen; to keep in mind for the 12.8 audit.

### 12.4b Profile hero in Arabic: mirrored layout, translated banner (fix, 2026-11-22)

**Files:** `src/components/profile/ProfileHero.tsx`, `src/components/profile/ProfileSkeleton.tsx`, `src/components/profile/ProfileActivity.tsx`, `src/i18n/messages/{en,fr,ar}.ts` (new namespace `Profile`).
**Status:** ✅ Validated (2026-11-22). Found by Mouad while checking 12.4 in Arabic.

**The problem.** The hero (banner + avatar + name) was laid out with physical classes: `sm:pl-40 sm:pr-8` reserved room for the avatar on the left, and the avatar sat at `sm:left-[31px]`. In Arabic the text and the buttons move to the right but the avatar and the reserved space didn't, so the buttons column ran under the avatar and the name had a gap on the wrong side. The banner's text ("Your campus. Your community.") and the hero's chips and buttons were still English.

**Fix.**
- Logical classes: `sm:ps-40 sm:pe-8` and the avatar at `sm:start-[31px]` (hero and its skeleton), so avatar, padding and text swap sides together. The stats row's `sm:text-left` → `sm:text-start`.
- The banner gradient runs the other way in Arabic (`rtl:bg-gradient-to-l`), so its light end stays behind the text, as in the design.
- `@login` gets `dir="ltr"`: in a right-to-left paragraph the bidi algorithm moves a leading "@" to the end ("mnajjar@").
- Translated in the hero (the rest of `/profile` stays for 12.6): the banner tagline, role chips (`Profile.roles.STUDENT | BOARD_MEMBER | SUPERADMIN`), "Member since {date}", the "· Soon" buttons. "Campus Hub" and "1337 × EMINES" are names and stay.

**Tradeoff.** `ROLE_LABELS` (a `Record<UserRole, string>`) became a nested message object `Profile.roles`, read with ``t(`roles.${user.role}`)``. next-intl types the template literal against the messages, so a new `UserRole` without a translation still fails `tsc`, as the `Record` did.

**Verified.** `tsc` passes; ESLint: the same 6 old findings. The page needs a signed-in session, so the layout is checked in the browser: `/profile` in العربية, avatar on the right, name and chips beside it, buttons on the far left, banner text in Arabic on the left side of the banner.

### 12.5 Clubs directory and club pages in three languages (Step 12.5, 2026-11-22)

**Files:** `src/i18n/messages/{en,fr,ar}.ts` (namespace `Clubs`), `src/lib/clubs.ts` (`formatClubSince(createdAt, locale)` returns the month only; `formatUpcomingCount` and `formatClubCount` removed), `src/components/clubs/{ClubDirectory,ClubCard,ClubHeader,ClubContactCard,ClubEvents,ClubSkeletons}.tsx`, `src/app/clubs/[slug]/{page,not-found}.tsx`, `src/components/events/PastEventList.tsx` (Arabic date column). Test: `src/app/test/page.tsx` (links + checklist).
**Status:** ✅ Validated on `/test` (2026-11-22). Live on `/clubs` and `/clubs/[slug]`.

**Business purpose.** Students find clubs to join and contact their presidents here. The directory, each club's page and the contact card now speak the student's language; club names and descriptions stay as the clubs wrote them.

**Core concepts & decisions.**
- **Counts through ICU plurals:** directory count (`Clubs.count`, Arabic: نادٍ واحد / ناديان / 6 أندية / 11 ناديًا), card footers (`Clubs.upcomingCount`). The two English-only helpers in `lib/clubs.ts` are gone.
- **"Since" date split in two.** `formatClubSince(createdAt, locale)` (server, campus time zone, `cachedFormatter`) returns only "janvier 2026" / "يناير 2026"; the sentence around it is `Clubs.since` ("Since {date}", "Depuis {date}", "منذ {date}"). Word order belongs to the messages, the date to `Intl`, same split as the calendar.
- **Contact details stay left to right.** The president's email now gets `dir="ltr"` like the phone already had, so an address or "+212 6 …" is never reordered inside an Arabic sentence.
- **Arabic date column in past-event lists.** `Intl`'s short Arabic date spells the whole weekday ("الجمعة، 13 نونبر"), wider than the fixed `w-24` column built for "Fri, Nov 13". The column is `rtl:w-32` in Arabic, so dates stay on one line and titles still line up (used by club pages and, later, /profile).
- **Shared pieces reused:** the campus toggle (translated in 12.3), event cards and RSVP (12.3), `EventPage.discover` on the club 404.
- **Layout already mirrored:** club headers and cards use `self-start`, `gap`, flex and grid, and the back arrow had `rtl:-scale-x-100`, so nothing else moved in Arabic. The banner placeholder's gradient direction is left as is (decorative; 12.8 audit).

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| `formatClubSince` returns the month, the message adds "Since" | Return the whole sentence from `lib/clubs.ts` | `lib/` stays free of UI words; the sentence is translated where all other UI text is. |
| `rtl:w-32` on the date column | `whitespace-nowrap` with automatic width | A fixed column keeps titles aligned row to row; only Arabic needs more room. |
| Directory sort stays `localeCompare(…, 'en')` | Sort with the visitor's language | Club names are data written in Latin script; the order should not change when the visitor switches language. |

**Contract.**
```ts
// src/lib/clubs.ts
formatClubSince(createdAt: string, locale = 'en'): string; // "January 2026", server only
// ClubHeader's `since` prop is now the month alone; the component renders t('since', { date: since }).
```

**Usage.**
```tsx
// app/clubs/[slug]/page.tsx (server)
const locale = await getLocale();
<ClubHeader club={club} since={formatClubSince(club.created_at, locale)} contact={…} />
```

**Verified (2026-11-22, server HTML fetched inside the container).** `/clubs`: "6 clubs" / "6 clubs" / "6 أندية", intro sentence, "Filter clubs" / "Filtrer les clubs" / "تصفية الأندية", card footers "1 upcoming event" / "1 événement à venir" / "فعالية قادمة واحدة". `/clubs/leet-dev`: "All clubs" / "Tous les clubs" / "كل الأندية", "Since January 2026" / "Depuis janvier 2026" / "منذ يناير 2026", About / À propos / نبذة, contact lock text and login link, "Upcoming events" / "Événements à venir" / "الفعاليات القادمة", empty state, "Past events" with "Fri, Nov 13" / "ven. 13 nov." / "الجمعة، 13 نونبر". `/clubs/nope` in Arabic: "النادي غير موجود", "تصفّح الأندية", "اكتشف الفعاليات". `tsc` passes; ESLint: the same 6 old findings.

### 12.6 Login, sign-up and profile in three languages (Step 12.6, 2026-11-22)

**Files:** `src/i18n/messages/{en,fr,ar}.ts` (new `Auth`, `Validation`; `Profile` extended), `src/lib/login.ts` (`ValidationKey`, `FieldError`; `LOGIN_ERROR_MESSAGES` and `EMAIL_LOGIN_ERROR_MESSAGES` removed), `src/lib/register.ts` (`RegisterFieldErrors` holds `FieldError`s, `YEARS` replaces `YEAR_OPTIONS`, `REGISTER_ERROR_MESSAGES` removed, `fromDjangoErrors` wraps Django text), `src/app/auth/register/actions.ts`, `src/hooks/useFieldError.ts` (new), `src/components/auth/{LoginLayout,LoginPanel,FortyTwoButton,EmailLoginForm,RegisterPanel,RegisterForm,LogoutForm}.tsx`, `src/app/auth/login/page.tsx`, `src/lib/time.ts` (`formatDateTile` / `getDateTiles` take a locale), `src/components/profile/{ProfileView,ProfileActivity,AttendedEventList,ProfileSkeleton}.tsx`. Test: `src/app/test/page.tsx`.
**Status:** ✅ Validated on `/test` (2026-11-22). Live on `/auth/login`, `/auth/register`, `/profile`.

**Business purpose.** A student's first contact with Campus Hub is often the login or sign-up page; a French or Arabic speaker can now create an account, read every error and log in without English. Their profile then shows their stats and events in the same language.

**Core concepts & decisions.**
- **Errors travel as keys, not sentences.** The validation rules in `lib/login.ts` and `lib/register.ts` run in two places: the browser (instant messages) and the server action (the check that counts). Both now return a `FieldError`: `{ key: ValidationKey, values? }` (e.g. `{ key: 'passwordTooShort', values: { min: 8 } }`). The key is plain data, so it crosses the server action → form boundary unchanged, and the form turns it into text in the visitor's language with `useFieldError()`. One rule, one key, three languages; the server never needs to know which language the form displays.
- **Django's own messages stay as written.** `fromDjangoErrors` wraps each DRF message as `{ text }`, shown as is: we can't translate free text from the backend. The one case the site recognises ("already exists") becomes our `emailTaken` key and is translated. If the team wants Django errors translated, the backend must send codes or use Django's own i18n (to raise at the merge).
- **Error boxes by kind.** `LoginErrorKind` (42 errors), `EmailLoginError` and `RegisterError` stay as the state the server returns; their title and description are nested messages (`Auth.loginErrors.<kind>.title`), read with template-literal keys that next-intl type-checks, so a new kind without words fails `tsc`.
- **Links inside sentences with `t.rich`.** "With 42, just <link>continue with 42 Intra</link>: it creates your account." and the terms sentence keep their links where each language puts them; `inlineLink(href)` renders each tag.
- **Ordinals per language.** The year list uses ICU `selectordinal` in English ("1st, 2nd, 3rd, 4th year") and French ("1re, 2e année"); Arabic uses `select` on the number with the ordinal words ("السنة الأولى" … "السابعة"), which a plural rule can't produce.
- **Profile.** "My profile", the stats (labels, short labels on phones, "Coming soon"), the event tabs, empty states, "Recently attended" with "Latest 3 of N events" (plural), the "Attended" chip, and the date tiles: `formatDateTile(iso, locale)` writes "NOV" / "NOV." / "نونبر" (`toLocaleUpperCase`, a no-op on Arabic letters).
- **RTL fix found here:** the login page's "←" back link now flips in Arabic (`rtl:-scale-x-100`), like the other back links.
- **Not translated on purpose:** the dev login button (developers only, never shown in production), school and club names in the sign-up selects (data).

**Tradeoffs ("Why this instead of alternatives?").**

| Chosen | Alternative | Why |
|---|---|---|
| Keys in `FieldError`, translated in the form | Translate in the server action (`getTranslations`) and return text | The browser check runs without the server; with keys both checks share one output type and the form translates both the same way. The state stays language-free. |
| `{ text }` for Django messages | Map every DRF message to a key | DRF messages are open-ended; mapping a few would leave the rest untranslated anyway. Shown as is until the backend sends codes. |
| `t.rich` for sentences with links | Split the sentence into before / link / after | Word order differs between languages (the link moves); one message per sentence keeps it whole for translators. |
| `select` for Arabic years | Cardinal "السنة 1" | Ordinal words are how Arabic speakers name school years. |

**Contract.**
```ts
// src/lib/login.ts
type ValidationKey = 'emailRequired' | 'emailInvalid' | 'emailTaken' | 'passwordRequired' | 'passwordChoose' | 'passwordTooShort'
  | 'passwordTooLong' | 'passwordConfirmRequired' | 'passwordMismatch' | 'firstNameRequired' | 'lastNameRequired' | 'nameTooLong'
  | 'yearRequired' | 'schoolRequired';
type FieldError = { key: ValidationKey; values?: { min?: number; max?: number } } | { text: string };
interface EmailLoginFieldErrors { email?: FieldError; password?: FieldError }
// src/lib/register.ts
type RegisterFieldErrors = Partial<Record<RegisterField, FieldError>>;
const YEARS: readonly [1, 2, 3, 4, 5, 6, 7];
// src/hooks/useFieldError.ts
useFieldError(): (error: FieldError | undefined) => string | undefined;
// src/lib/time.ts
formatDateTile(iso: string, locale = 'en'): DateTile; getDateTiles(events, locale = 'en');
```

**Usage.**
```tsx
const errorText = useFieldError();
<Input name="email" label={t('email')} error={errorText(fieldErrors.email)} />
{state.error && <p>{t(`emailErrors.${state.error}.title`)}</p>}
```

**Verified (2026-11-22, server HTML fetched inside the container).** `/auth/login?registered=1`: "Welcome back" / "Bon retour" / "مرحبًا بعودتك", the intro, the notice, "Continue with 42 Intra" / "Continuer avec 42 Intra" / "المتابعة باستخدام 42 Intra", "or with email" / "ou par e-mail", labels, "Log in" / "Se connecter" / "تسجيل الدخول", "No account and no 42?" link, the 42 note, form label. `/auth/login?error=AccessDenied`: the three error boxes. `/auth/register`: labels, "At least 8 characters." / "Au moins 8 caractères." / "8 أحرف على الأقل.", years "1st year…7th year" / "1re année, 2e année…" / "السنة الأولى…السابعة", "Choose your school first", "Create account", the intro and terms sentences with their links. `tsc` passes; ESLint: the same 6 old findings (one new `react/display-name` from the first `t.rich` helper, fixed with the named `InlineLink`). Signed-in `/profile`, the form errors (browser and server) and the logout button: in the browser (checklist on `/test`).
