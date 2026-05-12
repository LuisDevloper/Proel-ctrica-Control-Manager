import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Cpu, Wrench, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { SkeletonStatCards, SkeletonCard } from "../components/ui/Skeleton";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from "recharts";

const MOTOR_COLORS = {
  "Operativo":          "#29a16a",
  "En mantenimiento":   "#e0a91f",
  "Fuera de servicio":  "#c94a4a"
};

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmtMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y.slice(2)}`;
}

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

const tooltipStyle = {
  contentStyle: { background: "#111d2c", border: "1px solid #2a3d57", borderRadius: 10, color: "#eaf2fb", fontSize: 12 },
  cursor: { fill: "#ffffff08" }
};

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

  const pieData  = (charts?.motorsByStatus || []).map(r => ({ name: r.status, value: r.count }));
  const barData  = (charts?.maintenancesByMonth || []).map(r => ({ mes: fmtMonth(r.month), total: r.count }));
  const lineData = (charts?.failuresByMonth || []).map(r => ({ mes: fmtMonth(r.month), fallas: r.count }));

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

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Cpu}           label="Motores"           value={stats?.totalMotors}       color="text-[#2f8dff]" />
        <StatCard icon={Wrench}        label="Mantenimientos"    value={stats?.totalMaintenances} color="text-[#39d48f]" />
        <StatCard icon={AlertTriangle} label="Fallas pendientes" value={stats?.pendingFailures}   color="text-[#e0a91f]" />
        <StatCard icon={Package}       label="Stock minimo"      value={stats?.lowStockItems}     color="text-[#e07070]" />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pastel estado de motores */}
        <Card>
          <CardHeader><CardTitle>Estado de motores</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0
              ? <p className="text-sm text-[#9ab0c7]">Sin datos.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={MOTOR_COLORS[entry.name] || "#4a6a8a"} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend formatter={(v) => <span className="text-xs text-[#9ab0c7]">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
            }
          </CardContent>
        </Card>

        {/* Barras mantenimientos por mes */}
        <Card>
          <CardHeader><CardTitle>Mantenimientos por mes</CardTitle></CardHeader>
          <CardContent>
            {barData.length === 0
              ? <p className="text-sm text-[#9ab0c7]">Sin datos en los ultimos 12 meses.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2f44" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: "#9ab0c7", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#9ab0c7", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="total" name="Mantenimientos" fill="#2f8dff" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </CardContent>
        </Card>

        {/* Línea fallas en el tiempo */}
        <Card>
          <CardHeader><CardTitle>Fallas en el tiempo</CardTitle></CardHeader>
          <CardContent>
            {lineData.length === 0
              ? <p className="text-sm text-[#9ab0c7]">Sin datos en los ultimos 12 meses.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="fallaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#e0a91f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#e0a91f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2f44" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: "#9ab0c7", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#9ab0c7", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="fallas" name="Fallas" stroke="#e0a91f" fill="url(#fallaGrad)" strokeWidth={2} dot={{ fill: "#e0a91f", r: 3, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
            }
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
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
