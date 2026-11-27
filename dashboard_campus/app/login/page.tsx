import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CampusIllustration } from "@/components/CampusIllustration";
import LoginForm from "@/components/LoginForm";
import { Logo } from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

export const metadata = { title: "Sign in" };

/** Only same-site paths, so ?callbackUrl= can't send people to another site. */
function safeCallbackUrl(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

type Notice = { tone: "warning" | "danger"; title: string; description: string };

// Messages for ?error= (set by Auth.js, the 42 sign-in callback or the route guard).
const NOTICES: Record<string, Notice> = {
  StudentAccount: {
    tone: "warning",
    title: "This is a student account",
    description: "The dashboard is for club boards and administrators. Students use the Campus Hub site to see events and RSVP.",
  },
  FortyTwoUnavailable: {
    tone: "danger",
    title: "42 sign-in didn’t complete",
    description: "This 42 account isn’t allowed (1337 campuses only) or the server is busy. Try again, or sign in with your email.",
  },
  OAuthCallbackError: {
    tone: "danger",
    title: "42 sign-in failed",
    description: "Try again, or sign in with your email.",
  },
  Configuration: {
    tone: "danger",
    title: "42 sign-in failed",
    description: "Try again, or sign in with your email.",
  },
  AccessDenied: {
    tone: "warning",
    title: "You can’t open that page",
    description: "Sign in with a club board or administrator account.",
  },
};

const NOTICE_STYLES: Record<Notice["tone"], { box: string; title: string; text: string }> = {
  warning: {
    box: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40",
    title: "text-amber-900 dark:text-amber-200",
    text: "text-amber-800 dark:text-amber-300",
  },
  danger: {
    box: "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-950/40",
    title: "text-rose-800 dark:text-rose-200",
    text: "text-rose-700 dark:text-rose-300",
  },
};

// Same split layout as the student site's login (frontend LoginLayout + LoginPanel): the 1337
// building (vector illustration) on the left from lg, a plain white / slate-950 column with the logo, the title, 42 first,
// then email. The logo sits directly on the page background, the colors it's drawn for.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const session = await auth();
  if (session?.backendToken && !error) redirect("/");
  const notice = error ? NOTICES[error] : undefined;

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Decorative: the form column carries all the meaning. */}
      <div className="relative hidden lg:block">
        <CampusIllustration className="absolute inset-0" />
      </div>

      <div className="flex flex-col bg-white px-6 py-6 dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <Logo className="h-8" />
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[22rem]">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Sign in to manage your club or Campus Hub.
            </p>

            {notice && (
              <div role="alert" className={`mt-7 rounded-lg border p-3 text-sm ${NOTICE_STYLES[notice.tone].box}`}>
                <p className={`font-semibold ${NOTICE_STYLES[notice.tone].title}`}>{notice.title}</p>
                <p className={`mt-1 ${NOTICE_STYLES[notice.tone].text}`}>{notice.description}</p>
              </div>
            )}

            <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />

            <p className="mt-6 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              For club boards and Campus Hub administrators. Students use the Campus Hub site.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
