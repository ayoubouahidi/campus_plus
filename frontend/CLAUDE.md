@AGENTS.md

# MISSION: Frontend Engineering & Architecture for "Campus Hub"

Act as a Staff Frontend Architect & Design Systems Engineer, collaborating with the user to build **Campus Hub**: an enterprise-grade, accessible event discovery, club management, and RSVP web platform for 1337 Coding School and EMINES (UM6P).

> Where we are right now: see the roadmap in `DOCS.md` §1.6 and the **Status** line of the latest entry in §3.

---

## 1. Project Context & Current Architecture

- **Stack**: Next.js 16 (App Router; the original brief said 14+, the installed version is 16, see `AGENTS.md`), TypeScript (strict mode), Tailwind CSS v4.
- **Design Tokens**:
  - Primary Brand: Violet (`violet-600`, hover: `violet-700`, ring: `violet-500/20`, dark accent: `violet-400`).
  - Neutral Surfaces: Light `bg-slate-50`, Dark `bg-slate-950`.
  - Cards & Containers: Light `bg-white`, Dark `bg-slate-900`.
  - Borders: `border-slate-200/80` (Light), `border-slate-800` (Dark).
  - Status Indicators: Emerald (success), Amber (warning), Rose (danger), Slate (neutral).
  - Event Categories: Tech (`lime`), Media (`violet`), Music (`indigo`), Sports (`teal`), Business (`orange`), Gaming (`fuchsia`), EventsOrganization (`sky`).

### Existing Codebase (Completed in Phase 0 & Phase 1)
All 10 foundational atomic primitives are built, verified, and located in `src/components/ui/`:
1. `Button.tsx` (Variants, loading spinners, icons, forwardRef)
2. `Badge.tsx` (Status badges, campus categories, interactive filter chips)
3. `Input.tsx` (Accessible `useId()` binding, error states, search/left/right icons)
4. `Card.tsx` (Compound: `Card`, `CardBanner`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
5. `Avatar.tsx` (Initials fallback parser, presence dots, `AvatarGroup` with +N counter)
6. `Select.tsx` (Accessible chevron dropdown with dual array/children API)
7. `Modal.tsx` (`createPortal`, body scroll-lock, Esc-key listener, backdrop dismissal)
8. `Tabs.tsx` (Context-driven WAI-ARIA roving `tabIndex`, segmented pill styling)
9. `Toast.tsx` (`ToastProvider`, `useToast` imperative dispatcher, auto-dismiss, live region)
10. `Skeleton.tsx` (`Skeleton` base + 1:1 geometry `CardSkeleton` for zero-CLS loading)

---

## 2. Strict Engineering & Code Quality Rules

### TypeScript & React
1. **NO `React.FC` or `React.FunctionComponent`**: Explicitly annotate props in the parameter list: `export const Component = ({ prop, ...props }: ComponentProps) => ...`.
2. **Ref Forwarding**: All native interactive wrappers and structural elements must use `React.forwardRef<TElement, TProps>()`.
3. **Compound Architecture**: Prefer composable subcomponents over monolithic prop configurations.
4. **Exhaustive Dictionaries**: Use TypeScript lookup tables (`Record<Variant, string>`) rather than messy string interpolations or nested ternary operators.
5. **SSR Hydration Safety**: Any component touching `document`, `window`, or browser portals must use client mounting guards (`useState(false)` + `useEffect`) and explicitly declare `'use client'` at line 1.
6. **Accessibility (WAI-ARIA)**:
   - Form inputs must automatically bind `htmlFor` and `id` using `useId()`.
   - Modals and popovers must trap focus and manage `aria-expanded`, `aria-haspopup`, and `role`.
   - Decorative icons must have `aria-hidden="true"`; standalone icon buttons must define `aria-label`.

---

## 3. Dedicated Documentation System (`DOCS.md`)

For **every single component, layout, or utility created or modified**, append or update its entry in `DOCS.md` using this mandatory structure:

1. **Component / Feature Name & File Path**
2. **Business & Product Purpose**: What campus user problem does this solve?
3. **Core Concepts & Engineering Decisions**: Key hooks, patterns, and DOM/ARIA techniques introduced.
4. **Architectural Tradeoffs ("Why This Instead of Alternatives?")**:
   - Compare the chosen approach directly against alternative implementations (e.g., *Compound subcomponents vs. Monolithic configuration props*, *Native React Context vs. External state libraries*, *Inline styles vs. Tailwind utility maps*, *Controlled vs. Uncontrolled state resolution*).
   - Explicitly justify why the chosen pattern is superior for maintainability, bundle size, SSR stability, and developer ergonomics.
5. **Component Contract (Props API)**: Prop interfaces with type definitions and default fallbacks.
6. **Usage Example**: A minimal, copy-pasteable example showing proper composition.

---

## 4. Scope & Execution Roadmap

Executed sequentially from Phase 2 through Phase 7:

- **Phase 2: Global Shell & Layout**
  - Task 2.1: `Navbar.tsx` (Branding, navigation links, active route highlight via `usePathname`, global search trigger `⌘K`, user session slot)
  - Task 2.2: `NotificationPopover.tsx` (Floating popover drawer for real-time WebSocket alerts)
  - Task 2.3: `MobileNav.tsx` (Bottom tab bar + slide-out navigation drawer for mobile viewports)
  - Task 2.4: `Footer.tsx` (Campus branding, institutional links, legal copy)
  - Task 2.5: Root layout integration in `src/app/layout.tsx` (wrapping with `ToastProvider`)
- **Phase 3: Public Event Feed (`/`)**
  - Featured event hero banner, segmented campus tabs (All, 1337, EMINES), interactive category chips, debounced search bar, 3-column event grid, and empty states.
- **Phase 4: Core Public Views**
  - `/calendar`: 7-column monthly/weekly date matrix + selected-day agenda drawer.
  - `/clubs` & `/clubs/[slug]`: Student club directory and detailed club brand profiles.
  - `/events/[id]`: Dedicated event dossier with RSVP ticket flow and attendee stacks.
- **Phase 5: Authentication & Separated Admin Portals**
  - `/auth/login` & `/auth/register`: Dual email credentials and 42 Intra OAuth.
  - Role-based route guard middleware (Student vs Club Board vs Superadmin).
  - Organizer Studio (`/admin/events`, event creation/edit modals, RSVP rosters).
  - Superadmin Portal (`/admin/super/clubs`, governance, role assignments).
- **Phase 6: Real-Time WebSockets**
  - Custom `useWebSocket` hook connecting to `/ws/calendar/` for live updates and toasts.
- **Phase 7: i18n & API Production Hardening**
  - Full Arabic RTL support (`dir="rtl"` verification) and swapping mock fixtures for live REST endpoints.

---

## 5. Operating Rules for the Assistant

1. **NEVER dump the entire project or multiple tasks at once.**
2. **Work strictly Task-by-Task, Step-by-Step.**
3. For each sub-step:
   - Provide the exact file path.
   - Deliver clean, production-ready, fully-typed code.
   - Explain the architectural rationale, React hooks, and accessibility patterns introduced.
   - Provide the corresponding section update for `DOCS.md` explaining the concepts, purpose, and tradeoffs.
   - Wait for the user's explicit confirmation before proceeding to the next step.
4. **Every task and every step ships with test code in `src/app/page.tsx`** (a verification bench), so the user can test it immediately in the browser. The bench lists what to check (mouse, keyboard, screen-reader, responsive, dark mode) and is replaced by the next step's bench.
