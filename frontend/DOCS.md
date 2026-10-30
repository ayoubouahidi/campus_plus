# Campus Hub — Frontend Architecture & Engineering Docs

Campus Hub is the event discovery, club management, and RSVP platform for **1337 Coding School** and **EMINES (UM6P)**.
This file is the living engineering record: every component, layout, or utility gets an entry here when it is created or changed.

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
├── app/                    # App Router routes, layouts, verification benches
├── components/
│   ├── events/             # Event feature components built from the primitives (EventCard, ...)
│   ├── providers/          # App-wide client context (SessionProvider)
│   └── ui/                 # Phase 1 atomic primitives (Button, Badge, Input, ...)
│       └── layout/         # Phase 2 global shell (AppShell, Navbar, MobileNav, Footer, ...)
├── hooks/                  # Reusable React hooks that aren't tied to one component (useDebouncedValue)
├── lib/                    # Pure, framework-agnostic logic (navigation config, event filters, mock fixtures)
└── types/                  # Shared contracts (API DTOs, navigation types)
```

**Rule:** `types/` holds shapes, `lib/` holds data and pure functions, `components/` holds rendering.
Shell components import their route data from `lib/`; they never hard-code links.

### 1.3 Scope — Student & Public Web App

This codebase is the **Student & Public Web App**, open to everyone including signed-out visitors.

| Route | Page |
| --- | --- |
| `/` | Discovery feed: hero, department tabs, category pills, event grid |
| `/calendar` | Interactive calendar: month grid and selected-day schedule |
| `/clubs` | Clubs directory |
| `/clubs/[slug]` | Individual club hub: banner, bio, contact, club events |
| `/events/[id]` | Event detail: flyer, description, venue, RSVP |
| `/auth/login` | Student login: email/password + 42 Intra OAuth |
| `/auth/register` | Registration with campus email validation |
| `/profile` (alias `/me`) | Student profile: attending events, avatar upload, logout |

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

### 1.6 Roadmap Status

| Phase | Scope                                 | Status         |
| ----- | ------------------------------------- | -------------- |
| 0–1   | 10 atomic primitives                  | ✅ Done        |
| 2     | Global shell & layout                 | ✅ Done        |
| 3     | Public event feed (`/`)               | 🚧 In progress: spec §5.1, data §5.2, Steps 3.1 (§5.3) and 3.2 (§5.4) done |
| 4     | Calendar, clubs, event dossier        | ⏳             |
| 5     | Student auth & route guards           | ⏳             |
| 6     | Real-time WebSockets                  | ⏳             |
| 7     | i18n (Arabic RTL) & live API          | ⏳             |

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
  | '/auth/login' | '/auth/register' | '/profile' | '/me';

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
- **Search placeholder.** Until the search palette exists, ⌘K / the search button show an info toast ("Search is coming soon"). This also proves the `ToastProvider` is wired.
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
| 2 | Generic marketing hero: photo, gradient, 2 blur blobs, SVG overlay, `mix-blend`, tint layer, eyebrow pill, live-count pill | **Featured event hero**: that event's flyer + **one** gradient, category badge, title, date · location, two actions | The roadmap says *featured event*. One real event is more useful than a slogan. Five decorative layers become one, which means less paint cost and fewer things to keep in sync with dark mode. |
| 3 | Hero filters "All / RSVP'd / Saved / Invited" | Removed. Campus tabs **All · 1337 · EMINES** (our `Tabs`, segmented) sit in the toolbar under the hero | Saved and Invited have no data or feature behind them. Campus is the filter students actually need. White-15% pills on a photo also fail contrast. |
| 4 | Two search bars (navbar "Search the whole site" + hero search) | Navbar ⌘K stays the global search. The feed gets **one** "Search events" input in the toolbar that filters the grid (debounced) | Two identical-looking inputs with different scopes confuse people. The feed input sits next to the filters it works with. |
| 5 | Sticky, blurred category bar | Normal (non-sticky) chip row under the toolbar. Scrolls horizontally on phones, wraps on desktop | The navbar is already sticky. Two sticky bars take ~120px of a phone screen, and blur is expensive on low-end devices. |
| 6 | Mockup categories (Technology, Sports & Rec, Arts & Culture, Social, Academic) | Our 7 `EventCategory` values with our colours: Tech `lime` · Media `violet` · Music `indigo` · Sports `teal` · Business `orange` · Gaming `fuchsia` · EventsOrganization (label "Events") `sky` | These must match the API type (`types/api.ts`). |
| 7 | Grid inside a grey `#f1f5f9` rounded panel on a `#f8fafc` page | Cards sit directly on the page (`bg-slate-50` / `dark:bg-slate-950`) | A panel inside a page adds a layer with no purpose and gives dark mode a third grey to tune. |
| 8 | "Upcoming Schedule · OCT 24 – NOV 01", "Sorted by Date" + sort button | H2 "Upcoming events" + muted result count ("6 events") | There is only one sort order, so the sort control does nothing. The count gives feedback when filters change. |
| 9 | Category pill and bookmark button **on the image**, with a dark bottom gradient | Nothing overlays the image. The category badge moves into the card body, next to the date. No bookmark button | The mockup's on-image pills fail contrast (lime-700 on lime-500 ≈ 3:1; teal-500 text on a translucent tint over a photo). Our `Badge` category style is translucent (`bg-*-500/15`), so it is only readable on a solid surface. Bookmarks have no feature behind them. With nothing on the image, the gradient isn't needed either. |
| 10 | Each card styled differently: solid lime pill vs. tinted pill, white vs. dark bookmark, club name above the title vs. on the image, date coloured per category | **One card layout**, always the same | Consistency is what makes a grid look calm. Per-category date colours also fail contrast (fuchsia-500 on white ≈ 3.3:1). |
| 11 | Five CTA labels: "RSVP Now", "RSVP for Event", "Going ✓", "You're Attending", "Attending ✓" | Two states: **RSVP** (primary) and **Going** (with check icon, secondary/emerald tint) | One action needs one vocabulary. |
| 12 | Card footer = avatar row **plus** a full-width 44px button (two rows) | **One row:** avatar stack + "42 going" on the left, small RSVP button on the right | Shorter cards, so more events above the fold. It also matches our existing `CardSkeleton` footer geometry (avatars left, `h-8 w-20` button right), so there is zero layout shift between loading and loaded states. |
| 13 | Times shown as "9:00 AM EST" | "Thu, Nov 5 · 6:00 PM" in campus time (`formatEventSchedule`, `Africa/Casablanca`), no zone suffix | All events are on campus in Morocco. The fixed zone also keeps server and client output identical (no hydration mismatch). |
| 14 | Custom sizes (13px, 11px, 219px image) and padding that alternates 20/24px | Tailwind scale only: `text-xs`/`text-sm`/`text-lg`, image `aspect-video`, padding `p-5` everywhere | Fewer magic numbers. `aspect-video` keeps image height proportional at every column width. |
| 15 | Hover state = large `shadow-xl` | Our `Card isHoverable`: `-translate-y-0.5`, `shadow-md`, violet border, image `scale-105` | Already built and tested in Phase 1. Subtle beats dramatic for a grid of 6+ cards. Respect `motion-reduce`. |
| 16 | No empty state, light mode only | Empty state and full dark mode defined below | Both are required by the roadmap. |

