import { useEffect, useState } from "react";
import { Bell, Component, Home, LogIn, Moon, MonitorSmartphone, Palette, Sun } from "lucide-react";
import { AppShell, type NavItem } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { THEMES, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CONTENT } from "@/showcase/content";
import { AuthScreen, ComponentsScreen, DevicesScreen, HomeScreen, SettingsScreen } from "@/showcase/screens";

const embed = new URLSearchParams(location.search).has("embed");

const NAV: NavItem[] = [
  { id: "home", label: "الرئيسية", icon: Home, badge: 3 },
  { id: "components", label: "المكوّنات", icon: Component },
  { id: "auth", label: "الدخول", icon: LogIn },
  ...(embed ? [] : [{ id: "devices", label: "الأجهزة", icon: MonitorSmartphone }]),
  { id: "settings", label: "الثيمات", icon: Palette },
];

function useHashRoute(fallback: string) {
  const read = () => location.hash.replace("#", "") || fallback;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  });
  return [route, (r: string) => { location.hash = r; window.scrollTo({ top: 0 }); }] as const;
}

export default function App() {
  const [route, go] = useHashRoute("home");
  const { theme, setTheme, mode, setMode } = useTheme();
  const c = CONTENT[theme];

  const screens: Record<string, React.ReactNode> = {
    home: <HomeScreen />, components: <ComponentsScreen />, auth: <AuthScreen />, devices: <DevicesScreen />, settings: <SettingsScreen />,
  };

  return (
    <AppShell
      brand={{ name: c.app, logo: <c.logo /> }}
      nav={NAV}
      active={route}
      onNavigate={go}
      topBar={
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display font-bold md:hidden">{c.app}</div>
            {/* theme chips — horizontal scroller without a visible scrollbar */}
            <div className="scroller hidden gap-1.5 md:flex">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => { setTheme(t.id); setMode(t.defaultDark ? "dark" : "light"); }}
                  className={cn("h-9 rounded-full px-3.5 text-sm font-medium transition-colors", theme === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="الإشعارات" className="relative"><Bell /><span className="absolute top-2.5 end-2.5 size-2 rounded-full bg-destructive ring-2 ring-background" /></Button>
          <Button variant="ghost" size="icon" aria-label="تبديل المظهر" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>{mode === "dark" ? <Sun /> : <Moon />}</Button>
        </div>
      }
    >
      {screens[route] ?? <HomeScreen />}
    </AppShell>
  );
}
