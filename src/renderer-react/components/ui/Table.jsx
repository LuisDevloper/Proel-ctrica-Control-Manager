import React from "react";
import { cn } from "../../lib/utils";

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a3d57]">
      <table className={cn("w-full border-collapse text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead className="bg-[#0e1826] text-[#9ab0c7] text-xs uppercase tracking-wide">
      {children}
    </thead>
  );
}

export function Th({ children, className }) {
  return (
    <th className={cn("px-4 py-3 text-left font-medium whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-[#1e2f44]">{children}</tbody>;
}

export function Tr({ children, className }) {
  return (
    <tr className={cn("hover:bg-[#0f1e30] transition-colors duration-100", className)}>
      {children}
    </tr>
  );
}

export function Td({ children, className }) {
  return (
    <td className={cn("px-4 py-3 text-[#eaf2fb]", className)}>
      {children}
    </td>
  );
}
