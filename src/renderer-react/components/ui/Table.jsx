import React from "react";
import { cn } from "../../lib/utils";

export function Table({ children, className }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel-deep)]/40">
      <table className={cn("w-full min-w-full table-fixed border-collapse text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead className="sticky top-0 z-[1] bg-[var(--panel-deep)] text-[var(--muted)] text-xs uppercase tracking-wide shadow-[0_1px_0_var(--border)]">
      {children}
    </thead>
  );
}

export function Th({ children, className }) {
  return (
    <th className={cn("px-4 py-3 text-left font-semibold whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-[var(--border-soft)]">{children}</tbody>;
}

export function Tr({ children, className }) {
  return (
    <tr
      className={cn(
        "transition-colors duration-100",
        "hover:bg-[var(--hover)]",
        "even:bg-[color-mix(in_srgb,var(--panel-soft)_35%,transparent)]",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className, ...props }) {
  return (
    <td className={cn("px-4 py-3 text-[var(--text)] align-middle", className)} {...props}>
      {children}
    </td>
  );
}
