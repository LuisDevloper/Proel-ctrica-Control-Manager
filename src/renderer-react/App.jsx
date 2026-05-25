import React, { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { ToastProvider } from "./components/ui/Toast";
import { useTheme } from "./context/ThemeContext";
import { DbHealthProvider, useDbHealth } from "./context/DbHealthContext";
import { SplashScreen } from "./components/ui/SplashScreen";
import { Sidebar, NAV_ITEMS } from "./components/layout/Sidebar";
import { NotificationBell } from "./components/ui/NotificationBell";
import { UpdateBanner } from "./components/ui/UpdateBanner";
import { DbConnectionBanner } from "./components/layout/DbConnectionBanner";
import { PendingUpdateReminder } from "./components/layout/PendingUpdateReminder";
import { Login } from "./views/Login";
import { LoginBackdrop } from "./components/ui/LoginBackdrop";
import { useToast } from "./components/ui/Toast";

// Carga diferida — cada vista se descarga solo cuando se navega a ella
const Dashboard      = lazy(() => import("./views/Dashboard").then(m => ({ default: m.Dashboard })));
const Motores        = lazy(() => import("./views/Motores").then(m => ({ default: m.Motores })));
const Mantenimientos = lazy(() => import("./views/Mantenimientos").then(m => ({ default: m.Mantenimientos })));
const Fallas         = lazy(() => import("./views/Fallas").then(m => ({ default: m.Fallas })));
const Tecnicos       = lazy(() => import("./views/Tecnicos").then(m => ({ default: m.Tecnicos })));
const Inventario     = lazy(() => import("./views/Inventario").then(m => ({ default: m.Inventario })));
const Configuracion  = lazy(() => import("./views/Configuracion").then(m => ({ default: m.Configuracion })));
const Calendario     = lazy(() => import("./views/Calendario").then(m => ({ default: m.Calendario })));
const Usuarios       = lazy(() => import("./views/Usuarios").then(m => ({ default: m.Usuarios })));
const ActividadLog   = lazy(() => import("./views/ActividadLog").then(m => ({ default: m.ActividadLog })));

const VIEWS = {
  dashboard: Dashboard, motores: Motores, mantenimientos: Mantenimientos,
  fallas: Fallas, tecnicos: Tecnicos, inventario: Inventario,
  calendario: Calendario, configuracion: Configuracion,
  usuarios: Usuarios, actividad: ActividadLog,
};


function AppContent() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { refresh: dbRefresh } = useDbHealth();
  const [user, setUser]             = useState(null);
  const [view, setView]             = useState("dashboard");
  const [collapsed, setCollapsed]   = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [fadingOut, setFadingOut]   = useState(false);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    if (!user) return;
    const views = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((i) => i.view);
    function onKey(e) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const n = parseInt(e.key, 10);
      if (!Number.isFinite(n) || n < 1 || n > 9) return;
      const view = views[n - 1];
      if (view) {
        e.preventDefault();
        setView(view);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, user?.role]);

  useEffect(() => {
    const api = window.proelectricaApi;
    if (!api?.onMenuAction) return;
    const unsub = api.onMenuAction(async ({ action, view, adminOnly }) => {
      switch (action) {
        case "navigate": {
          if (!user) {
            showToast("Inicia sesion para navegar.", "warning");
            return;
          }
          if (adminOnly && user.role !== "ADMIN") {
            showToast("Solo administradores pueden acceder a esta seccion.", "warning");
            return;
          }
          if (view && VIEWS[view]) setView(view);
          break;
        }
        case "logout":
          if (user) handleLogout();
          break;
        case "theme-toggle":
          toggleTheme();
          break;
        case "backup": {
          if (!user) {
            showToast("Inicia sesion para crear una copia de seguridad.", "warning");
            return;
          }
          const res = await api.backupDb();
          if (res?.ok) showToast("Copia de seguridad guardada.", "success");
          else if (res?.message && res.message !== "Cancelado") showToast(res.message, "warning");
          break;
        }
        case "restore": {
          if (!user) {
            showToast("Inicia sesion para restaurar la base de datos.", "warning");
            return;
          }
          const res = await api.restoreDb();
          if (res?.ok) {
            showToast("Base de datos restaurada. Reinicia la aplicacion si ves datos antiguos.", "success");
            dbRefresh?.();
          } else if (res?.message && res.message !== "Cancelado") {
            showToast(res.message, "warning");
          }
          break;
        }
        case "check-updates": {
          if (import.meta.env?.DEV) {
            showToast("Las actualizaciones solo estan disponibles en la version instalada.", "info");
            return;
          }
          const res = await api.checkForUpdates?.();
          if (res?.ok && res.updateAvailable) showToast("Hay una actualizacion disponible.", "info");
          else if (res?.ok) showToast("Ya tienes la ultima version.", "success");
          else if (res?.reason === "dev") showToast("Modo desarrollo: sin comprobacion de actualizaciones.", "info");
          else showToast(res?.message || "No se pudo comprobar actualizaciones.", "warning");
          break;
        }
        default:
          break;
      }
    });
    return unsub;
  }, [user, toggleTheme, showToast, dbRefresh]);

  useEffect(() => {
    if (!splashDone) return;
    document.documentElement.toggleAttribute("data-guest-login", !user);
    return () => document.documentElement.removeAttribute("data-guest-login");
  }, [splashDone, user]);

  function handleLogout() {
    setFadingOut(true);
    setTimeout(async () => {
      try {
        await window.proelectricaApi?.logout?.();
        showToast("Sesión cerrada correctamente.", "info");
      } catch {
        showToast("No se pudo cerrar la sesión en el servidor.", "warning");
      }
      setUser(null);
      setView("dashboard");
      setFadingOut(false);
    }, 350);
  }

  if (!splashDone) {
    return <SplashScreen onFinish={handleSplashDone} />;
  }

  const ViewComponent = VIEWS[view] || Dashboard;

  return (
    <>
        <PendingUpdateReminder />
        {!user && <LoginBackdrop />}
        {user ? (
          <div className="sticky top-0 z-50 shrink-0 px-4 pt-3 max-w-5xl mx-auto w-full">
            <UpdateBanner variant="inline" />
          </div>
        ) : (
          <UpdateBanner variant="overlay" />
        )}
        <div className={`min-h-screen max-h-screen flex flex-col overflow-hidden relative z-10${user ? " animate-pageFadeIn" : ""}`}>

        {!user ? (
          <>
            <div className="shrink-0 px-4 max-w-5xl mx-auto w-full">
              <DbConnectionBanner />
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <Login onLogin={setUser} />
            </div>
          </>
        ) : (
          <div
            className="flex gap-4 flex-1 p-4 min-h-0 min-w-0 overflow-hidden"
            style={{ transition: "opacity 0.35s ease", opacity: fadingOut ? 0 : 1 }}
          >
            <div className="shrink-0 min-h-0">
              <Sidebar
                currentView={view}
                onNavigate={setView}
                user={user}
                onLogout={handleLogout}
                collapsed={collapsed}
                onToggle={() => setCollapsed((c) => !c)}
                theme={theme}
                onThemeToggle={toggleTheme}
              />
            </div>

            <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-0 overflow-hidden">
              <header className="flex items-center justify-end py-2 px-1 mb-1 shrink-0">
                <NotificationBell />
              </header>

              <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
                <DbConnectionBanner />
                <Suspense fallback={
                  <div className="flex flex-col gap-4 animate-pulse pt-2">
                    <div className="h-8 w-48 rounded-xl bg-white/5" />
                    <div className="h-4 w-72 rounded-lg bg-white/5" />
                    <div className="grid grid-cols-4 gap-4 mt-2">
                      {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5" />)}
                    </div>
                    <div className="h-64 rounded-2xl bg-white/5 mt-2" />
                  </div>
                }>
                  <ViewComponent user={user} />
                </Suspense>
              </main>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DbHealthProvider>
        <AppContent />
      </DbHealthProvider>
    </ToastProvider>
  );
}
