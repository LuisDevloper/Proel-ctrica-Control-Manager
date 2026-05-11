import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Cpu, Wrench, AlertTriangle, Users, Package, LogOut,
  PanelLeftClose, PanelLeftOpen, Settings, CalendarDays, Sun, Moon
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { AppLogo } from "../ui/AppLogo";

const NAV_ITEMS = [
  { view: "dashboard",      label: "Dashboard",       icon: LayoutDashboard },
  { view: "motores",        label: "Motores",          icon: Cpu },
  { view: "mantenimientos", label: "Mantenimientos",   icon: Wrench },
  { view: "fallas",         label: "Fallas",           icon: AlertTriangle },
  { view: "tecnicos",       label: "Tecnicos",         icon: Users },
  { view: "inventario",     label: "Inventario",       icon: Package },
  { view: "calendario",     label: "Calendario",       icon: CalendarDays },
  { view: "configuracion",  label: "Configuracion",    icon: Settings },
];

export function Sidebar({ currentView, onNavigate, user, onLogout, collapsed, onToggle, theme, onThemeToggle }) {
  const [dbStatus, setDbStatus] = useState(null); // null=checking, true=ok, false=error

  useEffect(() => {
    function check() {
      window.proelectricaApi.dbPing()
        .then(r => setDbStatus(r.ok))
        .catch(() => setDbStatus(false));
    }
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className={cn(
      "flex flex-col gap-3 h-[calc(100vh-48px)] sticky top-6",
      "bg-gradient-to-b from-[#122033ee] to-[#101926ee] border border-[#2a3d57]",
      "rounded-2xl shadow-xl backdrop-blur-sm transition-all duration-300",
      collapsed ? "w-[64px] px-2 py-3" : "w-[260px] px-4 py-4"
    )}>

      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
        {collapsed && <AppLogo size="sm" />}
        <button
          onClick={onToggle}
          className="text-[#9ab0c7] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          title={collapsed ? "Expandir menu" : "Contraer menu"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {!collapsed && (
        <div className="pb-3 border-b border-[#2a3d57]">
          <AppLogo size="md" className="mb-2" />
          <h2 className="text-base font-bold text-[#eaf2fb] leading-tight">Proelectrica</h2>
          <p className="text-xs text-[#9ab0c7] mt-0.5">Control Manager</p>
          {user && (
            <p className="text-xs text-[#9ab0c7] mt-2 pt-2 border-t border-[#2a3d57]">
              {user.username}
              <span className="ml-1 text-[#5fb3ff]">({user.role})</span>
            </p>
          )}
        </div>
      )}

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 text-left w-full border-none cursor-pointer",
                active
                  ? "bg-gradient-to-r from-[#2b75cf] to-[#1f58a8] text-white shadow-lg shadow-blue-900/30"
                  : "text-[#9ab0c7] hover:text-[#eaf2fb] hover:bg-white/5",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Toggle de tema */}
      <div className={cn("pb-1", collapsed && "flex justify-center")}>
        <button
          onClick={onThemeToggle}
          title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer border-none",
            "text-[#9ab0c7] hover:text-[#eaf2fb] hover:bg-white/5",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "light" ? <Moon size={17} className="shrink-0"/> : <Sun size={17} className="shrink-0"/>}
          {!collapsed && <span>{theme === "light" ? "Modo oscuro" : "Modo claro"}</span>}
        </button>
      </div>

      {/* Indicador BD */}
      <div className={cn("border-t border-[#2a3d57] pt-3", collapsed && "flex justify-center")}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-[#0a141e]">
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              dbStatus === null  && "bg-[#9ab0c7] animate-pulse",
              dbStatus === true  && "bg-[#39d48f]",
              dbStatus === false && "bg-[#e07070] animate-pulse"
            )} />
            <span className="text-[11px] text-[#9ab0c7]">
              {dbStatus === null  ? "Verificando BD..." :
               dbStatus === true  ? "Base de datos OK" :
               "Error de conexion"}
            </span>
          </div>
        )}
        {collapsed && (
          <div title={dbStatus === true ? "BD conectada" : dbStatus === false ? "Error BD" : "Verificando..."} className="mb-2">
            <span className={cn(
              "block w-2.5 h-2.5 rounded-full mx-auto",
              dbStatus === null  && "bg-[#9ab0c7] animate-pulse",
              dbStatus === true  && "bg-[#39d48f]",
              dbStatus === false && "bg-[#e07070] animate-pulse"
            )} />
          </div>
        )}
      </div>

      <div className="border-t border-[#2a3d57] pt-3">
        <button
          onClick={onLogout}
          title={collapsed ? "Cerrar sesion" : undefined}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium",
            "text-[#9ab0c7] hover:text-[#e07070] hover:bg-[#2e1212]/60 transition-all cursor-pointer border-none",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </aside>
  );
}
