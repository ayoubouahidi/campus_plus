import NextAuth from "next-auth";
import FortyTwoSchool from "next-auth/providers/42-school";
import Credentials from "next-auth/providers/credentials";

type FortyTwoProfile = {
  id: number;
  login: string;
  email: string;
  first_name: string;
  last_name: string;
  image?: { link?: string | null };
  campus?: { name: string }[];
};

type BackendUser = { id: string | number; role: string; login?: string };
type BackendSyncResponse = { token: string; user: BackendUser };

/** Ask the backend to create/update the user and give us its own token. */
async function syncWithBackend(p: FortyTwoProfile): Promise<BackendSyncResponse | null> {
  // Dev fallback so you can build the UI before the backend exists
  if (!process.env.BACKEND_URL) {
    if (process.env.NODE_ENV !== "production") {
      return { token: "dev-token", user: { id: String(p.id), role: "STUDENT" } };
    }
    return null;
  }

  try {
    const res = await fetch(`${process.env.BACKEND_URL}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.BACKEND_INTERNAL_KEY ?? "",
      },
      body: JSON.stringify({
        fortyTwoId: p.id,
        login: p.login,
        email: p.email,
        firstName: p.first_name,
        lastName: p.last_name,
        imageUrl: p.image?.link ?? null,
        campus: p.campus?.[0]?.name ?? null,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null; // e.g. 403 = user not allowed
    return (await res.json()) as BackendSyncResponse;
  } catch {
    return null;
  }
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
        if (!process.env.BACKEND_URL) return null;

        const res = await fetch(`${process.env.BACKEND_URL}/api/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
          }),
          cache: "no-store",
        });
        if (!res.ok) return null;

        const data = (await res.json()) as BackendSyncResponse;
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
    // Runs once, right after 42 approves the user
    async signIn({ user, profile, account }) {
      if (account?.provider === "credentials") {
        return true;
      }

      const p = profile as FortyTwoProfile | undefined;
      if (!p) return false;

      // Optional: only allow your campus
      // if (!p.campus?.some((c) => c.name === "Benguerir")) return false;

      const data = await syncWithBackend(p);
      if (!data) return false; // -> /login?error=AccessDenied

      // Pass the result to the jwt callback
      Object.assign(user, {
        backendToken: data.token,
        role: data.user.role,
        userId: data.user.id,
        login: p.login,
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