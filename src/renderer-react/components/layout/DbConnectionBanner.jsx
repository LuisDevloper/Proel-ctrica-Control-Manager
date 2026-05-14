import React, { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { useDbHealth } from "../../context/DbHealthContext";

/**
 * Aviso cuando la base de datos no responde (estado global en DbHealthProvider).
 */
export function DbConnectionBanner() {
  const { status, refresh } = useDbHealth();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    await refresh();
    setRetrying(false);
  }

  if (status !== false) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-[#c94a4a]/50 bg-[#2e1212]/85 px-4 py-3 text-sm text-[#fecaca] mb-3"
    >
      <AlertTriangle size={18} className="shrink-0 text-[#f87171]" aria-hidden />
      <div className="flex-1 min-w-[200px]">
        <p className="font-semibold text-[#fef2f2]">No hay conexion con la base de datos</p>
        <p className="text-xs text-[#fca5a5]/90 mt-0.5">
          Las acciones de guardado estan desactivadas hasta que vuelva la conexion.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="border border-[#c94a4a]/40 text-[#fecaca] hover:bg-white/5"
        disabled={retrying}
        onClick={handleRetry}
      >
        <RefreshCw size={14} className={`mr-1 ${retrying ? "animate-spin" : ""}`} />
        Reintentar
      </Button>
    </div>
  );
}
