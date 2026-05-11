import React, { useState } from "react";
import { ToastProvider } from "./components/ui/Toast";
import { useTheme } from "./context/ThemeContext";
import { SplashScreen } from "./components/ui/SplashScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { NotificationBell } from "./components/ui/NotificationBell";
import { UpdateBanner } from "./components/ui/UpdateBanner";
import { Login } from "./views/Login";
import { Dashboard } from "./views/Dashboard";
import { Motores } from "./views/Motores";
import { Mantenimientos } from "./views/Mantenimientos";
import { Fallas } from "./views/Fallas";
import { Tecnicos } from "./views/Tecnicos";
import { Inventario } from "./views/Inventario";
import { Configuracion } from "./views/Configuracion";
import { Calendario } from "./views/Calendario";

const VIEWS = {
  dashboard: Dashboard, motores: Motores, mantenimientos: Mantenimientos,
  fallas: Fallas, tecnicos: Tecnicos, inventario: Inventario,
  calendario: Calendario, configuracion: Configuracion,
};


export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [user, setUser]             = useState(null);
  const [view, setView]             = useState("dashboard");
  const [collapsed, setCollapsed]   = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  if (!user) {
    return (
      <ToastProvider>
        <Login onLogin={setUser} />
      </ToastProvider>
    );
  }

  const ViewComponent = VIEWS[view] || Dashboard;

  return (
    <ToastProvider>
      <div className="flex gap-4 min-h-screen p-4">
        {/* Sidebar */}
        <div className="shrink-0">
          <Sidebar
            currentView={view}
            onNavigate={setView}
            user={user}
            onLogout={() => { setUser(null); setView("dashboard"); }}
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
            <ViewComponent user={user} />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