#### Page layout (top to bottom)

Container for every section: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` (same as the navbar). Vertical rhythm: `space-y-8` between sections, `py-6 sm:py-8` around the page.

1. **Featured hero** (one event: the nearest upcoming event that has a flyer)
   - Card-like block, `rounded-2xl overflow-hidden`, **inside** the container (not full-bleed). Height: `min-h-[320px]` on phones, `aspect-[21/9]` from `md`.
   - Background: the flyer (`next/image`, `fill`, `object-cover`, `priority` because it is the LCP image) + one gradient `bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent`. With no flyer: `bg-gradient-to-br from-violet-600 to-violet-800`.
   - Content, bottom-left, `p-6 sm:p-10`, max width `max-w-2xl`:
     - small "Featured" label (`text-xs font-semibold uppercase tracking-wide text-violet-200`), then the category `Badge`
     - title `text-2xl sm:text-4xl font-bold tracking-tight text-white`, max 2 lines
     - meta `text-sm text-white/80`: date · time · location
     - actions: primary **RSVP / Going** button + secondary "View details" link (to `/events/[id]`, styled as a white/10 outline pill)
   - The hero looks the same in both themes (dark gradient on photo), so no `dark:` variants are needed except the no-flyer fallback.
2. **Toolbar**
   - Row 1: `<h2>` "Upcoming events" (`text-xl font-semibold`) + result count (`text-sm text-slate-500 dark:text-slate-400`, inside `aria-live="polite"`).
   - Row 2 (stacked on phones, one row from `sm`): campus `Tabs` (segmented: All · 1337 · EMINES) on the left, `Input` with search icon (`placeholder="Search events"`, `max-w-sm w-full`) on the right.
3. **Category chips**
   - Interactive `Badge` chips: "All" + 7 categories. One selected at a time (selected = filled violet, others = neutral; each chip shows its category colour dot).
   - Phones: one row, `overflow-x-auto`, hidden scrollbar, `-mx-4 px-4` so chips can scroll edge to edge. From `md`: `flex-wrap`.
   - Group semantics: `role="group" aria-label="Filter by category"`, each chip `aria-pressed`.
4. **Event grid**
   - `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`.
   - Loading: 6 × `CardSkeleton`.
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
- hint "Try another campus or category, or clear the search." (`text-sm text-slate-500 dark:text-slate-400`)
- `Button variant="secondary"` "Clear filters", which resets campus, category and search

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
| Search input | `bg-white border-slate-200` | `bg-slate-900 border-slate-800` |
| No-flyer fallback banner | category `-100` tint + `-600` icon | category `-500/10` tint + `-400` icon |
| Empty-state box | `border-slate-300` | `border-slate-700` |
| Hero | same in both themes (dark gradient over photo) | |

Rules: no pure black (`#000`) or pure white text on dark backgrounds other than the hero. Shadows are near-invisible on `slate-950`, so dark mode relies on borders for separation.

