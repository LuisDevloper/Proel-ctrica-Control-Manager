import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Table, Thead, Th, Tbody, Tr, Td } from "../ui/Table";
import { Select, Field } from "../ui/Input";
import { Activity, TrendingDown, Timer, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

const fmtCost = (v) => "$" + Number(v || 0).toLocaleString("es-CO");

function MtbfBadge({ days }) {
  if (days == null) return <span className="text-[#4a6a8a] text-xs">N/A</span>;
  const n = Number(days);
  const color = n >= 60 ? "text-[#29a16a]" : n >= 20 ? "text-[#e0a91f]" : "text-[#e07070]";
  return <span className={cn("font-semibold text-xs", color)}>{n}d</span>;
}

function SummaryChip({ label, value, color = "text-[#eaf2fb]" }) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#0d1825] border border-[#2a3d57] rounded-xl px-4 py-3 gap-0.5 min-w-[90px]">
      <span className={cn("text-xl font-bold leading-none", color)}>{value ?? "—"}</span>
      <span className="text-[10px] text-[#4a6a8a] text-center leading-snug mt-0.5">{label}</span>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: "90",  label: "Últimos 3 meses" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último año" },
  { value: "730", label: "Últimos 2 años" },
];

export function ReliabilityPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState("365");

  const load = useCallback((d) => {
    setLoading(true);
    window.proelectricaApi.getMotorReliability({ days: Number(d) })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const summary = data?.summary;
  const rows    = (data?.rows || []).filter(r => Number(r.failure_count) > 0);

  // Porcentaje de flota sin fallas en el período
  const totalMotors       = Number(summary?.total_motors   || 0);
  const motorsWithFails   = Number(summary?.motors_with_failures || 0);
  const availabilityPct   = totalMotors > 0
    ? Math.round(((totalMotors - motorsWithFails) / totalMotors) * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity size={14} className="text-[#2f8dff]" />
          KPIs de Confiabilidad
          <div className="ml-auto">
            <Select
              value={days}
              onChange={e => setDays(e.target.value)}
              className="text-xs h-7 py-0 px-2 min-w-[160px]"
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Resumen global */}
        {loading ? (
          <div className="flex gap-3 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-14 w-24 rounded-xl bg-white/5" />)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <SummaryChip
              label="Fallas en período"
              value={summary?.total_failures ?? 0}
              color={Number(summary?.total_failures) > 0 ? "text-[#e07070]" : "text-[#29a16a]"}
            />
            <SummaryChip
              label="Equipos afectados"
              value={motorsWithFails}
              color={motorsWithFails > 0 ? "text-[#e0a91f]" : "text-[#29a16a]"}
            />
            <SummaryChip
              label="MTBF promedio"
              value={summary?.avg_mtbf != null ? `${summary.avg_mtbf}d` : "N/A"}
              color="text-[#2f8dff]"
            />
            <SummaryChip
              label="Disponibilidad de flota"
              value={availabilityPct != null ? `${availabilityPct}%` : "—"}
              color={
                availabilityPct == null   ? "text-[#4a6a8a]"   :
                availabilityPct >= 85     ? "text-[#29a16a]"   :
                availabilityPct >= 70     ? "text-[#e0a91f]"   :
                                            "text-[#e07070]"
              }
            />
          </div>
        )}

        {/* Tabla de motores con más fallas */}
        {!loading && rows.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <TrendingDown size={13} className="text-[#e07070]" />
              <span className="text-xs font-semibold text-[#9ab0c7]">
                Equipos con fallas en el período ({rows.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>Motor</Th>
                    <Th>Fallas</Th>
                    <Th>Mantenimientos</Th>
                    <Th>
                      <span className="flex items-center gap-1">
                        <Timer size={11} /> MTBF
                      </span>
                    </Th>
                    <Th>Costo total</Th>
                    <Th>Estado</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {rows.map(r => (
                    <Tr key={r.id}>
                      <Td>
                        <div>
                          <span className="font-semibold text-[#eaf2fb]">{r.code}</span>
                          <span className="text-[10px] text-[#4a6a8a] ml-1.5">{r.brand}</span>
                        </div>
                      </Td>
                      <Td>
                        <span className={cn(
                          "font-bold",
                          Number(r.failure_count) >= 5 ? "text-[#e07070]" :
                          Number(r.failure_count) >= 2 ? "text-[#e0a91f]" :
                          "text-[#eaf2fb]"
                        )}>
                          {r.failure_count}
                        </span>
                      </Td>
                      <Td className="text-[#9ab0c7]">{r.maintenance_count}</Td>
                      <Td><MtbfBadge days={r.mtbf_days} /></Td>
                      <Td className="text-[#29a16a] font-medium">{fmtCost(r.total_cost)}</Td>
                      <Td>
                        <Badge variant={
                          r.status === "Operativo"         ? "success" :
                          r.status === "En mantenimiento"  ? "warning" :
                          r.status === "Fuera de servicio" ? "danger"  : "default"
                        }>
                          {r.status || "—"}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </>
        )}

        {!loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-6 text-[#4a6a8a] text-sm">
            Sin fallas registradas en el período seleccionado. ✓
          </div>
        )}
      </CardContent>
    </Card>
  );
}
