import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

export function EmptyState({ message = "No hay datos para mostrar.", className, icon: Icon = Inbox }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 px-4 rounded-xl",
        "border border-dashed border-[var(--border)] bg-[var(--panel-deep)]/50",
        className
      )}
    >
      <Icon size={28} className="text-[var(--faint)] opacity-80" aria-hidden />
      <p className="text-sm text-[var(--muted)] text-center max-w-sm">{message}</p>
    </div>
  );
}