#### Accessibility checklist for the feed

- One `<h1>` per page: the hero title is the `<h1>`. "Upcoming events" is `<h2>`, card titles are `<h3>`.
- Filters live in a `<search>`/`role="search"` region. The result count is announced politely when filters change.
- Text contrast is at least 4.5:1 everywhere (the reason for corrections 9 and 10).
- Flyer images get `alt=""` (the title is right next to them). The hero image also gets `alt=""`.
- `motion-reduce:transform-none` on hover lifts and image zoom.

#### Proposed Phase 3 build order (one step at a time, each with a bench in `src/app/page.tsx`)

| Step | Deliverable |
| --- | --- |
| 3.1 | `src/lib/events.ts`: pure filter helpers (`filterEvents({ campus, category, query })`, `getFeaturedEvent`, campus list) + `useDebouncedValue` hook |
| 3.2 | `EventCard` (+ RSVP button states, no-flyer fallback) |
| 3.3 | `FeaturedEventHero` |
| 3.4 | `FeedToolbar` (campus tabs, search) + `CategoryFilter` chips |
| 3.5 | `EventGrid` with loading (`CardSkeleton`) and empty states |
| 3.6 | Assemble `/` (replace the bench with the real page) |

#### Things to fix along the way

- ~~`AvatarGroup` is still typed `React.FC`~~: fixed in Step 3.2 (§2.3).
- Toast auto-dismiss timer restart (§2.1). This becomes visible once RSVP toasts are added.

### 5.2 Data Layer (committed in `cb5dd1a`, 2026-10-29)

- `src/types/api.ts`: added `AttendeePreview` and `EventItem.attendees_preview` (≤ 3, newest first). `flyer_url` may be `''`.
- `src/lib/time.ts`: added `CAMPUS_TIME_ZONE` and `formatEventSchedule(iso) → { day, time }`.
- `src/lib/mockData.ts`: events moved to November 2026 (UTC times), flyer paths under `/mock/events/`, a shared attendee pool, and more events.
- `public/mock/events/`: `basketball.png`, `campus-bbq.png`, `hackathon.png`, `jam-session.png`, `symposium.png`.
- `src/lib/events.ts`: created empty here, filled in Step 3.1 (§5.3).

### 5.3 Event Filter Helpers & `useDebouncedValue` (Step 3.1)

**Files:** `src/lib/events.ts`, `src/hooks/useDebouncedValue.ts`
**Status:** ✅ Step 3.1 complete. Bench: `src/app/page.tsx` (14 self-checks + live filters).

#### Business & Product Purpose

Students should be able to narrow the feed to their campus, a category they care about, or something they half-remember ("that jam thing at the courtyard"). These helpers contain all of that logic. The feed's components (Steps 3.2–3.6) only render it. The hero needs one event with an image, chosen the same way every time, so that choice lives here too.

#### Core Concepts & Engineering Decisions

- **One filter object.** `filterEvents(events, { campus, category, query })` takes the same `EventFilters` shape the feed keeps in state, so "Clear filters" is just `setFilters(DEFAULT_EVENT_FILTERS)`.
- **`'all'` lives in the filter types, not in the domain types.** `CampusFilter = 'all' | Campus` and `CategoryFilter = 'all' | EventCategory`. `EventCategory` (the API type) never gets a fake `'all'` value.
- **Search normalisation.** The query and the text it searches are both turned to NFD, combining marks are stripped (Latin accents `̀-ͯ`, Arabic harakat `ً-ٟ`, `ٰ`), then lower-cased. "cinématic" finds "Cinematic", and Phase 7 Arabic search will ignore vowel marks. The ranges are written out instead of `\p{M}` because `tsconfig` targets ES2017, where Unicode property escapes aren't allowed.
- **Words combine with AND.** The query is split on whitespace. Every word must appear somewhere in the title, club name or location. Typing more narrows the results, as people expect, and extra spaces are harmless.
- **Time is a parameter.** `getUpcomingEvents(events, now)` and `getFeaturedEvent(events, now)` take `now` as a number instead of calling `Date.now()`, the same rule as `formatRelativeTime` (§3.5). This keeps them deterministic, so the bench can check them with fixed dates. It also means the page decides what "now" is. Step 3.6 should compute it **once on the server** and pass it down, so server and client HTML agree.
- **Upcoming = not ended.** An event that is happening right now (the 48-hour hackathon) stays in the feed. Sorting is by `start_time`, soonest first. `.filter()` returns a new array before `.sort()`, so the input is never mutated (bench check 14).
- **Featured = soonest upcoming event with a flyer**, otherwise `null`, in which case the page hides the hero. The featured event also stays in the grid, so filtering never makes it disappear.
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
getFeaturedEvent(events: EventItem[], now: number): EventItem | null;    // first upcoming with flyer_url !== ''

