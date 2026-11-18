import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Progress({ value = 0, className, indicatorClassName }: { value?: number; className?: string; indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root value={value} className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500 ease-out", indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, marginInlineStart: 0 }}
      />
    </ProgressPrimitive.Root>
  );
}

export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <AvatarPrimitive.Root className={cn("relative inline-flex size-11 shrink-0 overflow-hidden rounded-full bg-secondary", className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center text-sm font-semibold text-secondary-foreground">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export const Skeleton = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("animate-pulse rounded-md bg-muted", className)} {...p} />
);

export const Separator = ({ className }: { className?: string }) => <div role="separator" className={cn("h-px w-full bg-border", className)} />;

/** Every list/screen MUST have an empty state — never a blank area. */
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-secondary text-secondary-foreground [&_svg]:size-7">{icon}</div>
      <h3 className="text-fluid-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
