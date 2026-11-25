import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarGroup, type AvatarSize, type AvatarStatus } from '@/components/ui/Avatar';
import { Badge, type StatusVariant } from '@/components/ui/Badge';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { Select } from '@/components/ui/Select';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  ExternalIcon,
  GlobeIcon,
  LockIcon,
  MapPinIcon,
  MenuIcon,
  NAV_ICONS,
  SearchIcon,
  type NavIconProps,
} from '@/components/ui/layout/navIcons';
import { ChevronIcon, LogoutIcon, StatCalendarIcon, StatCheckIcon, StatClubIcon } from '@/components/profile/profileIcons';
import { ClubCard } from '@/components/clubs/ClubCard';
import {
  ATOMIC_ORDER,
  BRAND_SCALE,
  CATEGORY_SWATCHES,
  NEUTRAL_SCALE,
  RADII,
  SHADOWS,
  STATUS_SWATCHES,
  TYPE_SCALE,
  type StatusTone,
  type Swatch,
} from '@/lib/designTokens';
import { EVENT_CATEGORIES } from '@/lib/events';
import type { EventSchedule } from '@/lib/time';
import type { Club, EventItem } from '@/types/api';
import type { AppNotification } from '@/types/notification';
import { DsSection, LevelTag, Specimen, SpecimenRow } from './DesignSystemParts';
import {
  EventCardSpecimen,
  FilterChipSpecimen,
  ModalSpecimen,
  NotificationSpecimen,
  TabsSpecimen,
  ToastSpecimen,
} from './InteractiveSpecimens';

// Campus Hub's design system, as one page (Step 17.1, DOCS.md §17), ordered by Atomic Design: foundations →
// atoms → molecules → organisms → templates & pages. Every example is the real component from src/components,
// so the page can't drift from the product. Documentation text is English (developer reference, like a
// Storybook); the components themselves follow the chosen language and direction (try العربية).

export interface DesignSystemShowcaseProps {
  event: EventItem; // sample data (mocks): the organisms never touch Django here
  schedule: EventSchedule; // formatted on the server, as on the feed
  club: Club;
  upcomingCount: number;
  notifications: AppNotification[];
}

const SwatchTile = ({ swatch }: { swatch: Swatch }) => (
  <li className="overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-800">
    <div className={`flex h-14 items-end p-2 ${swatch.className}`}>
      <span className={`font-mono text-[11px] ${swatch.dark ? 'text-white' : 'text-slate-900'}`} dir="ltr">
        {swatch.name}
      </span>
    </div>
    {swatch.role && <p className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400">{swatch.role}</p>}
  </li>
);

const ICONS: { name: string; Icon: (props: NavIconProps) => React.JSX.Element }[] = [
  { name: 'discover', Icon: NAV_ICONS.discover },
  { name: 'calendar', Icon: NAV_ICONS.calendar },
  { name: 'clubs', Icon: NAV_ICONS.clubs },
  { name: 'profile', Icon: NAV_ICONS.profile },
  { name: 'search', Icon: SearchIcon },
  { name: 'bell', Icon: BellIcon },
  { name: 'menu', Icon: MenuIcon },
  { name: 'close', Icon: CloseIcon },
  { name: 'external', Icon: ExternalIcon },
  { name: 'check', Icon: CheckIcon },
  { name: 'map pin', Icon: MapPinIcon },
  { name: 'lock', Icon: LockIcon },
  { name: 'globe', Icon: GlobeIcon },
  { name: 'logout', Icon: LogoutIcon },
  { name: 'chevron', Icon: ChevronIcon },
  { name: 'stat calendar', Icon: StatCalendarIcon },
  { name: 'stat check', Icon: StatCheckIcon },
  { name: 'stat club', Icon: StatClubIcon },
];

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];
const BUTTON_SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const STATUS_VARIANTS: StatusVariant[] = ['success', 'warning', 'danger', 'neutral'];
const AVATAR_SIZES: AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const AVATAR_STATUSES: AvatarStatus[] = ['online', 'away', 'busy', 'offline'];
const PEOPLE = ['Salma Idrissi', 'Youssef Benali', 'Imane Chraibi', 'Hamza El Amrani', 'Nora Tazi', 'Anas Bennani'];