// src/hooks/useDebouncedValue.ts
useDebouncedValue<T>(value: T, delayMs?: number /* = 300 */): T;
```

#### Usage Example

```tsx
'use client';
const [filters, setFilters] = useState(DEFAULT_EVENT_FILTERS);
const query = useDebouncedValue(filters.query);

const upcoming = getUpcomingEvents(events, now);       // `now` computed once on the server
const visible = filterEvents(upcoming, { ...filters, query });
const featured = getFeaturedEvent(events, now);

<Input
  type="search"
  value={filters.query}
  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
/>
<Button onClick={() => setFilters(DEFAULT_EVENT_FILTERS)}>Clear filters</Button>
```

#### Notes for later steps

- **Step 3.4:** `Badge` with `isClickable` renders a `<span>`, which can't be reached with the keyboard or announced as a button. The category chips need a real `<button aria-pressed>`, either by giving `Badge` a button mode or with a small `FilterChip`. The bench uses `Button` for now.
- **Step 3.4:** `TabsTrigger` always sets `aria-controls` to a panel id. Campus tabs that filter one shared grid don't have a panel per tab, so either the grid gets that id or the campus control becomes a button group with `aria-pressed`.
- **Mock data:** `evt_hackathon_ai` has `club_id: 'club_leet_frame'` but `club_name: '1337 Coding School'`. This doesn't affect filtering, but it will look wrong on `/clubs/[slug]` in Phase 4.

### 5.4 EventCard & `toggleRsvp` (Step 3.2)

**Files:** `src/components/events/EventCard.tsx`, `toggleRsvp` in `src/lib/events.ts`, `CheckIcon` + `MapPinIcon` in `src/components/ui/layout/navIcons.tsx`
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

- The title is an `h3` link (the page has `h1` hero → `h2` "Upcoming events").
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
| Controlled card (`event` + `onRsvpToggle`) | Card keeps its own RSVP state | The feed, the hero and the event page must agree on one RSVP value. Local state would drift, and the hero (Step 3.3) shows the same event. |
| `fallback` slot on `CardBanner` | `EventCard` draws its own banner box | The aspect ratio, background and hover zoom stay in one place. Phase 4 club banners get the same slot for free. |
| `next/image` inside the `CardBanner` primitive | Plain `<img>` | ~25× smaller downloads and automatic `srcset`. Cost: remote URLs must be allow-listed (`images.remotePatterns` in `next.config.ts`) when Phase 7 serves flyers from the API host. |
| Label changes, no `aria-pressed` | Fixed label + `aria-pressed` | A fixed label ("RSVP" in both states) is less clear for sighted users. See Accessibility above. |
| Count text only | `AvatarGroup total` "+N" bubble plus a count | The mockup showed "+42" and "128 registered", which is the same fact twice. |

#### Component Contract

```ts
interface EventCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  event: EventItem;                          // required
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

<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  {events.map((event) => (
    <li key={event.id}><EventCard event={event} onRsvpToggle={handleRsvpToggle} /></li>
  ))}
</ul>
```

#### Notes for later steps

- **Step 3.3:** in Next.js 16, `next/image`'s `priority` is deprecated. The hero's LCP image should use `preload` (or `loading="eager"` + `fetchPriority="high"`), not `priority` as §5.1 says.
- **Step 3.5:** `CardSkeleton` no longer matches the card. It has a status badge and three description lines that `EventCard` doesn't have, and its button placeholder is `h-8` while `Button size="sm"` is ~26px. Loading → loaded will jump unless the skeleton is reshaped (or an `EventCardSkeleton` is added).
- **Phase 7:** `Button isLoading` sets `disabled`, which drops keyboard focus mid-request. Keep RSVP optimistic (no loading state), or give `Button` an `aria-disabled` loading mode first.
