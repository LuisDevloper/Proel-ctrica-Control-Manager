import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Wrench, AlertTriangle, Package, X } from "lucide-react";
import { cn } from "../../lib/utils";

const TYPE_CONFIG = {
  maintenance: { icon: Wrench,        color: "text-[#2f8dff]", bg: "bg-[#0d1e38]", dot: "bg-[#2f8dff]",  label: "Mantenimiento próximo" },
  failure:     { icon: AlertTriangle, color: "text-[#e0a91f]", bg: "bg-[#2b2208]", dot: "bg-[#e0a91f]",  label: "Falla pendiente"       },
  stock:       { icon: Package,       color: "text-[#e07070]", bg: "bg-[#2e1212]", dot: "bg-[#e07070]",  label: "Stock mínimo"          },
};

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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Cierra al hacer clic fuera
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = items.length;

  return (
    <div ref={ref} className="relative">
      {/* Botón de la campana */}
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
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white bg-[#e0a91f] leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[340px]">
          <div className="pcm-glass-strong rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b pcm-glass-divider">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[#9ab0c7]" />
                <span className="text-sm font-semibold text-[#eaf2fb]">Notificaciones</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e0a91f]/20 text-[#e0a91f]">
                    {count}
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
            <div className="max-h-[420px] overflow-y-auto">
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
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.failure;
                const Icon = cfg.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 border-b border-[#1a2534] last:border-0 hover:bg-[#0a1624] transition-colors"
                  >
                    <div className={cn("p-2 rounded-xl mt-0.5 shrink-0", cfg.bg)}>
                      <Icon size={13} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#eaf2fb] leading-tight">{item.title}</p>
                      <p className="text-[11px] text-[#9ab0c7] mt-0.5 truncate">{item.body}</p>
                      {item.date && (
                        <p className="text-[10px] text-[#4a6a8a] mt-0.5">{item.date}</p>
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
                {loading ? "Actualizando..." : "Se actualiza cada 30 segundos"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
