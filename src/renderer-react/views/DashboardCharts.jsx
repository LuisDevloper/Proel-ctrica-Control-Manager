import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import {
  PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LabelList
} from "recharts";

const EQUIPMENT_COLORS = {
  "Operativo":         "#29a16a",
  "En mantenimiento":  "#e0a91f",
  "En almacen":        "#2f8dff",
  "Fuera de servicio": "#c94a4a"
};

const EQUIPMENT_STATUS_ORDER = ["Operativo", "En mantenimiento", "En almacen", "Fuera de servicio"];

function countByStatus(raw) {
  return (raw || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

function reconcileTurbinasStatus(raw, totalFromStats) {
  const rows = [...(raw || [])];
  const listed = countByStatus(rows);
  const expected = Number(totalFromStats);
  if (!Number.isFinite(expected) || expected <= listed) return rows;
  const extra = expected - listed;
  const operativo = rows.find((r) => r.status === "Operativo");
  if (operativo) operativo.count = Number(operativo.count) + extra;
  else rows.push({ status: "Operativo", count: extra });
  return rows;
}

function mergeEquipmentStatusCounts(motorsRaw, turbinasRaw) {
  const map = Object.fromEntries(EQUIPMENT_STATUS_ORDER.map((status) => [status, 0]));
  for (const row of [...(motorsRaw || []), ...(turbinasRaw || [])]) {
    const status = row.status;
    if (status in map) map[status] += Number(row.count) || 0;
    else map[status] = (map[status] || 0) + (Number(row.count) || 0);
  }
  return EQUIPMENT_STATUS_ORDER.map((status) => ({ status, count: map[status] || 0 }));
}

function buildEquipmentStatusSeries(merged) {
  return (merged || [])
    .map((r) => ({ name: r.status, value: Number(r.count) || 0 }))
    .filter((d) => d.value > 0);
}

function buildEquipmentStatusLegend(merged) {
  const total = (merged || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
  return EQUIPMENT_STATUS_ORDER.map((status) => {
    const row = (merged || []).find((r) => r.status === status);
    const value = Number(row?.count) || 0;
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return { status, value, pct, color: EQUIPMENT_COLORS[status] };
  });
}

function TooltipEquipmentStatus({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item.name;
  const value = item.value;
  const total = item.payload?.total ?? value;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ background: "#111d2c", border: "1px solid #2a3d57", borderRadius: 8, padding: "8px 14px", fontSize: 12 }}>
      <p style={{ color: "#eaf2fb", fontWeight: 600, marginBottom: 4 }}>{name}</p>
      <p style={{ color: EQUIPMENT_COLORS[name] || "#9ab0c7" }}>
        {value} equipo{value !== 1 ? "s" : ""} ({pct}%)
      </p>
    </div>
  );
}

function EquipmentStatusCenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox || {};
  if (cx == null || cy == null) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.35em" fill="#eaf2fb" fontSize={22} fontWeight={700}>
        {total}
      </tspan>
      <tspan x={cx} dy="1.35em" fill="#9ab0c7" fontSize={11}>
        {total === 1 ? "equipo" : "equipos"}
      </tspan>
    </text>
  );
}

function MotorStatusLegend({ items }) {
  return (
    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[var(--border-soft)] list-none m-0 p-0">
      {items.map(({ status, value, pct, color }) => (
        <li key={status} className="flex flex-col items-center gap-1 text-center min-w-0 px-1">
          <span className="flex items-center gap-1.5 w-full justify-center">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden />
            <span className="text-[10px] text-[var(--muted)] leading-tight truncate" title={status}>
              {status}
            </span>
          </span>
          <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
            {value}
            <span className="text-[var(--faint)] font-normal"> · {pct}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const MONTH_NAMES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_NAMES_FULL  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function fmtMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES_SHORT[idx]} ${y}`;
}
function fmtMonthFull(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES_FULL[idx]} ${y}`;
}

const tooltipStyle = {
  contentStyle: { background: "#111d2c", border: "1px solid #2a3d57", borderRadius: 10, color: "#eaf2fb", fontSize: 12 },
  cursor: { fill: "#ffffff08" }
};

function TooltipMantenimientos({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"#111d2c", border:"1px solid #2a3d57", borderRadius:8, padding:"8px 14px", fontSize:12 }}>
      <p style={{ color:"#9ab0c7", marginBottom:4 }}>{d.mesFull}</p>
      <p style={{ color:"#2f8dff", fontWeight:600 }}>Mantenimientos: {d.total}</p>
    </div>
  );
}

function TooltipFallas({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"#111d2c", border:"1px solid #2a3d57", borderRadius:8, padding:"8px 14px", fontSize:12 }}>
      <p style={{ color:"#9ab0c7", marginBottom:4 }}>{d.mesFull}</p>
      <p style={{ color:"#e0a91f", fontWeight:600 }}>Fallas: {d.fallas}</p>
    </div>
  );
}

