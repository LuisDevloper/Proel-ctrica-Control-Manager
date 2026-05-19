import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)]",
        "bg-gradient-to-b from-[color-mix(in_srgb,var(--panel)_92%,transparent)] to-[color-mix(in_srgb,var(--panel-deep)_95%,transparent)]",
        "shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm",
        "transition-shadow duration-200 hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn("px-5 pt-5 pb-3 border-b border-[var(--border-soft)]", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn("text-base font-semibold text-[var(--text)] tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children }) {
  return (
    <div className={cn("px-5 py-4", className)}>
      {children}
    </div>
  );
}
