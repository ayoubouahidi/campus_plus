import type { Metadata } from 'next';
import { connection } from 'next/server';
import { auth, getSessionState, signOut } from '@/auth';
import { ProfileView } from '@/components/profile/ProfileView';
import { getMyEvents } from '@/lib/events';
import { mockEvents } from '@/lib/mockData';

export const metadata: Metadata = {
  title: 'My profile | Campus Hub',
  robots: { index: false, follow: false }, // personal page
};

// Log out, then land on Discover (a signed-out visitor can't stay on /profile).
async function logout() {
  'use server';
  await signOut({ redirectTo: '/' });
}

// `/profile` (alias `/me`, next.config.ts), Step 5.4. Signed-in only (./layout.tsx). Server Component: reads
// the session, splits the student's RSVPs at the request time, then renders the Figma profile (ProfileView).
export default async function ProfilePage() {
  await connection(); // upcoming vs past uses the request time

  const session = await getSessionState();
  if (session.status !== 'signed-in') return null; // unreachable: the layout redirects first
  const authSession = await auth(); // 42 login + campus (not part of our User shape)

  // Phase 7: GET /api/me/rsvps/ instead of the mock events flagged has_user_rsvpd.
  // eslint-disable-next-line react-hooks/purity -- rendered per request (connection() above)
  const { upcoming, past } = getMyEvents(mockEvents, Date.now());

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <ProfileView
        user={session.user}
        login={authSession?.user.login ?? null}
        campus={authSession?.user.campus ?? null}
        upcoming={upcoming}
        past={past}
        logoutAction={logout}
      />
    </div>
  );
}
