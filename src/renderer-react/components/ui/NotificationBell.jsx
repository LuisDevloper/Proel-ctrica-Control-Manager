import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Wrench, AlertTriangle, Package, X, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

const TYPE_CONFIG = {
  overdue_maintenance: {
    icon: Clock,
    color: "text-[#e07070]",
    bg: "bg-[#2e1212]",
    dot: "bg-[#e07070]",
    label: "Mantenimiento vencido",
  },
  maintenance: {
    icon: Wrench,
    color: "text-[#2f8dff]",
    bg: "bg-[#0d1e38]",
    dot: "bg-[#2f8dff]",
    label: "Mantenimiento próximo",
  },
  stalled_failure: {
    icon: AlertTriangle,
    color: "text-[#e07070]",
    bg: "bg-[#2e1212]",
    dot: "bg-[#e07070]",
    label: "Falla sin resolver",
  },
  failure: {
    icon: AlertTriangle,
    color: "text-[#e0a91f]",
    bg: "bg-[#2b2208]",
    dot: "bg-[#e0a91f]",
    label: "Falla pendiente",
  },
  stock: {
    icon: Package,
    color: "text-[#e07070]",
    bg: "bg-[#2e1212]",
    dot: "bg-[#e07070]",
    label: "Stock mínimo",
  },
};

function UrgencyBadge({ urgency, daysLate }) {
  if (urgency !== "high" || !daysLate || Number(daysLate) <= 0) return null;
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#e07070]/15 text-[#e07070] border border-[#e07070]/20">
      +{daysLate}d
    </span>
  );
}

export function NotificationBell() {
  const [items, setItems]     = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    window.proelectricaApi.getNotifications()
      .then((rows) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const highCount = items.filter(i => i.urgency === "high").length;
  const count     = items.length;

  // Color de badge: rojo si hay alertas críticas, amarillo si solo hay medias
  const badgeBg = highCount > 0 ? "bg-[#e07070]" : "bg-[#e0a91f]";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        title="Notificaciones"
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer border-none",
          open
            ? "pcm-glass-subtle text-white"
            : "text-[#9ab0c7] hover:text-[#eaf2fb] hover:bg-white/8"
        )}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white leading-none",
            badgeBg
          )}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[360px]">
          <div className="pcm-glass-strong rounded-2xl overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-center justify-between px-4 py-3 border-b pcm-glass-divider">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[#9ab0c7]" />
                <span className="text-sm font-semibold text-[#eaf2fb]">Notificaciones</span>
                {highCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e07070]/20 text-[#e07070]">
                    {highCount} crítica{highCount > 1 ? "s" : ""}
                  </span>
                )}
                {count > highCount && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e0a91f]/20 text-[#e0a91f]">
                    {count - highCount} media{count - highCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#9ab0c7] hover:text-white transition-colors p-1 rounded cursor-pointer border-none bg-transparent"
              >
                <X size={14} />
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-[460px] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-[#2a3d57] border-t-[#2f8dff] animate-spin" />
                </div>
              )}

              {!loading && count === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-[#111a27] flex items-center justify-center">
                    <Bell size={22} className="text-[#2a3d57]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#eaf2fb]">Sin alertas</p>
                    <p className="text-xs text-[#4a6a8a] mt-0.5">Todo está en orden.</p>
                  </div>
                </div>
              )}

              {!loading && items.map((item, i) => {
                const cfg  = TYPE_CONFIG[item.type] || TYPE_CONFIG.failure;
                const Icon = cfg.icon;
                const isHigh = item.urgency === "high";
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-[#1a2534] last:border-0 transition-colors",
                      isHigh ? "hover:bg-[#1c0e0e]" : "hover:bg-[#0a1624]"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl mt-0.5 shrink-0", cfg.bg)}>
                      <Icon size={13} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-[#eaf2fb] leading-tight">{item.title}</p>
                        <UrgencyBadge urgency={item.urgency} daysLate={item.days_late} />
                      </div>
                      <p className="text-[11px] text-[#9ab0c7] mt-0.5 truncate">{item.body}</p>
                      {item.date && (
                        <p className="text-[10px] text-[#4a6a8a] mt-0.5">
                          {String(item.date).slice(0, 10)}
                        </p>
                      )}
                    </div>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-2", cfg.dot)} />
                  </div>
                );
              })}
            </div>

            {/* Pie */}
            <div className="px-4 py-2 border-t pcm-glass-divider pcm-glass-subtle">
              <p className="text-[10px] text-[#4a6a8a] text-center">
                {loading ? "Actualizando..." : "Se actualiza cada 60 segundos"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
