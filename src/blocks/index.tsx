/**
 * Ready-made blocks. Compose screens from these before writing new markup.
 * All blocks are responsive and theme-aware out of the box.
 */
import { ChevronLeft, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pct } from "@/lib/format";
import { Card } from "@/components/ui/card";

/** KPI tile. Put 2 on phone, 3–4 on tablet/desktop: grid-cols-2 lg:grid-cols-4 */
export function StatCard({ icon: Icon, label, value, delta, tone = "primary" }: {
  icon: LucideIcon; label: string; value: string; delta?: number; tone?: "primary" | "accent" | "success" | "warning";
}) {
  const toneCls = { primary: "bg-primary/12 text-primary", accent: "bg-accent/18 text-accent-foreground dark:text-accent", success: "bg-success/15 text-success", warning: "bg-warning/20 text-foreground" }[tone];
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("grid size-10 place-items-center rounded-lg", toneCls)}><Icon className="size-5" /></span>
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {pct(Math.abs(delta))}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-fluid-xl font-bold tabular">{value}</div>
        <div className="truncate text-xs text-muted-foreground sm:text-sm">{label}</div>
      </div>
    </Card>
  );
}

/** Tappable row for lists (people, items, orders, lessons…). */
export function ListRow({ leading, title, subtitle, trailing, onClick, chevron = true }: {
  leading?: ReactNode; title: string; subtitle?: string; trailing?: ReactNode; onClick?: () => void; chevron?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/60 active:bg-muted">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {trailing}
      {chevron && <ChevronLeft className="size-4.5 shrink-0 text-muted-foreground/60" />}
    </button>
  );
}

/** Grouped list container (iOS-settings style). */
export function ListGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">{title}</h2>}
      <Card className="divide-y divide-border overflow-hidden p-0">{children}</Card>
    </section>
  );
}

/** Section title with optional "see all" action. */
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-fluid-lg font-bold">{title}</h2>
      {action}
    </div>
  );
}

/** Hero / highlight card with gradient. */
export function HeroCard({ eyebrow, title, body, action, icon: Icon }: { eyebrow?: string; title: string; body?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),black_8%),color-mix(in_oklch,var(--primary),black_42%))] p-5 text-white dark:bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),black_22%),color-mix(in_oklch,var(--primary),black_55%))] shadow-card sm:p-7">
      <div className="pointer-events-none absolute -top-16 -start-10 size-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 end-0 size-64 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1 text-xs font-medium opacity-80 sm:text-sm">{eyebrow}</div>}
          <h2 className="text-fluid-xl font-bold">{title}</h2>
          {body && <p className="mt-1.5 max-w-md text-sm opacity-85">{body}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
        {Icon && <Icon className="hidden size-16 shrink-0 opacity-25 xs:block sm:size-20" strokeWidth={1.5} />}
      </div>
    </div>
  );
}
