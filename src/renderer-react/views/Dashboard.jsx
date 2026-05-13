import React, { useEffect, useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Cpu, Wrench, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { SkeletonStatCards, SkeletonCard } from "../components/ui/Skeleton";

const DashboardCharts = lazy(() =>
  import("./DashboardCharts.jsx").then((m) => ({ default: m.DashboardCharts }))
);

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="hover:border-[#3a5878]">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`p-2.5 rounded-xl bg-white/5 ${color}`}><Icon size={22} /></div>
        <div>
          <p className="text-2xl font-bold text-[#eaf2fb]">{value ?? "—"}</p>
          <p className="text-xs text-[#9ab0c7]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      window.proelectricaApi.getDashboardStats(),
      window.proelectricaApi.getDashboardCharts()
    ])
      .then(([s, c]) => { setStats(s); setCharts(c); })
      .catch(() => showToast("No se pudo cargar el dashboard.", "warning"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div><div className="h-6 w-40 rounded bg-[#1a2d44] mb-1 animate-shimmer"/><div className="h-3 w-56 rounded bg-[#1a2d44] animate-shimmer"/></div>
        <SkeletonStatCards />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard lines={6}/><SkeletonCard lines={6}/><SkeletonCard lines={6}/>
        </div>
      </div>
    );
  }

  const alerts = [
    stats?.upcomingMaintenances > 0 && `${stats.upcomingMaintenances} mantenimientos en los proximos 7 dias.`,
    stats?.pendingFailures > 0      && `${stats.pendingFailures} fallas pendientes por resolver.`,
    stats?.lowStockItems > 0        && `${stats.lowStockItems} repuestos en stock minimo.`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-[#eaf2fb] mb-1">Dashboard</h2>
        <p className="text-sm text-[#9ab0c7]">Resumen operativo del sistema</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Cpu}           label="Motores"           value={stats?.totalMotors}       color="text-[#2f8dff]" />
        <StatCard icon={Wrench}        label="Mantenimientos"    value={stats?.totalMaintenances} color="text-[#39d48f]" />
        <StatCard icon={AlertTriangle} label="Fallas pendientes" value={stats?.pendingFailures}   color="text-[#e0a91f]" />
        <StatCard icon={Package}       label="Stock minimo"      value={stats?.lowStockItems}     color="text-[#e07070]" />
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/5 border border-[#2a3d57]/50" />
            ))}
          </div>
        }
      >
        <DashboardCharts charts={charts} />
      </Suspense>

      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp size={16} className="text-[#e0a91f]"/> Alertas activas</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="warning">!</Badge>
                  <span className="text-[#eaf2fb]">{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
