import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/ui/layout/AppShell";
import { CampusBackground } from "@/components/ui/layout/CampusBackground";
import { Footer, FooterBrand, FooterLegal, FooterNav } from "@/components/ui/layout/Footer";
import { mockCurrentUser } from "@/lib/mockData";
import { SessionState } from "@/types/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

// Mock until Phase 5 reads the real session (cookie / auth API) here on the server
const INITIAL_SESSION: SessionState = { status: "signed-in", user: mockCurrentUser };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: browsers and extensions add attributes to <html> before React loads
    // (e.g. Chrome on Android adds __gcrremoteframetoken). It ignores attribute differences on this one
    // tag only; mismatches inside the page are still reported.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Fixed, behind everything (z-index -1), decorative. Rendered once: its SVG ids are global. */}
        <CampusBackground intensity={BACKGROUND_INTENSITY} />
        <ToastProvider>
          <SessionProvider initialSession={INITIAL_SESSION}>
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
      </body>
    </html>
  );
}