const TEMPLATES: { name: string; path: string; use: string }[] = [
  { name: 'AppShell', path: 'src/components/ui/layout/AppShell.tsx', use: 'Navbar, bell, search, phone tab bar and drawer, footer: every page except login' },
  { name: 'LoginLayout', path: 'src/components/auth/LoginLayout.tsx', use: 'Full-screen split layout for /auth/login and /auth/register' },
  { name: 'LegalPage', path: 'src/components/legal/LegalPage.tsx', use: 'Readable document layout for /privacy and /terms' },
];

const PAGES: { href: '/' | '/calendar' | '/clubs' | '/profile' | '/auth/login' | '/privacy'; name: string; built: string }[] = [
  { href: '/', name: 'Discover (feed)', built: 'FeedToolbar + CategoryFilter + EventGrid of EventCard' },
  { href: '/calendar', name: 'Calendar', built: 'CalendarHeader + MonthGrid / WeekGrid + DayAgenda' },
  { href: '/clubs', name: 'Clubs', built: 'ClubDirectory of ClubCard; club page: ClubHeader + ClubEvents + ClubContactCard' },
  { href: '/profile', name: 'Profile', built: 'ProfileHero + ProfileActivity + AttendedEventList' },
  { href: '/auth/login', name: 'Login', built: 'LoginLayout + LoginPanel (42 button, email form)' },
  { href: '/privacy', name: 'Privacy', built: 'LegalPage' },
];

