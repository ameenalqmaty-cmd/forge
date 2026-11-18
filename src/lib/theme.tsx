import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { safeStorage } from "./utils";

export const THEMES = [
  { id: "calm", name: "هادئ احترافي", hint: "أعمال · إدارة · مالية", defaultDark: false },
  { id: "playful", name: "مرح ملوّن", hint: "اجتماعي · أصدقاء · طعام", defaultDark: false },
  { id: "luxe", name: "فاخر", hint: "حجوزات · عقارات · مناسبات", defaultDark: true },
  { id: "edu", name: "تعليمي دافئ", hint: "تعليم · تحفيظ · صحة", defaultDark: false },
  { id: "game", name: "ألعاب نيون", hint: "ألعاب · تحديات · ترفيه", defaultDark: true },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
type Mode = "light" | "dark";

type Ctx = { theme: ThemeId; mode: Mode; setTheme: (t: ThemeId) => void; setMode: (m: Mode) => void };
const ThemeCtx = createContext<Ctx | null>(null);

/**
 * Apps built from forge fix ONE theme: <ThemeProvider defaultTheme="edu" />.
 * Light/dark follows the system unless the user picks one.
 */
export function ThemeProvider({ children, defaultTheme = "calm" }: { children: ReactNode; defaultTheme?: ThemeId }) {
  const [theme, setThemeState] = useState<ThemeId>(() => (safeStorage.get("forge.theme") as ThemeId) || defaultTheme);
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = safeStorage.get("forge.mode") as Mode | null;
    if (saved) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", mode === "dark");
    // keep browser/status-bar color in sync with the theme
    const bg = getComputedStyle(root).getPropertyValue("--background").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [theme, mode]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    safeStorage.set("forge.theme", t);
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    safeStorage.set("forge.mode", m);
  };

  return <ThemeCtx.Provider value={{ theme, mode, setTheme, setMode }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
