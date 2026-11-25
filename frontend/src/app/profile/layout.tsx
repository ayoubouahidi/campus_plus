import { redirect } from 'next/navigation';
import { getSessionState } from '@/auth';
import { loginHref } from '@/lib/login';

// Route guard for /profile (Step 5.4). In the layout, not the page: the layout runs before ./loading.tsx is
// streamed, so a signed-out visitor gets a real HTTP redirect (307) to the login page instead of a skeleton
// followed by a client-side redirect. After login they come back here (?next=/profile).
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionState(); // cached: same read as the root layout
  if (session.status !== 'signed-in') redirect(loginHref('/profile'));
  return children;
}
