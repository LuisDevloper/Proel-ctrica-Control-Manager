import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "bg-gradient-to-b from-[var(--primary)] to-[#1763d1] text-white hover:brightness-110 shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
  secondary:
    "bg-gradient-to-b from-[#4b5c71] to-[#3b495b] text-white hover:brightness-110",
  danger:
    "bg-gradient-to-b from-[var(--danger)] to-[#a33d3d] text-white hover:brightness-110",
  ghost:
    "bg-[var(--panel-soft)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover)]",
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
