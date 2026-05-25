import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "pcm-glass-accent text-white hover:brightness-110 active:brightness-95",
  secondary:
    "pcm-glass-subtle text-[var(--text)] border border-[var(--glass-border-soft)] hover:bg-[var(--hover)]",
  danger:
    "bg-gradient-to-b from-[var(--danger)] to-[#a33d3d] text-white hover:brightness-110 shadow-[0_4px_16px_color-mix(in_srgb,var(--danger)_30%,transparent)]",
  ghost:
    "pcm-glass-subtle text-[var(--text)] hover:bg-[var(--hover)]",
  link: "text-[var(--primary)] underline-offset-4 hover:underline bg-transparent p-0 h-auto font-medium",
};

const sizes = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-xl",
  lg: "text-base px-5 py-2.5 rounded-xl",
  icon: "w-9 h-9 p-0 flex items-center justify-center rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}) {
  return (
    <button
      className={cn(
        "font-semibold cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 border-none outline-none inline-flex items-center justify-center",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
