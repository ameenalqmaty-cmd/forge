import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, icon, ...p }: ComponentProps<"input"> & { icon?: ReactNode }) {
  return (
    <div className="relative w-full" dir={p.dir}>
      {icon && <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted-foreground [&_svg]:size-5">{icon}</span>}
      <input
        className={cn(
          "h-12 w-full min-w-0 rounded-lg border border-input bg-card px-4 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-ring focus:ring-4 focus:ring-ring/15 disabled:opacity-50",
          icon && "ps-11",
          className,
        )}
        {...p}
      />
    </div>
  );
}

export function Label({ className, ...p }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...p} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="w-full">
      <Label>{label}</Label>
      {children}
      {(error || hint) && <p className={cn("mt-1.5 text-xs", error ? "text-destructive" : "text-muted-foreground")}>{error || hint}</p>}
    </div>
  );
}
