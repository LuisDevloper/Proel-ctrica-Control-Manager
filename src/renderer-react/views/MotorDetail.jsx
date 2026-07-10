import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge, statusBadgeVariant, OperationalStatusBadge, OperationalLocationBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { SkeletonTable } from "../components/ui/Skeleton";
import { exportMotorDetailPDF } from "../lib/pdfReport";
import { ArrowLeft, FileText, Wrench, AlertTriangle, DollarSign, Activity, Timer, GitBranch } from "lucide-react";
import { ElectricMotorIcon } from "../components/icons/ElectricMotorIcon";
import { useToast } from "../components/ui/Toast";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { EntityDocuments } from "../components/documents/EntityDocuments";
import { canMutateRecords } from "../lib/permissions";

/** Calcula MTBF en días a partir del arreglo de fallas. */
function calcMtbf(failures) {
  const dates = failures
    .map(f => f.reported_at ? new Date(String(f.reported_at).slice(0, 10)) : null)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (dates.length < 2) return null;
  const diffMs = dates[dates.length - 1] - dates[0];
  return Math.round(diffMs / (1000 * 60 * 60 * 24) / (dates.length - 1));
}

/** Días transcurridos desde una fecha ISO. */
function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(String(dateStr).slice(0, 10)).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const fmtCost = (v) => "$" + Number(v || 0).toLocaleString("es-CO");
const fmtDate = (d) => d || "—";

function StatMini({ label, value, color = "text-[#eaf2fb]" }) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#0d1825] border border-[#2a3d57] rounded-xl p-4 gap-1">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-[#9ab0c7] text-center">{label}</span>
    </div>
  );
}

