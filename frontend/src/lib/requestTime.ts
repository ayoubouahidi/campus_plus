import { connection } from 'next/server';

// "Now" for a Server Component, read at request time. Server-only (uses next/server).
//
// One call does both jobs, so they can't drift apart:
// 1. `connection()` makes the page render per request. Without it Next.js prerenders the page at build time
//    and "now" freezes at the build date (ended events keep showing, DOCS.md §5.5).
// 2. `Date.now()` is read here, outside the component, which keeps render pure for React's lint rule
//    (`react-hooks/purity`) without an eslint-disable comment on every page (DOCS.md §1.5b).
export async function getRequestTime(): Promise<number> {
  await connection();
  return Date.now();
}
