"use client";
import * as React from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "lumrik:theme";

interface ThemeCtx {
  theme: ThemePref;
  resolved: "light" | "dark";
  setTheme: (t: ThemePref) => void;
}
const Ctx = React.createContext<ThemeCtx | null>(null);

/** Inline script (runs before paint) so the correct theme is applied without a flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePref>("system");
  const [systemDark, setSystemDark] = React.useState(false);

  React.useEffect(() => {
    try {
      setThemeState((localStorage.getItem(KEY) as ThemePref) || "system");
    } catch {
      /* storage unavailable */
    }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = React.useCallback((t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useTheme must be used inside ThemeProvider");
  return c;
}
