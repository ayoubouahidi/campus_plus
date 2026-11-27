import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/LoginForm";
import { Logo } from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export const metadata = { title: "Sign in" };

/** Only same-site paths, so ?callbackUrl= can't send people to another site. */
function safeCallbackUrl(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const session = await auth();
  if (session?.backendToken && !error) redirect("/");

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel (wide screens): what this app is and who it is for. */}
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-violet-700 lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl" />
        <span className="relative inline-flex w-fit rounded-2xl bg-white px-5 py-3 shadow-lg">
          <Logo decorative className="h-10" />
        </span>
        <div className="relative max-w-md space-y-4 text-violet-50">
          <p className="text-3xl font-bold leading-tight text-white">
            Run your club&rsquo;s events at 1337.
          </p>
          <p className="text-base text-violet-100">
            Publish events, follow registrations and keep your club&rsquo;s page up to date. Students see every change live on Campus Hub.
          </p>
        </div>
        <p className="relative text-sm text-violet-200">Campus Hub · 1337 Coding School</p>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <Logo className="mb-8 h-10 lg:hidden" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Sign in to the dashboard</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            For club boards and Campus Hub administrators.
          </p>

          {error === "StudentAccount" && (
            <p role="alert" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              This 42 account is a student account. The dashboard is only for club boards and administrators; students use the Campus Hub site.
            </p>
          )}
          {error === "FortyTwoUnavailable" && (
            <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              42 sign-in didn&rsquo;t complete: this account isn&rsquo;t allowed (1337 campuses only) or the server is busy. Try again or use your email.
            </p>
          )}
          {(error === "OAuthCallbackError" || error === "Configuration") && (
            <p role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              42 sign-in failed. Try again, or sign in with your email.
            </p>
          )}
          {error === "AccessDenied" && (
            <p role="alert" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Your account can&rsquo;t open that page. Sign in with a club board or administrator account.
            </p>
          )}

          <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />

          <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Student? Use the Campus Hub site to see events and RSVP.
          </p>
        </div>
      </section>
    </main>
  );
}
