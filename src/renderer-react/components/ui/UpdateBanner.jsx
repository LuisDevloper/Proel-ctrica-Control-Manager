import React, { useEffect, useState } from "react";
import { Download, RefreshCw, CheckCircle, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function UpdateBanner() {
  const [state, setState] = useState(null);
  // state: null | { event, version?, percent?, message? }

  useEffect(() => {
    if (!window.proelectricaApi?.onUpdaterEvent) return;
    const unsub = window.proelectricaApi.onUpdaterEvent((data) => {
      if (data.event === "checking") {
        setState({ event: "checking" });
        return;
      }
      if (data.event === "up-to-date") {
        setState((prev) => (prev?.event === "checking" ? null : prev));
        return;
      }
      if (data.event === "error") {
        const msg = String(data.message || "");
        const is404 = /404|not found|Cannot find latest\.yml|latest\.yml/i.test(msg);
        if (is404) {
          setState({
            event: "error",
            message:
              "GitHub no devolvió latest.yml o el release no tiene el instalador publicado. En cada release deben estar el .exe y el archivo latest.yml generado por electron-builder (carpeta dist). La etiqueta del release debe ser una versión mayor que la instalada.",
          });
          return;
        }
      }
      setState(data);
    });
    return unsub;
  }, []);

  if (!state) return null;

  const { event, version, percent, message } = state;

  const configs = {
    checking: {
      icon: Loader2,
      bg: "bg-[var(--panel-deep)]/80 border-[var(--border)]/60",
      text: "text-[var(--muted)]",
      msg: "Comprobando actualizaciones…",
      showClose: false,
    },
    available: {
      icon: Download,
      bg: "bg-[#0d1e38] border-[#2f8dff]/40",
      text: "text-[#7ab8ff]",
      msg: `Nueva versión ${version} disponible. Descargando en segundo plano...`,
      showClose: false,
    },
    downloading: {
      icon: RefreshCw,
      bg: "bg-[#0d1e38] border-[#2f8dff]/40",
      text: "text-[#7ab8ff]",
      msg: `Descargando actualización... ${percent ?? 0}%`,
      showClose: false,
    },
    downloaded: {
      icon: CheckCircle,
      bg: "bg-[#0d2517] border-[#29a16a]/40",
      text: "text-[#5edc9e]",
      msg: `Versión ${version} lista. Se instalará al cerrar la app.`,
      showClose: true,
      action: { label: "Instalar ahora", onClick: () => window.proelectricaApi.installUpdate() },
    },
    error: {
      icon: X,
      bg: "bg-[#2e1212] border-[#c94a4a]/40",
      text: "text-[#e07070]",
      msg: `Error de actualización: ${message}`,
      showClose: true,
    },
  };

  const cfg = configs[event];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const discrete = event === "checking";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border font-medium mb-3 transition-all",
        discrete ? "px-3 py-1.5 text-[11px] gap-2 opacity-90" : "px-4 py-2.5 text-xs",
        cfg.bg, cfg.text
      )}
      role={
        event === "checking"
          ? "status"
          : event === "error"
            ? "alert"
            : undefined
      }
      aria-live={event === "checking" ? "polite" : event === "error" ? "assertive" : undefined}
    >
      <Icon
        size={14}
        className={cn("shrink-0", (event === "downloading" || event === "checking") && "animate-spin")}
        aria-hidden
      />
      <span className="flex-1">{cfg.msg}</span>

      {event === "downloading" && (
        <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2f8dff] transition-all duration-300"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      )}

      {cfg.action && (
        <button
          onClick={cfg.action.onClick}
          className="px-3 py-1 rounded-lg bg-[#29a16a]/20 hover:bg-[#29a16a]/40 text-[#5edc9e] transition-colors cursor-pointer border-none text-xs font-semibold"
        >
          {cfg.action.label}
        </button>
      )}

      {cfg.showClose && (
        <button
          onClick={() => setState(null)}
          className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent p-0.5"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
