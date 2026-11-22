import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { LOCALE_INFO } from "@/i18n/config";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/ui/layout/AppShell";
import { CampusBackground } from "@/components/ui/layout/CampusBackground";
import { Footer, FooterBrand, FooterLegal, FooterNav } from "@/components/ui/layout/Footer";
import { getSessionState } from "@/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Arabic pages only (globals.css: html:lang(ar)). Not preloaded: English and French pages never download it.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Campus Hub | Club & Event Management",
  description: "Centralized event hub and collaboration platform for UM6P and 1337 clubs.",
};

export const viewport: Viewport = {
  // Lets the page extend under the iPhone notch/home indicator; the shell pads itself with env(safe-area-inset-*)
  viewportFit: "cover",
  // Browser UI colour matches the navbar surface in each theme
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Site-wide campus backdrop: line-art opacity multiplier (1 = tuned default, 0 = off). 0.8 keeps it quiet
// behind text-heavy pages. One number to tune (DOCS.md §3.11).
const BACKGROUND_INTENSITY = 0.8;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The real session (Auth.js cookie), read on the server for every request, so the first HTML already
  // shows the right navbar ("Log in" or the avatar), with no flash. Reading cookies makes every page
  // render per request (they already did: connection() in each page). DOCS.md §7.6.
  const session = await getSessionState();
  // The student's language (cookie, or the browser's on a first visit: src/i18n/request.ts). dir="rtl" for
  // Arabic mirrors the whole layout; lang picks fonts, hyphenation and the screen reader's voice. DOCS.md §12.1.
  const locale = await getLocale();

  return (
    // suppressHydrationWarning: browsers and extensions add attributes to <html> before React loads
    // (e.g. Chrome on Android adds __gcrremoteframetoken). It ignores attribute differences on this one
    // tag only; mismatches inside the page are still reported.
    <html
      lang={locale}
      dir={LOCALE_INFO[locale].dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Fixed, behind everything (z-index -1), decorative. Rendered once: its SVG ids are global. */}
        <CampusBackground intensity={BACKGROUND_INTENSITY} />
        {/* Gives Client Components the locale, messages and time zone of this request (useTranslations). */}
        <NextIntlClientProvider>
          <ToastProvider>
            <SessionProvider initialSession={session}>
              {/* Footer is built here, on the server, and passed through the client shell as a slot */}
              <AppShell
                footer={
                  <Footer>
                    <FooterBrand />
                    <FooterNav />
                    <FooterLegal />
                  </Footer>
                }
              >
                {children}
              </AppShell>
            </SessionProvider>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