function TooltipCostos({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:"#111d2c", border:"1px solid #2a3d57", borderRadius:8, padding:"8px 14px", fontSize:12 }}>
      <p style={{ color:"#9ab0c7", marginBottom:4 }}>Motor: {d.motor}</p>
      <p style={{ color:"#29a16a", fontWeight:600 }}>
        {"$" + Number(d.total).toLocaleString("es-CO")}
      </p>
    </div>
  );
}

/** Bloque pesado (Recharts) cargado en chunk separado desde Dashboard. */
export function DashboardCharts({ charts, stats, periodLabel, loading = false }) {
  const { theme } = useTheme();
  const tickColor  = theme === "light" ? "#475569" : "#9ab0c7";
  const gridColor  = theme === "light" ? "#e2e8f0" : "#1e2f44";
  const labelColor = theme === "light" ? "#64748b" : "#9ab0c7";

  const motorStatusRaw = charts?.motorsByStatus || [];
  const turbinaStatusRaw = reconcileTurbinasStatus(
    charts?.turbinasByStatus,
    stats?.totalTurbinas
  );
  const equipmentStatusMerged = mergeEquipmentStatusCounts(motorStatusRaw, turbinaStatusRaw);
  const motorTotal = Number(stats?.totalMotors) || countByStatus(motorStatusRaw);
  const turbinaTotal = Number(stats?.totalTurbinas) || countByStatus(turbinaStatusRaw);
  const equipmentTotal = motorTotal + turbinaTotal;
  const pieData = buildEquipmentStatusSeries(equipmentStatusMerged).map((d) => ({ ...d, total: equipmentTotal }));
  const equipmentLegend = buildEquipmentStatusLegend(equipmentStatusMerged);
  const barData  = (charts?.maintenancesByMonth || []).map(r => ({ mes: fmtMonth(r.month), mesFull: fmtMonthFull(r.month), total: r.count }));
  const lineData = (charts?.failuresByMonth || []).map(r => ({ mes: fmtMonth(r.month), mesFull: fmtMonthFull(r.month), fallas: r.count }));
  const costData = (charts?.costByMotor || []).map(r => ({ motor: r.motor, total: Number(r.total || 0) }));
  const label = periodLabel || charts?.periodLabel || charts?.year || new Date().getFullYear();

  return (
    <div className={loading ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Estado de equipos</CardTitle></CardHeader>
          <CardContent>
            {equipmentTotal === 0
              ? <EmptyState message="No hay motores ni turbinas registrados." className="py-10" />
              : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={pieData.length > 1 ? 2 : 0}
                        dataKey="value"
                        stroke="#0a0f14"
                        strokeWidth={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={EQUIPMENT_COLORS[entry.name] || "#4a6a8a"} />
                        ))}
                        <Label content={(props) => <EquipmentStatusCenterLabel {...props} total={equipmentTotal} />} position="center" />
                      </Pie>
                      <Tooltip content={<TooltipEquipmentStatus />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[11px] text-[var(--muted)] -mt-1 mb-1">
                    Motores: {motorTotal} · Turbinas: {turbinaTotal}
                  </p>
                  <MotorStatusLegend items={equipmentLegend} />
                </>
              )
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mantenimientos por mes ({label})</CardTitle></CardHeader>
          <CardContent>
            {barData.every((row) => row.total === 0)
              ? <p className="text-sm text-[#9ab0c7]">Sin mantenimientos registrados en {label}.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<TooltipMantenimientos />} cursor={{ fill: "#ffffff08" }} />
                    <Bar dataKey="total" name="Mantenimientos" fill="#2f8dff" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fallas en el tiempo ({label})</CardTitle></CardHeader>
          <CardContent>
            {lineData.every((row) => row.fallas === 0)
              ? <p className="text-sm text-[#9ab0c7]">Sin fallas registradas en {label}.</p>
              : <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="fallaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#e0a91f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#e0a91f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<TooltipFallas />} cursor={{ stroke: "#ffffff20", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="fallas" name="Fallas" stroke="#e0a91f" fill="url(#fallaGrad)" strokeWidth={2} dot={{ fill: "#e0a91f", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#e0a91f" }} />
                  </AreaChart>
                </ResponsiveContainer>
            }
          </CardContent>
        </Card>
      </div>

      {costData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Costo acumulado por motor ({label})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(80, costData.length * 48 + 40)}>
              <BarChart data={costData} layout="vertical" margin={{ left: 0, right: 80, top: 4, bottom: 4 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: tickColor, fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => "$" + Number(v).toLocaleString("es-CO")}
                />
                <YAxis type="category" dataKey="motor" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip content={<TooltipCostos />} cursor={{ fill: "#ffffff06" }} />
                <Bar dataKey="total" name="Costo" fill="#29a16a" radius={[0,6,6,0]} maxBarSize={26}>
                  <LabelList
                    dataKey="total"
                    position="right"
                    formatter={v => "$" + Number(v).toLocaleString("es-CO")}
                    style={{ fill: labelColor, fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
    </div>
  );
}
