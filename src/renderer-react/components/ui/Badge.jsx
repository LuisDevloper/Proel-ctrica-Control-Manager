import React from "react";
import { cn } from "../../lib/utils";
import { logisticsStatusShortLabel } from "../../lib/equipment";

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
    "En almacen": "info",
    "En almacén": "info",
    "Fuera de servicio": "danger",
    "Pendiente": "warning",
    "En progreso": "info",
    "En proceso": "info",
    "Completado": "success",
    "Resuelta": "success",
    "Alta": "danger",
    "Media": "warning",
    "Baja": "default",
    "Preventivo": "info",
    "Correctivo": "warning"
  };
  return map[status] || "default";
}

/** Indicadores operativos con color semantico (verde/amarillo/azul/rojo). */
export function OperationalStatusBadge({ status, className }) {
  const styles = {
    "Operativo": "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]",
    "En mantenimiento": "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
    "En almacen": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
    "En almacén": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
    "Fuera de servicio": "bg-[#e0707022] text-[#e07070] border border-[#e0707044]",
    "Pendiente": "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
    "Completado": "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]",
    "En progreso": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
  };
  return (
    <span className={cn(
      "text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center",
      styles[status] || styles["Pendiente"],
      className
    )}>
      {status || "Pendiente"}
    </span>
  );
}

/** Ubicacion operativa con color semantico. */
export function OperationalLocationBadge({ location, className }) {
  const styles = {
    "En planta": "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]",
    "Afuera": "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
    "Taller externo": "bg-[#a855f722] text-[#c084fc] border border-[#a855f744]",
    "Almacen": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
    "En almacén": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
    "En mantenimiento": "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
  };
  const label = location || "En planta";
  return (
    <span className={cn(
      "text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center",
      styles[label] || styles["En planta"],
      className
    )}>
      {label}
    </span>
  );
}

/** Estado de movimiento de almacen. */
export function MovementTypeBadge({ type, className }) {
  const isIn = type === "entrada";
  return (
    <span className={cn(
      "text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center border",
      isIn
        ? "bg-[#29a16a22] text-[#29a16a] border-[#29a16a44]"
        : type === "salida"
          ? "bg-[#e0707022] text-[#e07070] border-[#e0707044]"
          : "bg-[#2f8dff22] text-[#5fb3ff] border border-[#2f8dff44]",
      className
    )}>
      {type === "entrada" ? "Entrada" : type === "salida" ? "Salida" : "Ajuste"}
    </span>
  );
}

/** Estado logistico de envio a taller externo. */
export function LogisticsStatusBadge({ status, className, compact = false }) {
  const styles = {
    "Permiso de salida aprobado": "bg-[#2f8dff22] text-[#5fb3ff] border border-[#2f8dff44]",
    "Equipo en transito": "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
    "Entrada registrada": "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]",
    "Equipo entregado": "bg-[#a855f722] text-[#c084fc] border border-[#a855f744]",
  };
  const full = status || "Permiso de salida aprobado";
  const label = compact ? logisticsStatusShortLabel(full) : full;
  const tooltip = compact
    ? `${full} — Etapa logistica del envio (no indica si el PDF ya fue firmado)`
    : undefined;
  return (
    <span
      title={tooltip}
      className={cn(
        "text-[11px] font-semibold px-2.5 py-1 border inline-flex items-center justify-center text-center leading-tight",
        compact ? "rounded-lg whitespace-nowrap max-w-full" : "rounded-full py-0.5 whitespace-nowrap",
        styles[full] || styles["Permiso de salida aprobado"],
        className
      )}
    >
      {label}
    </span>
  );
}

/** Estado logistica + indicador de PDF firmado adjunto. */
export function ShipmentStatusCell({ logisticsStatus, signedPermitDocId }) {
  return (
    <div className="flex flex-col gap-1.5 items-start">
      <LogisticsStatusBadge status={logisticsStatus} compact />
      {signedPermitDocId ? (
        <span className="text-[10px] font-semibold text-[#29a16a]">PDF firmado adjunto</span>
      ) : (
        <span className="text-[10px] font-semibold text-[#e0a91f]">Firmas pendientes</span>
      )}
    </div>
  );
}
