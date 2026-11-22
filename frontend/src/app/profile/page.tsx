import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth, getSessionState, signOut } from '@/auth';
import { ProfileView } from '@/components/profile/ProfileView';
import { clearRealtimeCookie } from '@/app/realtime/actions';
import { getMyEvents } from '@/lib/events';
import { getBackendToken } from '@/lib/api/token';
import { listEvents } from '@/lib/data';
import { getRequestTime } from '@/lib/requestTime';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return {
    title: t('profile'),
    robots: { index: false, follow: false }, // personal page
  };
}

// Log out, then land on Discover (a signed-out visitor can't stay on /profile).
async function logout() {
  'use server';
  await clearRealtimeCookie(); // the WebSocket credential goes with the session (Step 15.1)
  await signOut({ redirectTo: '/' });
}

// `/profile` (alias `/me`, next.config.ts), Step 5.4. Signed-in only (./layout.tsx). Server Component: reads
// the session, splits the student's RSVPs at the request time, then renders the Figma profile (ProfileView).
export default async function ProfilePage() {
  const now = await getRequestTime(); // upcoming vs past uses the request time

  const session = await getSessionState();
  if (session.status !== 'signed-in') return null; // unreachable: the layout redirects first
  const authSession = await auth(); // 42 login + campus (not part of our User shape)

  // Until Django has /api/me/rsvps/ (TEAM_NEEDS BE2): every event read with the student's token, kept where
  // has_user_rsvpd is true. Correct, just heavier than a dedicated endpoint.
  const { upcoming, past } = getMyEvents(await listEvents({}, await getBackendToken()), now);

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
