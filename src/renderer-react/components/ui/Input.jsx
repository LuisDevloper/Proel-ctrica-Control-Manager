import React from "react";
import { cn } from "../../lib/utils";

const fieldBase =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--text)] px-3 py-2 text-sm outline-none transition-all duration-150 placeholder:text-[var(--faint)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_28%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className, type = "text", ...props }) {
  return (
    <input
      type={type}
      className={cn(fieldBase, className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(fieldBase, "cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(fieldBase, "resize-none min-h-[4.5rem]", className)}
      rows={3}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }) {
  return (
    <label className={cn("block text-xs font-medium text-[var(--muted)] mb-1", className)} {...props}>
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
