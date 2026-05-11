import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-gradient-to-b from-[#2f8dff] to-[#1763d1] text-white hover:brightness-110",
  secondary: "bg-gradient-to-b from-[#4b5c71] to-[#3b495b] text-white hover:brightness-110",
  danger: "bg-gradient-to-b from-[#cb5959] to-[#a33d3d] text-white hover:brightness-110",
  ghost: "bg-[#223146] border border-[#2f4867] text-[#eaf2fb] hover:bg-[#2a3f59]",
  link: "text-[#2f8dff] underline-offset-4 hover:underline bg-transparent p-0 h-auto"
};

const sizes = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-xl",
  lg: "text-base px-5 py-2.5 rounded-xl",
  icon: "w-9 h-9 p-0 flex items-center justify-center rounded-xl"
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
        "font-semibold cursor-pointer transition-all duration-150 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none",
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
