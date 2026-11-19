import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';

// Loading UI for /profile (Figma "My Profile · Desktop · Loading"). Same container as the page, so nothing
// shifts. Only reached by signed-in students: the guard in ./layout.tsx runs first.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <ProfileSkeleton />
    </div>
  );
}
