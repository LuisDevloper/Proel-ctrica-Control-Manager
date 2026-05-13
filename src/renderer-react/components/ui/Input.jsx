import React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(
        "w-full rounded-xl border border-[#355071] bg-[#1a2534] text-[#eaf2fb] px-3 py-2 text-sm outline-none transition-all",
        "placeholder:text-[#9ab0c7]",
        "focus:border-[#2f8dff] focus:ring-2 focus:ring-[#2f8dff33]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-[#355071] bg-[#1a2534] text-[#eaf2fb] px-3 py-2 text-sm outline-none transition-all",
        "focus:border-[#2f8dff] focus:ring-2 focus:ring-[#2f8dff33]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-[#355071] bg-[#1a2534] text-[#eaf2fb] px-3 py-2 text-sm outline-none transition-all resize-none",
        "placeholder:text-[#9ab0c7]",
        "focus:border-[#2f8dff] focus:ring-2 focus:ring-[#2f8dff33]",
        className
      )}
      rows={3}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn("block text-xs font-medium text-[#9ab0c7] mb-1", className)} {...props}>
      {children}
    </label>
  );
}

export function Field({ label, children, className }) {
  const autoId = React.useId();
  let control = children;
  let labelFor = autoId;

  if (React.isValidElement(children)) {
    const existingId = children.props.id;
    labelFor = existingId || autoId;
    if (!existingId) {
      control = React.cloneElement(children, { id: autoId });
    }
  }

  return (
    <div className={cn("mb-3", className)}>
      {label && <Label htmlFor={labelFor}>{label}</Label>}
      {control}
    </div>
  );
}
