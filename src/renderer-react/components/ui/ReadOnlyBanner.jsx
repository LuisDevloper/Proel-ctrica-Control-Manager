import React from "react";
import { Eye } from "lucide-react";
import { cn } from "../../lib/utils";

export function ReadOnlyBanner({ message, className }) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "pcm-readonly-banner flex items-start gap-2 text-sm",
        className
      )}
      role="status"
    >
      <Eye size={16} className="shrink-0 mt-0.5 text-[var(--primary)]" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
