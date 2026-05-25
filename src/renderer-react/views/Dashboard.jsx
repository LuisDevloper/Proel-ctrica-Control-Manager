import React, { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select, Field } from "../components/ui/Input";
import { Wrench, AlertTriangle, Package, TrendingUp, Fan, FileText, CalendarDays } from "lucide-react";
import { ElectricMotorIcon } from "../components/icons/ElectricMotorIcon";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { SkeletonStatCards, SkeletonCard } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";
import { exportDashboardPDF } from "../lib/pdfReport";

const DashboardCharts = lazy(() =>
  import("./DashboardCharts.jsx").then((m) => ({ default: m.DashboardCharts }))
);

const DASHBOARD_MONTHS = [
  { value: "", label: "Todos los meses" },
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

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
  const currentYear = new Date().getFullYear();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [availableYears, setAvailableYears] = useState([String(currentYear)]);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const { showToast } = useToast();

  const loadCharts = useCallback(async (selectedYear, selectedMonth, silent = false) => {
    if (!silent) setChartsLoading(true);
    try {
      const data = await window.proelectricaApi.getDashboardCharts({
        year: selectedYear,
        month: selectedMonth || undefined,
      });
      setCharts(data);
      if (Array.isArray(data?.availableYears) && data.availableYears.length) {
        setAvailableYears(data.availableYears);
      }
    } catch {
      showToast("No se pudieron cargar las gráficas del dashboard.", "warning");
    } finally {
      if (!silent) setChartsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    window.proelectricaApi.getDashboardStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) showToast("No se pudo cargar el dashboard.", "warning");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    loadCharts(year, month);
  }, [year, month, loadCharts]);

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
    stats?.pendingShipments > 0     && `${stats.pendingShipments} equipos en taller externo (envio abierto).`,
  ].filter(Boolean);

  function handleExportPdf() {
    if (!stats) {
      showToast("No hay datos del dashboard para exportar.", "warning");
      return;
    }
    exportDashboardPDF(stats, charts, year, month);
    showToast("Reporte PDF generado.", "success");
  }

  const periodLabel = charts?.periodLabel || String(charts?.year || year);
  const yearTotals = charts?.yearTotals;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo del sistema. Las tarjetas superiores muestran el estado actual; las gráficas usan el año y mes seleccionados."
        className="mb-1"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Año" className="mb-0 min-w-[110px]">
              <Select
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label="Filtrar gráficas por año"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mes" className="mb-0 min-w-[150px]">
              <Select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Filtrar gráficas por mes"
              >
                {DASHBOARD_MONTHS.map((m) => (
                  <option key={m.value || "all"} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" size="sm" onClick={handleExportPdf} className="mb-0.5">
              <FileText size={13} className="mr-1" /> Exportar PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={ElectricMotorIcon} label="Motores"           value={stats?.totalMotors}       color="text-[#2f8dff]" />
        <StatCard icon={Fan}           label="Turbinas"          value={stats?.totalTurbinas}     color="text-[#c084fc]" />
        <StatCard icon={Wrench}        label="Mantenimientos"    value={stats?.totalMaintenances} color="text-[#39d48f]" />
        <StatCard icon={AlertTriangle} label="Fallas pendientes" value={stats?.pendingFailures}   color="text-[#e0a91f]" />
        <StatCard icon={Package}       label="Stock minimo"      value={stats?.lowStockItems}     color="text-[#e07070]" />
      </div>

      {(yearTotals || chartsLoading) && (
        <Card className="border-[var(--border-soft)]">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <CalendarDays size={16} className="text-[#2f8dff] shrink-0" />
              <span className="text-[var(--muted)]">
                Resumen de <strong className="text-[var(--text)]">{periodLabel}</strong>
                {chartsLoading ? " — actualizando..." : ""}
              </span>
              {!chartsLoading && yearTotals && (
                <>
                  <span className="text-[var(--faint)]">|</span>
                  <span className="text-[var(--text)]">{yearTotals.maintenancesInYear ?? 0} mantenimientos</span>
                  <span className="text-[var(--faint)]">·</span>
                  <span className="text-[var(--text)]">{yearTotals.failuresInYear ?? 0} fallas</span>
                  <span className="text-[var(--faint)]">·</span>
                  <span className="text-[var(--text)]">
                    ${Number(yearTotals.maintenanceCostInYear || 0).toLocaleString("es-CO")} en costos
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/5 border border-[#2a3d57]/50" />
            ))}
          </div>
        }
      >
        <DashboardCharts charts={charts} stats={stats} periodLabel={periodLabel} loading={chartsLoading} />
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
