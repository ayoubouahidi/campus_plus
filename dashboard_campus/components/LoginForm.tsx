"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const remember = data.get("remember") === "on";

    try {
      void { email, password, remember };
      setError("Use the 42 Intra button to sign in.");
    } catch {
      setError("Incorrect email or password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handle42Login() {
    void signIn("42-school", { callbackUrl: "/admin" });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          placeholder="you@um6p.ma"
          required
        />

        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          label="Password"
          autoComplete="current-password"
          required
          className="pr-16"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((isVisible) => !isVisible)}
              aria-pressed={showPassword}
              className="text-xs font-medium text-violet-600 hover:text-violet-700 focus-visible:underline"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        />

        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-violet-600"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-violet-600 hover:text-violet-700">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handle42Login}
        className="w-full"
        leftIcon={
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-slate-900 text-[10px] font-bold text-white">
            42
          </span>
        }
      >
        Continue with 42 Intra
      </Button>

      <p className="mt-5 text-center text-xs text-slate-500">
        Your club isn&rsquo;t on CampusPulse yet?{" "}
        <Link href="/request-access" className="font-medium text-violet-600 hover:text-violet-700">
          Request access
        </Link>
      </p>
    </>
  );
}
