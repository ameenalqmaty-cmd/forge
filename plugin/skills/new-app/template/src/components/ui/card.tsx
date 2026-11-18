import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive, ...p }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-card",
        interactive && "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]",
        className,
      )}
      {...p}
    />
  );
}
export const CardHeader = ({ className, ...p }: ComponentProps<"div">) => <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />;
export const CardTitle = ({ className, ...p }: ComponentProps<"h3">) => <h3 className={cn("text-fluid-lg font-semibold", className)} {...p} />;
export const CardDescription = ({ className, ...p }: ComponentProps<"p">) => <p className={cn("text-sm text-muted-foreground", className)} {...p} />;
export const CardContent = ({ className, ...p }: ComponentProps<"div">) => <div className={cn("p-5 pt-0", className)} {...p} />;
export const CardFooter = ({ className, ...p }: ComponentProps<"div">) => <div className={cn("flex items-center gap-2 p-5 pt-0", className)} {...p} />;
