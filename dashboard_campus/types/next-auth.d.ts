import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    backendToken?: string;
    user: {
      id: string;
      role?: string;
      login?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    role?: string;
    userId?: string;
    login?: string;
  }
}