import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { id: string; label: string; icon: LucideIcon; badge?: number };

/**
 * Responsive app frame — the ONLY layout apps should use.
 *  phone  (<768):  sticky top bar + fixed bottom tab bar
 *  tablet (768+):  side rail (icons + labels)
 *  laptop (1024+): full sidebar
 * Content is width-capped so it never stretches awkwardly on big screens.
 */
export function AppShell({
  brand, nav, active, onNavigate, topBar, children,
}: {
  brand: { name: string; logo: ReactNode };
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  topBar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen-safe md:flex">
      {/* Side navigation: tablet + desktop */}
      <aside className="sticky top-0 hidden h-screen-safe shrink-0 flex-col border-e border-border bg-card/60 pt-safe backdrop-blur md:flex md:w-24 lg:w-64">
        <div className="flex h-16 items-center gap-3 px-5 md:justify-center lg:justify-start">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-5">{brand.logo}</div>
          <span className="hidden font-display text-lg font-bold lg:block">{brand.name}</span>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => {
            const on = item.id === active;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "md:flex-col md:gap-1 md:px-1 md:text-[0.7rem] lg:flex-row lg:gap-3 lg:px-3 lg:text-sm",
                  on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" strokeWidth={on ? 2.4 : 2} />
                <span className="truncate">{item.label}</span>
                {!!item.badge && <span className="absolute top-1.5 end-3 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-white md:end-4 lg:static lg:ms-auto">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 pt-safe backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground md:hidden [&_svg]:size-5">{brand.logo}</div>
            <div className="min-w-0 flex-1">{topBar}</div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      {/* Bottom tab bar: phones only */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-safe backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-16 max-w-md items-stretch">
          {nav.map((item) => {
            const on = item.id === active;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={on ? "page" : undefined}
                className={cn("relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors", on ? "text-primary" : "text-muted-foreground")}
              >
                <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", on && "bg-primary/12")}>
                  <item.icon className="size-5" strokeWidth={on ? 2.4 : 2} />
                </span>
                {item.label}
                {!!item.badge && <span className="absolute top-1.5 start-1/2 ms-2 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-white">{item.badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Page header used at the top of every screen. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-fluid-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