export const DesignSystemShowcase = ({ event, schedule, club, upcomingCount, notifications }: DesignSystemShowcaseProps) => (
  <div className="space-y-14">
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Logo className="h-9 w-auto" />
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          Design system
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Campus Hub design system</h1>
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
        The building blocks of the student site, organised with Atomic Design. Every example below is the real
        component, in light and dark mode, in English, French and Arabic (right to left). Keyboard, focus and screen
        reader behaviour are part of each component.
      </p>
      <nav aria-label="Design system levels">
        <ol className="flex flex-wrap gap-2">
          {ATOMIC_ORDER.map((level, index) => (
            <li key={level}>
              <a
                href={`#${level}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-violet-300"
              >
                <span className="font-mono text-xs text-slate-400">{index + 1}</span>
                <LevelTag level={level} />
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </header>

    {/* ------------------------------ Foundations ------------------------------ */}
    <DsSection level="foundations">
      <Specimen title="Brand colour: violet" description="One brand colour. violet-600 is the primary action; dark mode uses the 400–500 range.">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BRAND_SCALE.map((swatch) => (
            <SwatchTile key={swatch.name} swatch={swatch} />
          ))}
        </ul>
      </Specimen>

      <Specimen title="Neutrals: slate" description="Surfaces, borders and text, for light and dark mode.">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {NEUTRAL_SCALE.map((swatch) => (
            <SwatchTile key={swatch.name} swatch={swatch} />
          ))}
        </ul>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Status colours" description="Meaning is never carried by colour alone: every status also has text or an icon.">
          <ul className="grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_SWATCHES) as StatusTone[]).map((tone) => (
              <SwatchTile key={tone} swatch={STATUS_SWATCHES[tone]} />
            ))}
          </ul>
        </Specimen>
        <Specimen title="Event categories" description="One colour family per category, used by badges, chips and calendar dots.">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EVENT_CATEGORIES.map((category) => (
              <li key={category} className="flex items-center gap-2 rounded-lg border border-slate-200/80 p-2 dark:border-slate-800">
                <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full ${CATEGORY_SWATCHES[category].className}`} />
                <Badge variant={category}>{category === 'EventsOrganization' ? 'Events' : category}</Badge>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>

      <Specimen
        title="Typography"
        description="Geist for Latin text, Geist Mono for codes and keys, Noto Sans Arabic for Arabic (with Geist for Latin words and digits inside it)."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
          <ul className="space-y-3">
            {TYPE_SCALE.map((step) => (
              <li key={step.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                <span className={`${step.className} text-slate-900 dark:text-slate-100`}>Edge AI Hackathon</span>
                <span className="font-mono text-xs text-slate-500" dir="ltr">
                  {step.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{step.use}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-3 text-sm">
            <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="font-sans text-lg">Aa Geist</p>
              <p className="font-mono text-xs text-slate-500">font-sans</p>
            </li>
            <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="font-mono text-lg">Aa ⌘K 1337</p>
              <p className="font-mono text-xs text-slate-500">font-mono</p>
            </li>
            <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p lang="ar" dir="rtl" className="text-lg">
                فعاليات 1337
              </p>
              <p className="font-mono text-xs text-slate-500">Noto Sans Arabic</p>
            </li>
          </ul>
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Radius">
          <ul className="flex flex-wrap gap-4">
            {RADII.map((radius) => (
              <li key={radius.name} className="w-24 space-y-1.5 text-center">
                <div className={`mx-auto h-14 w-14 border-2 border-violet-500 bg-violet-50 dark:bg-violet-500/10 ${radius.className}`} />
                <p className="font-mono text-[11px] text-slate-500" dir="ltr">
                  {radius.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{radius.use}</p>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen title="Elevation">
          <ul className="flex flex-wrap gap-4">
            {SHADOWS.map((shadow) => (
              <li key={shadow.name} className="w-28 space-y-1.5 text-center">
                <div className={`mx-auto h-14 w-20 rounded-xl bg-white dark:bg-slate-800 ${shadow.className}`} />
                <p className="font-mono text-[11px] text-slate-500" dir="ltr">
                  {shadow.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{shadow.use}</p>
              </li>
            ))}
          </ul>
        </Specimen>
      </div>

      <Specimen
        title="Icons"
        path="src/components/ui/layout/navIcons.tsx · src/components/profile/profileIcons.tsx"
        description="Inline SVG, 1.5 px stroke, currentColor. Decorative by default (aria-hidden); a button that only shows an icon has an aria-label."
      >
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ICONS.map(({ name, Icon }) => (
            <li
              key={name}
              className="flex flex-col items-center gap-2 rounded-lg border border-slate-200/80 p-3 text-slate-700 dark:border-slate-800 dark:text-slate-300"
            >
              <Icon className="h-5 w-5" />
              <span className="text-center text-xs text-slate-500 dark:text-slate-400">{name}</span>
            </li>
          ))}
        </ul>
      </Specimen>
    </DsSection>

    {/* --------------------------------- Atoms --------------------------------- */}
    <DsSection level="atoms">
      <Specimen title="Button" path="src/components/ui/Button.tsx" description="Four variants, three sizes, a loading state that keeps the width, optional icons.">
        <div className="space-y-4">
          <SpecimenRow label="Variants">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant[0].toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </SpecimenRow>
          <SpecimenRow label="Sizes">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} size={size}>
                Size {size}
              </Button>
            ))}
          </SpecimenRow>
          <SpecimenRow label="States and icons">
            <Button isLoading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button variant="secondary" leftIcon={<CheckIcon className="h-4 w-4" />}>
              Going
            </Button>
            <Button variant="ghost" rightIcon={<ExternalIcon className="h-4 w-4" />}>
              Open 42 intra
            </Button>
          </SpecimenRow>
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Badge" path="src/components/ui/Badge.tsx" description="Status badges (with optional dot) and the seven category badges.">
          <div className="space-y-4">
            <SpecimenRow label="Status">
              {STATUS_VARIANTS.map((variant) => (
                <Badge key={variant} variant={variant} hasDot>
                  {variant}
                </Badge>
              ))}
            </SpecimenRow>
            <SpecimenRow label="Categories">
              {EVENT_CATEGORIES.map((category) => (
                <Badge key={category} variant={category}>
                  {category === 'EventsOrganization' ? 'Events' : category}
                </Badge>
              ))}
            </SpecimenRow>
          </div>
        </Specimen>
        <Specimen
          title="FilterChip"
          path="src/components/ui/FilterChip.tsx"
          description="A toggle button shaped like a pill. Screen readers hear “pressed” on the selected one (aria-pressed)."
        >
          <FilterChipSpecimen />
        </Specimen>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Input" path="src/components/ui/Input.tsx" description="Label bound with useId, helper text and errors announced with the field.">
          <div className="space-y-4">
            <Input label="Email" type="email" placeholder="you@student.1337.ma" helperText="Your 1337 email address." />
            <Input label="Search" placeholder="Search events…" leftIcon={<SearchIcon className="h-4 w-4" />} />
            <Input label="Password" type="password" defaultValue="short" error="Use at least 8 characters." />
          </div>
        </Specimen>
        <Specimen title="Select" path="src/components/ui/Select.tsx" description="Native select (works everywhere, with the phone's own picker), styled with a chevron.">
          <div className="space-y-4">
            <Select
              label="Year of study"
              placeholder="Choose a year"
              options={[1, 2, 3, 4, 5].map((year) => ({ value: String(year), label: `Year ${year}` }))}
            />
            <Select label="Category" error="Choose a category." options={[{ value: '', label: 'None' }]} />
          </div>
        </Specimen>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Avatar" path="src/components/ui/Avatar.tsx" description="Photo or initials, six sizes, presence dot, and a stacked group with a +N counter.">
          <div className="space-y-4">
            <SpecimenRow label="Sizes">
              {AVATAR_SIZES.map((size) => (
                <Avatar key={size} size={size} name="Salma Idrissi" />
              ))}
            </SpecimenRow>
            <SpecimenRow label="Presence">
              {AVATAR_STATUSES.map((status, index) => (
                <Avatar key={status} size="md" name={PEOPLE[index]} status={status} />
              ))}
            </SpecimenRow>
            <SpecimenRow label="Group">
              <AvatarGroup max={3} total={PEOPLE.length}>
                {PEOPLE.map((name) => (
                  <Avatar key={name} size="sm" name={name} />
                ))}
              </AvatarGroup>
            </SpecimenRow>
          </div>
        </Specimen>
        <Specimen title="Logo & Skeleton" path="src/components/ui/Logo.tsx · src/components/ui/Skeleton.tsx">
          <div className="space-y-4">
            <SpecimenRow label="Logo">
              <Logo className="h-8 w-auto" />
              <LogoMark className="h-8 w-8" />
            </SpecimenRow>
            <SpecimenRow label="Skeleton shapes (loading)">
              <Skeleton variant="circular" className="h-10 w-10" />
              <Skeleton variant="text" className="w-32" />
              <Skeleton variant="rounded" className="h-10 w-24" />
              <Skeleton variant="rectangular" className="h-10 w-24" />
            </SpecimenRow>
          </div>
        </Specimen>
      </div>
    </DsSection>

    {/* ------------------------------- Molecules ------------------------------- */}
    <DsSection level="molecules">
      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Card" path="src/components/ui/Card.tsx" description="Compound: Card, CardBanner, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.">
          <Card isHoverable className="max-w-sm">
            <CardHeader>
              <Badge variant="Tech" className="w-fit">
                Tech
              </Badge>
              <CardTitle>Pair Programming Night</CardTitle>
              <CardDescription>LEET Dev · Cluster 1</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-400">
              Built from atoms: badge, title, text, button. Hover lifts the card.
            </CardContent>
            <CardFooter>
              <Button size="sm">RSVP</Button>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen title="Card skeleton" path="src/components/ui/Skeleton.tsx" description="Same geometry as a real card, so nothing jumps when data arrives.">
          <CardSkeleton hasBanner className="max-w-sm" />
        </Specimen>
      </div>

      <Specimen title="Tabs" path="src/components/ui/Tabs.tsx" description="WAI-ARIA tabs with a roving tabIndex: Tab enters, arrow keys move, Home/End jump.">
        <TabsSpecimen />
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Toast" path="src/components/ui/Toast.tsx" description="Imperative useToast(), four tones, auto-dismiss, announced through a live region.">
          <ToastSpecimen />
        </Specimen>
        <Specimen title="Modal" path="src/components/ui/Modal.tsx" description="Portal, scroll lock, focus trap, Escape and backdrop to close, focus restored.">
          <ModalSpecimen />
        </Specimen>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen title="Empty state" path="src/components/ui/EmptyState.tsx">
          <EmptyState
            title="No events match your filters"
            description="Try another category or clear the search."
            icon={<SearchIcon className="h-6 w-6" />}
            action={
              <Button variant="secondary" size="sm">
                Clear filters
              </Button>
            }
          />
        </Specimen>
        <Specimen title="Error state" path="src/components/ui/ErrorState.tsx" description="Shows a short code that matches the server log, never the raw error.">
          <ErrorState code="a1b2c3">
            <Button size="sm">Try again</Button>
          </ErrorState>
        </Specimen>
      </div>

      <Specimen
        title="Language switcher"
        path="src/components/ui/LanguageSwitcher.tsx"
        description="Compact (navbar) and full (phone menu). Changing the language here changes the whole site, Arabic switches to right to left."
      >
        <div className="flex flex-wrap items-center gap-4">
          <LanguageSwitcher />
          <LanguageSwitcher variant="full" />
        </div>
      </Specimen>
    </DsSection>

    {/* ------------------------------- Organisms ------------------------------- */}
    <DsSection level="organisms">
      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen
          title="EventCard"
          path="src/components/events/EventCard.tsx"
          description="Banner, category, date, place, attendees and the RSVP button (sample data: RSVP changes only this copy)."
        >
          <EventCardSpecimen event={event} schedule={schedule} />
        </Specimen>
        <Specimen title="ClubCard" path="src/components/clubs/ClubCard.tsx" description="Logo, name, description and the number of upcoming events, linking to the club page.">
          <div className="max-w-sm">
            <ClubCard club={club} upcomingCount={upcomingCount} headingLevel="h3" />
          </div>
        </Specimen>
      </div>

      <Specimen
        title="Notification popover"
        path="src/components/ui/layout/NotificationPopover.tsx"
        description="Bell with unread badge, panel with seven notification kinds, mark as read, focus trap and spoken arrivals."
      >
        <NotificationSpecimen notifications={notifications} />
      </Specimen>

      <Specimen
        title="Navbar, search palette, phone navigation, footer"
        path="src/components/ui/layout/{Navbar,MobileNav,Footer}.tsx · src/components/search/SearchPalette.tsx"
        description="Live around this page: the navbar above (press ⌘K or Ctrl K for the search palette), the footer below, and on a phone the bottom tab bar and the drawer."
      >
        <ul className="list-disc space-y-1 ps-5 text-sm text-slate-600 dark:text-slate-400">
          <li>Navbar: active page highlight, search trigger, bell, language switcher, session menu.</li>
          <li>Search palette: events and clubs, keyboard only if you like (arrows, Enter, Escape).</li>
          <li>Phone: tab bar at the bottom, drawer from the menu button (mirrored in Arabic).</li>
        </ul>
      </Specimen>
    </DsSection>

    {/* --------------------------- Templates & pages --------------------------- */}
    <DsSection level="templates">
      <Specimen title="Templates" description="Layouts that place organisms; pages fill them with data.">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {TEMPLATES.map((template) => (
            <li key={template.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-32 shrink-0 font-semibold text-slate-900 dark:text-slate-100">{template.name}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">{template.use}</span>
              <span className="font-mono text-xs text-slate-500 sm:ms-auto" dir="ltr">
                {template.path}
              </span>
            </li>
          ))}
        </ul>
      </Specimen>
      <Specimen title="Pages" description="The real pages, each built from the levels above.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="block h-full rounded-lg border border-slate-200/80 p-3 transition-colors hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-800 dark:hover:border-violet-500/50"
              >
                <span className="block font-semibold text-slate-900 dark:text-slate-100">{page.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{page.built}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Specimen>
    </DsSection>
  </div>
);
