import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth, getSessionState, signOut } from '@/auth';
import { ProfileView } from '@/components/profile/ProfileView';
import { clearRealtimeCookie } from '@/app/realtime/actions';
import { getMyEvents } from '@/lib/events';
import { getBackendToken } from '@/lib/api/token';
import { getMe, listEvents } from '@/lib/data';
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
  const authSession = await auth(); // 42 login (not part of our User shape)

  // Only the student's RSVPs, past and upcoming (Django: ?rsvped=true, TEAM_NEEDS BE2), split at `now`.
  const token = await getBackendToken();
  const [events, me] = await Promise.all([listEvents({ rsvped: true }, token), getMe(token)]);
  const { upcoming, past } = getMyEvents(events, now);
  // Django's current values (Step 21.2): the login cookie keeps those from login time, so a saved phone (or a
  // changed name or picture) shows at once. Mocks or dev login (me = null): the session user, no phone.

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <ProfileView
        user={me?.user ?? session.user}
        phone={me?.phone ?? ''}
        login={authSession?.user.login ?? null}
        upcoming={upcoming}
        past={past}
        logoutAction={logout}
      />
    </div>
  );
}
