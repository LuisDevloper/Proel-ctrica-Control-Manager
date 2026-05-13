import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LabelList
} from "recharts";

const MOTOR_COLORS = {
  "Operativo":         "#29a16a",
  "En mantenimiento":  "#e0a91f",
  "Fuera de servicio": "#c94a4a"
};

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
export function DashboardCharts({ charts }) {
  const { theme } = useTheme();
  const tickColor  = theme === "light" ? "#475569" : "#9ab0c7";
  const gridColor  = theme === "light" ? "#e2e8f0" : "#1e2f44";
  const labelColor = theme === "light" ? "#64748b" : "#9ab0c7";

  const pieData  = (charts?.motorsByStatus || []).map(r => ({ name: r.status, value: r.count }));
  const barData  = (charts?.maintenancesByMonth || []).map(r => ({ mes: fmtMonth(r.month), mesFull: fmtMonthFull(r.month), total: r.count }));
  const lineData = (charts?.failuresByMonth || []).map(r => ({ mes: fmtMonth(r.month), mesFull: fmtMonthFull(r.month), fallas: r.count }));
  const costData = (charts?.costByMotor || []).map(r => ({ motor: r.motor, total: Number(r.total || 0) }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        <Card>
          <CardHeader><CardTitle>Mantenimientos por mes</CardTitle></CardHeader>
          <CardContent>
            {barData.length === 0
              ? <p className="text-sm text-[#9ab0c7]">Sin datos en los ultimos 12 meses.</p>
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
          <CardHeader><CardTitle>Costo acumulado por motor</CardTitle></CardHeader>
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
  );
}
