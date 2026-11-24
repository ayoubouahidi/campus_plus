import type { EventCategory } from '@/types/api';

// The design system's tokens as data (Step 17.1, DOCS.md §17), read by the showcase page. Tailwind only sees
// class names written out in full, so every swatch keeps its literal class (never `bg-${color}-500`).
// Source of truth stays the components themselves; this file lists what they use, for people to see.

// Atomic Design levels (Brad Frost), the order the showcase follows. Foundations = the tokens atoms are made of.
export type AtomicLevel = 'foundations' | 'atoms' | 'molecules' | 'organisms' | 'templates';

export const ATOMIC_LEVELS: Record<AtomicLevel, { title: string; description: string }> = {
  foundations: {
    title: 'Foundations',
    description: 'The tokens everything is built from: colour, type, radius, elevation and icons.',
  },
  atoms: {
    title: 'Atoms',
    description: 'The smallest working parts. Each one is a single element with its own states and accessibility.',
  },
  molecules: {
    title: 'Molecules',
    description: 'A few atoms working together for one job: a card, tabs, a toast, a dialog.',
  },
  organisms: {
    title: 'Organisms',
    description: 'Self-contained sections of a page, built from molecules and atoms, fed with real data shapes.',
  },
  templates: {
    title: 'Templates & pages',
    description: 'Page layouts that place organisms, and the real pages built from them.',
  },
};

export const ATOMIC_ORDER: AtomicLevel[] = ['foundations', 'atoms', 'molecules', 'organisms', 'templates'];

export interface Swatch {
  name: string; // Tailwind name, e.g. 'violet-600'
  className: string; // the literal background class
  role?: string; // what it is used for
  dark?: boolean; // dark enough for white text on top
}

export const BRAND_SCALE: Swatch[] = [
  { name: 'violet-50', className: 'bg-violet-50', role: 'Selected rows, soft backgrounds' },
  { name: 'violet-100', className: 'bg-violet-100', role: 'Icon tiles' },
  { name: 'violet-200', className: 'bg-violet-200' },
  { name: 'violet-300', className: 'bg-violet-300' },
  { name: 'violet-400', className: 'bg-violet-400', role: 'Accent in dark mode' },
  { name: 'violet-500', className: 'bg-violet-500', role: 'Focus rings (at 20–40 %)', dark: true },
  { name: 'violet-600', className: 'bg-violet-600', role: 'Primary: buttons, links, active', dark: true },
  { name: 'violet-700', className: 'bg-violet-700', role: 'Primary hover', dark: true },
  { name: 'violet-800', className: 'bg-violet-800', dark: true },
  { name: 'violet-900', className: 'bg-violet-900', dark: true },
];

export const NEUTRAL_SCALE: Swatch[] = [
  { name: 'white', className: 'bg-white', role: 'Cards (light)' },
  { name: 'slate-50', className: 'bg-slate-50', role: 'Page background (light)' },
  { name: 'slate-100', className: 'bg-slate-100', role: 'Muted surfaces, chips' },
  { name: 'slate-200', className: 'bg-slate-200', role: 'Borders (light, at 80 %)' },
  { name: 'slate-400', className: 'bg-slate-400', role: 'Placeholder text, icons' },
  { name: 'slate-500', className: 'bg-slate-500', role: 'Secondary text', dark: true },
  { name: 'slate-700', className: 'bg-slate-700', role: 'Body text (dark mode: 300)', dark: true },
  { name: 'slate-800', className: 'bg-slate-800', role: 'Borders (dark)', dark: true },
  { name: 'slate-900', className: 'bg-slate-900', role: 'Cards (dark), headings (light)', dark: true },
  { name: 'slate-950', className: 'bg-slate-950', role: 'Page background (dark)', dark: true },
];

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export const STATUS_SWATCHES: Record<StatusTone, Swatch> = {
  success: { name: 'emerald-500', className: 'bg-emerald-500', role: 'Success: going, saved', dark: true },
  warning: { name: 'amber-500', className: 'bg-amber-500', role: 'Warning: few places left, changed' },
  danger: { name: 'rose-600', className: 'bg-rose-600', role: 'Danger: cancelled, errors, unread badge', dark: true },
  neutral: { name: 'slate-400', className: 'bg-slate-400', role: 'Neutral: past, inactive' },
};

// One colour family per event category (CLAUDE.md design tokens), shown through the Badge atom.
export const CATEGORY_SWATCHES: Record<EventCategory, Swatch> = {
  Tech: { name: 'lime-500', className: 'bg-lime-500' },
  Media: { name: 'violet-500', className: 'bg-violet-500', dark: true },
  Music: { name: 'indigo-500', className: 'bg-indigo-500', dark: true },
  Sports: { name: 'teal-500', className: 'bg-teal-500' },
  Business: { name: 'orange-500', className: 'bg-orange-500' },
  Gaming: { name: 'fuchsia-500', className: 'bg-fuchsia-500', dark: true },
  EventsOrganization: { name: 'sky-500', className: 'bg-sky-500' },
};

export interface TypeStep {
  name: string; // Tailwind class
  className: string;
  use: string;
}

export const TYPE_SCALE: TypeStep[] = [
  { name: 'text-3xl / bold', className: 'text-3xl font-bold tracking-tight', use: 'Page titles' },
  { name: 'text-2xl / semibold', className: 'text-2xl font-semibold tracking-tight', use: 'Section titles, hero' },
  { name: 'text-lg / semibold', className: 'text-lg font-semibold', use: 'Card and dialog titles' },
  { name: 'text-base / medium', className: 'text-base font-medium', use: 'Emphasis in body text' },
  { name: 'text-sm', className: 'text-sm', use: 'Body text, buttons, inputs (the default size)' },
  { name: 'text-xs / medium', className: 'text-xs font-medium', use: 'Badges, captions, timestamps' },
];

export const RADII: { name: string; className: string; use: string }[] = [
  { name: 'rounded-md', className: 'rounded-md', use: 'Badges, small buttons' },
  { name: 'rounded-lg', className: 'rounded-lg', use: 'Buttons, inputs, icon buttons' },
  { name: 'rounded-xl', className: 'rounded-xl', use: 'Cards, panels, dialogs' },
  { name: 'rounded-2xl', className: 'rounded-2xl', use: 'Hero and profile banners' },
  { name: 'rounded-full', className: 'rounded-full', use: 'Avatars, chips, dots' },
];

export const SHADOWS: { name: string; className: string; use: string }[] = [
  { name: 'shadow-sm', className: 'shadow-sm', use: 'Cards at rest' },
  { name: 'shadow-md', className: 'shadow-md', use: 'Cards on hover' },
  { name: 'shadow-xl', className: 'shadow-xl', use: 'Popovers, dialogs, toasts' },
];
