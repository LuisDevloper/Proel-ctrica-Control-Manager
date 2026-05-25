import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "pcm-glass pcm-glass-hover rounded-2xl",
        "transition-[box-shadow,transform] duration-200",
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
    <div className={cn("px-5 pt-5 pb-3 border-b pcm-glass-divider", className)}>
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
