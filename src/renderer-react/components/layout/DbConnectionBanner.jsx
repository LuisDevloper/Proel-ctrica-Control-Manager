import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";

/**
 * Aviso claro cuando la base de datos no responde (tras comprobar al iniciar y cada 20s).
 */
export function DbConnectionBanner() {
  const [status, setStatus] = useState(null); // null = comprobando, true = ok, false = error
  const [retrying, setRetrying] = useState(false);

  const ping = useCallback(async () => {
    try {
      const r = await window.proelectricaApi.dbPing();
      setStatus(r?.ok === true);
    } catch {
      setStatus(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.proelectricaApi.dbPing();
        if (!cancelled) setStatus(r?.ok === true);
      } catch {
        if (!cancelled) setStatus(false);
      }
    })();
    const id = setInterval(() => { if (!cancelled) ping(); }, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [ping]);

  async function handleRetry() {
    setRetrying(true);
    setStatus(null);
    await ping();
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
          La app puede no guardar cambios. Comprueba que el disco este disponible y reinicia si el problema continua.
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
