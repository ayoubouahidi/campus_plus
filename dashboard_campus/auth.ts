import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import FortyTwoSchool from "next-auth/providers/42-school";

// The dashboard is for club boards and super admins only. They sign in with email
// + password, or with 42 (the 42 account is synced to Django like on the student
// site). A student account is refused either way, with its own message.

type BackendUser = { id: string | number; role: string; login?: string };
type BackendLoginResponse = { token: string; user: BackendUser };

type FortyTwoProfile = {
  id: number;
  login: string;
  email: string;
  first_name: string;
  last_name: string;
  image?: { link?: string | null };
  campus?: { name: string }[];
};

const DASHBOARD_ROLES = new Set(["SUPERADMIN", "BOARD_MEMBER"]);

/** Create/update the Django account for this 42 user and get its token (same call as the student site). */
async function syncFortyTwo(profile: FortyTwoProfile): Promise<BackendLoginResponse | null> {
  if (!process.env.BACKEND_URL) return null;
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.BACKEND_INTERNAL_KEY ?? "",
      },
      body: JSON.stringify({
        fortyTwoId: profile.id,
        login: profile.login,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        imageUrl: profile.image?.link ?? null,
        campus: profile.campus?.[0]?.name ?? null,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null; // e.g. 403: campus not allowed, account disabled
    return (await res.json()) as BackendLoginResponse;
  } catch {
    return null;
  }
}

/** Right password, but a student account: the dashboard is not for them. */
class StudentAccount extends CredentialsSignin {
  code = "student_account";
}

/** The backend could not be reached or answered with a server error. */
class BackendUnavailable extends CredentialsSignin {
  code = "backend_unavailable";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!process.env.BACKEND_URL) throw new BackendUnavailable();

        let res: Response;
        try {
          res = await fetch(`${process.env.BACKEND_URL}/api/auth/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
            cache: "no-store",
          });
        } catch {
          throw new BackendUnavailable();
        }
        if (res.status >= 500) throw new BackendUnavailable();
        if (!res.ok) return null; // wrong email or password

        const data = (await res.json()) as BackendLoginResponse;
        if (!DASHBOARD_ROLES.has(data.user.role)) {
          throw new StudentAccount();
        }
        return {
          id: String(data.user.id),
          backendToken: data.token,
          role: data.user.role,
          userId: String(data.user.id),
          login: data.user.login ?? "",
        } as never;
      },
    }),
    FortyTwoSchool,
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // 42 only: sync with Django, then let in super admins and board members.
    async signIn({ user, profile, account }) {
      if (account?.provider !== "42-school") return true;
      const data = profile ? await syncFortyTwo(profile as unknown as FortyTwoProfile) : null;
      if (!data) return "/login?error=FortyTwoUnavailable";
      if (!DASHBOARD_ROLES.has(data.user.role)) return "/login?error=StudentAccount";
      Object.assign(user, {
        backendToken: data.token,
        role: data.user.role,
        userId: String(data.user.id),
        login: (profile as unknown as FortyTwoProfile).login,
      });
      return true;
    },

    jwt({ token, user }) {
      if (user) {
        const u = user as Record<string, string>;
        token.backendToken = u.backendToken;
        token.role = u.role;
        token.userId = u.userId;
        token.login = u.login;
      }
      return token;
    },

    session({ session, token }) {
      session.backendToken =
        typeof token.backendToken === "string" ? token.backendToken : undefined;
      session.user.id = typeof token.userId === "string" ? token.userId : "";
      session.user.role = typeof token.role === "string" ? token.role : undefined;
      session.user.login = typeof token.login === "string" ? token.login : undefined;
      return session;
    },
  },
});
