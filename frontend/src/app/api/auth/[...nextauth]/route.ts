import { handlers } from '@/auth';

// Auth.js endpoints (Step 5.2): /api/auth/signin, /callback/42-school, /session, /signout, /csrf, ...
// nginx sends /api/auth/* here, not to Django (infrastructure/nginx/nginx.conf, DOCS.md §7.5).
export const { GET, POST } = handlers;
