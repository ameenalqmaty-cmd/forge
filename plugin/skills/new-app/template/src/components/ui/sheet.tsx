import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on phones, centered dialog on tablet/desktop — one component, both sizes.
 */
export function Sheet({
  open, onOpenChange, trigger, title, description, children, className,
}: {
  open?: boolean; onOpenChange?: (o: boolean) => void; trigger?: ReactNode;
  title: string; description?: string; children: ReactNode; className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_.2s_ease]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed z-50 flex max-h-[88dvh] flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl outline-none",
            // phone: bottom sheet
            "inset-x-0 bottom-0 rounded-t-2xl pb-safe data-[state=open]:animate-[sheet-up_.28s_cubic-bezier(.2,.9,.3,1)]",
            // tablet+: centered dialog
            "md:inset-auto md:start-1/2 md:top-1/2 md:w-[min(32rem,calc(100vw-3rem))] md:-translate-y-1/2 md:translate-x-1/2 md:rounded-2xl md:pb-0 md:data-[state=open]:animate-[fade-in_.2s_ease]",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
            <div>
              <Dialog.Title className="text-fluid-lg font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="-me-2 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="إغلاق">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pt-2 pb-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export const SheetClose = Dialog.Close;
