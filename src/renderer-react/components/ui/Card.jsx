import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#2a3d57] bg-gradient-to-b from-[#122033ee] to-[#101926ee]",
        "shadow-[0_12px_24px_#00000033] backdrop-blur-sm",
        "transition-all duration-200",
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
    <div className={cn("px-5 pt-5 pb-3 border-b border-[#2a3d57]", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn("text-base font-semibold text-[#d8e6f5] tracking-tight", className)}>
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
