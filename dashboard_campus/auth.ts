import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// The dashboard is for club boards and super admins only, and they sign in with
// email + password. Students use the student site (https://localhost); 42 login
// lives there too, never here.

type BackendUser = { id: string | number; role: string; login?: string };
type BackendLoginResponse = { token: string; user: BackendUser };

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
        if (data.user.role !== "SUPERADMIN" && data.user.role !== "BOARD_MEMBER") {
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
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
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
