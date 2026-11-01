import Image from "next/image";
import LoginForm from "@/components/LoginForm";
import ThemeToggle from "@/components/ui/ThemeToggle";

export const metadata = { title: "Sign in · CampusPulse" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2 dark:bg-slate-950">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>
      {/* Left: photo (hidden on small screens) */}
      <div className="relative hidden lg:block">
        <Image
          src="/UM6P_Campus.webp"
          alt="Campus building with orange concrete columns and glass facade"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[22rem]">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sign in to manage your club on CampusPulse.
          </p>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