export function MotorDetail({ motorId, onBack, user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.proelectricaApi.getMotorDetail(motorId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d && !d.motor) showToast("Motor no encontrado.", "warning");
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        showToast("No se pudo cargar el detalle del motor.", "warning");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [motorId, showToast]);

  if (loading) return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 rounded bg-[#1a2d44] animate-shimmer" />
      <SkeletonTable rows={4} cols={4} />
    </div>
  );

  if (!data?.motor) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
          <ArrowLeft size={14} className="mr-1" /> Volver
        </Button>
        <EmptyState message="Motor no encontrado o sin datos disponibles." />
      </div>
    );
  }

  const { motor, maintenances = [], failures = [] } = data;
  const canMutate = canMutateRecords(user?.role);
  const totalCost    = maintenances.reduce((s, m) => s + Number(m.cost || 0), 0);
  const pendingFails = failures.filter(f => f.status !== "Resuelta").length;
  const completedMtn = maintenances.filter(m => m.status === "Completado").length;

  // KPIs de confiabilidad calculados en el cliente
  const mtbf           = calcMtbf(failures);
  const lastFailure    = failures.length > 0
    ? failures.reduce((a, b) => (a.reported_at || "") > (b.reported_at || "") ? a : b)
    : null;
  const daysSinceLastFail = daysSince(lastFailure?.reported_at);

  // Timeline unificada de mantenimientos + fallas, ordenada cronológicamente
  const timeline = [
    ...maintenances.map(m => ({
      kind:    "maintenance",
      date:    m.maintenance_date || "",
      label:   m.maintenance_type,
      sub:     m.technician_name || "",
      status:  m.status,
      cost:    m.cost,
      id:      `m-${m.id}`,
    })),
    ...failures.map(f => ({
      kind:    "failure",
      date:    f.reported_at || "",
      label:   f.failure_type,
      sub:     f.technician_name || "",
      status:  f.status,
      priority: f.priority,
      id:      `f-${f.id}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const fields = [
    ["Codigo",          motor.code],
    ["Marca",           motor.brand],
    ["Modelo",          motor.model || "—"],
    ["Numero de serie", motor.serial_number || "—"],
    ["Potencia",        motor.power ? `${motor.power} kW` : "—"],
    ["Voltaje",         motor.voltage ? `${motor.voltage} V` : "—"],
    ["RPM",             motor.rpm || "—"],
    ["Ubicacion operativa", motor.operational_location || "En planta"],
    ["Detalle ubicacion",   motor.location || "—"],
    ["Instalacion",     fmtDate(motor.installed_at)],
    ["Observaciones",   motor.notes || "—"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start -mb-1">
        <ArrowLeft size={14} className="mr-1" /> Volver
      </Button>
      <PageHeader
        title={`Motor ${motor.code}`}
        description={`${motor.brand} ${motor.model || ""} · ${motor.operational_location || "En planta"}`}
        icon={ElectricMotorIcon}
        actions={
          <>
            <OperationalLocationBadge location={motor.operational_location} />
            <OperationalStatusBadge status={motor.status} />
            <Button variant="secondary" size="sm" onClick={() => exportMotorDetailPDF(motor, maintenances, failures)}>
              <FileText size={13} className="mr-1" /> PDF
            </Button>
          </>
        }
      />

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatMini label="Mantenimientos"   value={maintenances.length} color="text-[#2f8dff]" />
        <StatMini label="Completados"      value={completedMtn}        color="text-[#29a16a]" />
        <StatMini label="Fallas totales"   value={failures.length}     color="text-[#e0a91f]" />
        <StatMini label="Fallas pendientes" value={pendingFails}       color={pendingFails > 0 ? "text-[#e07070]" : "text-[#29a16a]"} />
      </div>

      {/* KPIs de confiabilidad */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center bg-[#0d1825] border border-[#2a3d57] rounded-xl p-4 gap-1">
          <Timer size={14} className="text-[#2f8dff] mb-0.5" />
          <span className={`text-2xl font-bold ${mtbf == null ? "text-[#4a6a8a]" : mtbf >= 60 ? "text-[#29a16a]" : mtbf >= 20 ? "text-[#e0a91f]" : "text-[#e07070]"}`}>
            {mtbf != null ? `${mtbf}d` : "N/A"}
          </span>
          <span className="text-xs text-[#9ab0c7] text-center">MTBF (días entre fallas)</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-[#0d1825] border border-[#2a3d57] rounded-xl p-4 gap-1">
          <Activity size={14} className="text-[#29a16a] mb-0.5" />
          <span className={`text-2xl font-bold ${daysSinceLastFail == null ? "text-[#4a6a8a]" : daysSinceLastFail >= 180 ? "text-[#29a16a]" : daysSinceLastFail >= 30 ? "text-[#e0a91f]" : "text-[#e07070]"}`}>
            {daysSinceLastFail != null ? `${daysSinceLastFail}d` : "Sin fallas"}
          </span>
          <span className="text-xs text-[#9ab0c7] text-center">Días desde última falla</span>
        </div>
        <div className="flex flex-col items-center justify-center bg-[#0d1825] border border-[#2a3d57] rounded-xl p-4 gap-1 col-span-2 sm:col-span-1">
          <GitBranch size={14} className="text-[#c084fc] mb-0.5" />
          <span className="text-2xl font-bold text-[#c084fc]">
            {failures.length > 0 ? (failures.length / Math.max(1, maintenances.length)).toFixed(1) : "0"}
          </span>
          <span className="text-xs text-[#9ab0c7] text-center">Fallas por mantenimiento</span>
        </div>
      </div>

      {/* Costo total */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="p-2.5 rounded-xl bg-[#29a16a]/10 text-[#29a16a]">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#eaf2fb]">{fmtCost(totalCost)}</p>
            <p className="text-xs text-[#9ab0c7]">Costo total acumulado en mantenimientos</p>
          </div>
        </CardContent>
      </Card>

      {/* Lightbox foto */}
      {lightbox && motor.photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={motor.photo}
            alt={motor.code}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl border border-[#2a3d57] animate-slideUp object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-5 right-6 text-white/70 hover:text-white text-3xl font-light cursor-pointer transition-colors leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ficha técnica */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ElectricMotorIcon size={14}/> Ficha tecnica</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {motor.photo && (
              <div className="shrink-0">
                <img
                  src={motor.photo}
                  alt={motor.code}
                  onClick={() => setLightbox(true)}
                  className="w-28 h-28 rounded-xl object-cover border border-[#2a3d57] shadow-lg cursor-zoom-in hover:scale-105 hover:border-[#2f8dff] transition-all duration-200"
                  title="Click para ver en grande"
                />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2.5 text-sm flex-1">
              {fields.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[#9ab0c7] text-xs uppercase tracking-wide">{label}</span>
                  <span className="text-[#eaf2fb] font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline cronológica */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={14} className="text-[#2f8dff]" /> Hoja de vida — Línea de tiempo
              <span className="ml-auto text-xs font-normal text-[#9ab0c7]">{timeline.length} evento(s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex flex-col gap-0">
              {/* Línea vertical */}
              <div className="absolute left-[17px] top-3 bottom-3 w-px bg-[#2a3d57]" />
              {timeline.map((ev, i) => (
                <div key={ev.id} className="flex items-start gap-3 py-2 pl-1">
                  {/* Punto */}
                  <div className={`relative z-10 mt-1 w-[18px] h-[18px] rounded-full shrink-0 border-2 flex items-center justify-center ${
                    ev.kind === "failure"
                      ? ev.status === "Resuelta" ? "border-[#e0a91f] bg-[#2b2208]" : "border-[#e07070] bg-[#2e1212]"
                      : ev.status === "Completado" ? "border-[#29a16a] bg-[#0a1e14]" : "border-[#2f8dff] bg-[#0d1e38]"
                  }`}>
                    {ev.kind === "failure"
                      ? <AlertTriangle size={9} className={ev.status === "Resuelta" ? "text-[#e0a91f]" : "text-[#e07070]"} />
                      : <Wrench size={9} className={ev.status === "Completado" ? "text-[#29a16a]" : "text-[#2f8dff]"} />
                    }
                  </div>
                  {/* Contenido */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#eaf2fb]">{ev.label}</span>
                      {ev.kind === "failure" && ev.priority && (
                        <Badge variant={statusBadgeVariant(ev.priority)} className="text-[9px] py-0 px-1">{ev.priority}</Badge>
                      )}
                      {ev.status && (
                        <Badge variant={statusBadgeVariant(ev.status)} className="text-[9px] py-0 px-1">{ev.status}</Badge>
                      )}
                      {ev.cost > 0 && (
                        <span className="text-[10px] text-[#29a16a] font-medium">{fmtCost(ev.cost)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#4a6a8a]">{String(ev.date).slice(0, 10)}</span>
                      {ev.sub && <span className="text-[10px] text-[#4a6a8a]">· {ev.sub}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial mantenimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench size={14}/> Historial de mantenimientos
            <span className="ml-auto text-xs font-normal text-[#9ab0c7]">{maintenances.length} registro(s)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {maintenances.length === 0
            ? <EmptyState message="Sin mantenimientos registrados para este motor." className="py-8" />
            : <Table>
                <Thead>
                  <tr>
                    <Th>Tipo</Th><Th>Fecha</Th><Th>Estado</Th><Th>Tecnico</Th><Th>Costo</Th><Th>Descripcion</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {maintenances.map(m => (
                    <Tr key={m.id} className={m.status === "Completado" ? "opacity-70" : ""}>
                      <Td><Badge variant={statusBadgeVariant(m.maintenance_type)}>{m.maintenance_type}</Badge></Td>
                      <Td className="text-[#9ab0c7]">{m.maintenance_date}</Td>
                      <Td>
                        <OperationalStatusBadge status={m.status} />
                      </Td>
                      <Td className="text-[#9ab0c7]">{m.technician_name || "—"}</Td>
                      <Td className="font-medium text-[#29a16a]">{fmtCost(m.cost)}</Td>
                      <Td className="text-[#9ab0c7] max-w-[200px] truncate">{m.description || "—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
          }
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={14}/> Documentacion tecnica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EntityDocuments
            entityType="motor"
            entityId={motorId}
            title="Archivos del motor"
            canMutate={canMutate}
            username={user?.username}
          />
        </CardContent>
      </Card>

      {/* Historial fallas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={14}/> Historial de fallas
            <span className="ml-auto text-xs font-normal text-[#9ab0c7]">{failures.length} registro(s)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failures.length === 0
            ? <EmptyState message="Sin fallas registradas para este motor." className="py-8" />
            : <Table>
                <Thead>
                  <tr>
                    <Th>Tipo</Th><Th>Prioridad</Th><Th>Estado</Th><Th>Fecha</Th><Th>Tecnico</Th><Th>Solucion</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {failures.map(f => (
                    <Tr key={f.id} className={f.status === "Resuelta" ? "opacity-70" : ""}>
                      <Td className="font-medium">{f.failure_type}</Td>
                      <Td><Badge variant={statusBadgeVariant(f.priority)}>{f.priority}</Badge></Td>
                      <Td><Badge variant={statusBadgeVariant(f.status)}>{f.status}</Badge></Td>
                      <Td className="text-[#9ab0c7]">{f.reported_at}</Td>
                      <Td className="text-[#9ab0c7]">{f.technician_name || "—"}</Td>
                      <Td className="text-[#9ab0c7] max-w-[200px] truncate">{f.solution || "—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
          }
        </CardContent>
      </Card>
    </div>
  );
}
