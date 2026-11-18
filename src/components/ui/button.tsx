import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-95 dark:hover:brightness-125",
        outline: "border border-border bg-card hover:bg-muted",
        ghost: "hover:bg-muted",
        accent: "bg-accent text-accent-foreground hover:brightness-105",
        destructive: "bg-destructive text-white hover:brightness-110",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // min 44px touch target on default/lg (Apple HIG / Material)
        sm: "h-9 px-3 text-sm rounded-md",
        default: "h-11 px-5 text-[0.95rem] rounded-lg",
        lg: "h-13 px-7 text-base rounded-lg",
        icon: "size-11 rounded-lg",
        "icon-sm": "size-9 rounded-md",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className, variant, size, block, asChild = false, ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
export { buttonVariants };
