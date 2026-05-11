import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default:    "bg-[#1a2e46] text-[#9ab0c7] border border-[#2a3d57]",
  success:    "bg-[#0d2e1e] text-[#39d48f] border border-[#1a5c3a]",
  warning:    "bg-[#2b2208] text-[#e0a91f] border border-[#5a440f]",
  danger:     "bg-[#2e1212] text-[#e07070] border border-[#5c2222]",
  info:       "bg-[#0d1e38] text-[#5fb3ff] border border-[#1a3a6e]",
};

export function Badge({ children, variant = "default", className }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

export function statusBadgeVariant(status) {
  const map = {
    "Operativo": "success",
    "En mantenimiento": "warning",
    "Fuera de servicio": "danger",
    "Pendiente": "warning",
    "En proceso": "info",
    "Resuelta": "success",
    "Alta": "danger",
    "Media": "warning",
    "Baja": "default",
    "Preventivo": "info",
    "Correctivo": "warning"
  };
  return map[status] || "default";
}
