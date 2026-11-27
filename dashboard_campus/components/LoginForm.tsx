"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type FieldErrors = { email?: string; password?: string };

const SIGN_IN_ERRORS: Record<string, string> = {
  student_account:
    "This account is a student account. The dashboard is only for club boards and administrators; students use the Campus Hub site.",
  backend_unavailable: "The server is not answering right now. Please try again in a moment.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fortyTwoLoading, setFortyTwoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const nextErrors: FieldErrors = {};
    if (!email) nextErrors.email = "Enter your email.";
    else if (!EMAIL_PATTERN.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      const firstInvalid = nextErrors.email ? "email" : "password";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(
          (result.code && SIGN_IN_ERRORS[result.code]) ??
            "Incorrect email or password. Try again."
        );
        setLoading(false);
        return;
      }
      // Full page load so the server reads the new session and sends each role to its area.
      window.location.assign(callbackUrl);
    } catch {
      // signIn throws when the server answers with a non-JSON page, e.g. nginx's
      // 429 after too many attempts (5 per minute per address).
      setError("Unable to sign in right now. If you tried several times, wait a minute and try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* 42 first, like the student site: most board members and admins are 1337 students. */}
      <Button
        type="button"
        variant="secondary"
        className="mt-7 w-full"
        isLoading={fortyTwoLoading}
        onClick={() => {
          setFortyTwoLoading(true);
          void signIn("42-school", { redirectTo: callbackUrl });
        }}
        leftIcon={
          <span aria-hidden="true" className="grid h-[22px] w-[22px] place-items-center rounded-md bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
            42
          </span>
        }
      >
        {fortyTwoLoading ? "Redirecting to 42…" : "Continue with 42 Intra"}
      </Button>

      <div aria-hidden="true" className="my-6 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        or with your email
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <form onSubmit={handleSubmit} noValidate aria-label="Sign in with email" className="space-y-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
          onChange={() => fieldErrors.email && setFieldErrors((current) => ({ ...current, email: undefined }))}
        />

        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          label="Password"
          autoComplete="current-password"
          error={fieldErrors.password}
          onChange={() => fieldErrors.password && setFieldErrors((current) => ({ ...current, password: undefined }))}
          className="pr-16"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((isVisible) => !isVisible)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="rounded text-xs font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        />

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
