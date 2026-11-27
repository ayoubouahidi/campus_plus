import type { Session } from 'next-auth';
import type { User } from '@/types/api';
import type { SessionState } from '@/types/session';

// Auth.js session → the app's SessionState (Step 5.3). Pure (types only), so it can be tested anywhere.
// The rest of the app keeps using our `User` shape (types/api.ts), the same one the API will return.
export const toSessionState = (session: Session | null): SessionState => {
  if (!session?.user?.id) return { status: 'signed-out' };

  const { id, name, email, image, role, login } = session.user;
  const user: User = {
    id,
    email: email ?? '',
    full_name: name || login || 'Student',
    avatar_url: image ?? null,
    role,
    club_id: null, // Board members' club comes from Django (/api/me/, Ayoub), not from 42
  };
  return { status: 'signed-in', user };
};
