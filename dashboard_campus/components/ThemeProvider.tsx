"use client";

import { useSyncExternalStore } from "react";

// Light/dark theme. The source of truth is the `dark` class on <html>, set
// before the first paint by THEME_SCRIPT (in the root layout) so there is no
// flash. React reads it through useSyncExternalStore: the server snapshot is
// "light", the browser reads the real class right after hydration, so server
// and client HTML never disagree (no hydration error).

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "campushub-theme";

/** Runs in <head> before paint: saved choice, else the system preference. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    theme,
    toggleTheme: () => applyTheme(theme === "dark" ? "light" : "dark"),
  };
}
