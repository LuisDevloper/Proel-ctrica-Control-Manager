import React, { useState, useCallback, lazy, Suspense } from "react";
import { ToastProvider } from "./components/ui/Toast";
import { useTheme } from "./context/ThemeContext";
import { SplashScreen } from "./components/ui/SplashScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { NotificationBell } from "./components/ui/NotificationBell";
import { UpdateBanner } from "./components/ui/UpdateBanner";
import { Login } from "./views/Login";

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


export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [user, setUser]             = useState(null);
  const [view, setView]             = useState("dashboard");
  const [collapsed, setCollapsed]   = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [fadingOut, setFadingOut]   = useState(false);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  function handleLogout() {
    setFadingOut(true);
    setTimeout(() => {
      setUser(null);
      setView("dashboard");
      setFadingOut(false);
    }, 350);
  }

  if (!splashDone) {
    return <SplashScreen onFinish={handleSplashDone} />;
  }

  if (!user) {
    return (
      <ToastProvider>
        <div className="animate-pageFadeIn">
          <Login onLogin={setUser} />
        </div>
      </ToastProvider>
    );
  }

  const ViewComponent = VIEWS[view] || Dashboard;

  return (
    <ToastProvider>
      <div
        className="flex gap-4 min-h-screen p-4 animate-pageFadeIn"
        style={{ transition: "opacity 0.35s ease", opacity: fadingOut ? 0 : 1 }}
      >
        {/* Sidebar */}
        <div className="shrink-0">
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

        {/* Contenido principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          {/* Barra superior — campanita a la derecha */}
          <header className="flex items-center justify-end py-2 px-1 mb-1">
            <NotificationBell />
          </header>

          {/* Vista activa */}
          <main className="flex-1 min-w-0">
            <UpdateBanner />
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
    </ToastProvider>
  );
}
