import React, { useState, useCallback, useRef, lazy, Suspense, useEffect } from "react";
import { ToastProvider } from "./components/ui/Toast";
import { useTheme } from "./context/ThemeContext";
import { DbHealthProvider, useDbHealth } from "./context/DbHealthContext";
import { SplashScreen } from "./components/ui/SplashScreen";
import { Sidebar, NAV_ITEMS } from "./components/layout/Sidebar";
import { NotificationBell } from "./components/ui/NotificationBell";
import { GlobalSearch } from "./components/ui/GlobalSearch";
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
  const [navState, setNavState]     = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [fadingOut, setFadingOut]   = useState(false);

  const navigateTo = useCallback((targetView, state = {}) => {
    setView(targetView);
    setNavState(state);
  }, []);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  // ── handleLogout definido antes de cualquier useEffect que lo use ─────────
  const handleLogout = useCallback((reason = "manual") => {
    setFadingOut(true);
    setTimeout(async () => {
      try {
        await window.proelectricaApi?.logout?.();
        if (reason === "inactivity") {
          showToast("Sesion cerrada automaticamente por inactividad.", "info");
        } else {
          showToast("Sesion cerrada correctamente.", "info");
        }
      } catch {
        showToast("No se pudo cerrar la sesion en el servidor.", "warning");
      }
      setUser(null);
      setView("dashboard");
      setFadingOut(false);
    }, 350);
  }, [showToast]);

  // ── Refs para el timer de inactividad ────────────────────────────────────
  const IDLE_MS        = 5 * 60 * 1000;
  const WARN_MS        = IDLE_MS - 30 * 1000;
  const warnTimerRef   = useRef(null);
  const logoutTimerRef = useRef(null);
  const lastResetRef   = useRef(0);

  useEffect(() => {
    if (!user) return;
    const views = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((i) => i.view);
    function onKey(e) {
      // Bloquear zoom con teclado (Ctrl +/- /0)
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
        e.preventDefault();
        return;
      }
      // Ctrl+K — búsqueda global
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
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
  }, [user, handleLogout, toggleTheme, showToast, dbRefresh]);

  useEffect(() => {
    if (!splashDone) return;
    document.documentElement.toggleAttribute("data-guest-login", !user);
    return () => document.documentElement.removeAttribute("data-guest-login");
  }, [splashDone, user]);

  // Notificar al usuario si se migraron datos locales a la nube en este inicio
  useEffect(() => {
    if (!splashDone) return;
    const api = window.proelectricaApi;
    if (!api?.getMigrationStatus) return;
    api.getMigrationStatus().then((stats) => {
      if (!stats) return;
      const total = Object.values(stats).reduce((s, n) => s + (n || 0), 0);
      showToast(
        `Datos locales migrados a la nube correctamente (${total} registros).`,
        "success"
      );
    }).catch(() => {});
  }, [splashDone]);

  // ── Auto-logout por inactividad (5 minutos) ───────────────────────────────
  useEffect(() => {
    if (!user) return;

    function resetTimers() {
      // Throttle: ignorar eventos que lleguen con menos de 1s de diferencia
      const now = Date.now();
      if (now - lastResetRef.current < 1000) return;
      lastResetRef.current = now;

      clearTimeout(warnTimerRef.current);
      clearTimeout(logoutTimerRef.current);

      warnTimerRef.current = setTimeout(() => {
        showToast(
          "Tu sesion se cerrara en 30 segundos por inactividad. Mueve el raton o presiona una tecla para continuar.",
          "warning",
          { duration: 30000 }
        );
      }, WARN_MS);

      logoutTimerRef.current = setTimeout(() => {
        handleLogout("inactivity");
      }, IDLE_MS);
    }

    const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"];
    EVENTS.forEach((ev) => window.addEventListener(ev, resetTimers, { passive: true }));
    resetTimers(); // iniciar temporizador al hacer login

    return () => {
      clearTimeout(warnTimerRef.current);
      clearTimeout(logoutTimerRef.current);
      EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimers));
    };
  }, [user, handleLogout, showToast]);

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
              <header className="flex items-center justify-between py-2 px-1 mb-1 shrink-0 gap-2">
                {/* Botón de búsqueda global */}
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a3d57] bg-[#0d1825]/60 text-[#4a6a8a] hover:text-[#9ab0c7] hover:border-[#3a5470] transition-colors text-sm"
                  title="Búsqueda global (Ctrl+K)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span className="hidden sm:inline">Buscar...</span>
                  <kbd className="hidden sm:inline text-[10px] border border-[#2a3d57] rounded px-1 py-0.5 font-mono">Ctrl K</kbd>
                </button>
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
                  <ViewComponent
                    user={user}
                    navState={navState}
                    onNavDone={() => setNavState({})}
                    onNavigate={navigateTo}
                  />
                </Suspense>
              </main>
            </div>

            {/* Búsqueda global */}
            <GlobalSearch
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              onNavigate={navigateTo}
            />
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
