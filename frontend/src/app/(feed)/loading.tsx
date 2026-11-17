import { EventFeedSkeleton } from '@/components/events/EventSkeletons';

// Loading UI for `/` (the feed). In the (feed) route group so it covers `/` only: at the app root it would
// wrap every route and flash the feed skeleton before theirs on a direct page load (DOCS.md §6.21).
// Shown instantly while the page renders on the server (Next.js wraps the page in <Suspense> with this
// as the fallback); the shell stays. Same container as the page, so nothing shifts (DOCS.md §6.21).
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <EventFeedSkeleton />
    </div>
  );
}
