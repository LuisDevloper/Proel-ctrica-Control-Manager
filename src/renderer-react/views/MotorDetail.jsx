import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge, statusBadgeVariant } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { SkeletonTable } from "../components/ui/Skeleton";
import { exportMotorDetailPDF } from "../lib/pdfReport";
import { ArrowLeft, FileText, Cpu, Wrench, AlertTriangle } from "lucide-react";

export function MotorDetail({ motorId, onBack }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.proelectricaApi.getMotorDetail(motorId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [motorId]);

  if (loading) return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 rounded bg-[#1a2d44] animate-shimmer" />
      <SkeletonTable rows={4} cols={4} />
    </div>
  );

  const { motor, maintenances, failures } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} className="mr-1" /> Volver
        </Button>
        <div>
          <h2 className="text-xl font-bold text-[#eaf2fb]">Motor: {motor.code}</h2>
          <p className="text-xs text-[#9ab0c7]">{motor.brand} {motor.model || ""} — {motor.location || "Sin ubicacion"}</p>
        </div>
        <Badge variant={statusBadgeVariant(motor.status)} className="ml-auto">{motor.status}</Badge>
        <Button variant="secondary" size="sm" onClick={() => exportMotorDetailPDF(motor, maintenances, failures)}>
          <FileText size={13} className="mr-1" /> PDF
        </Button>
      </div>

      {/* Info del motor */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu size={14}/> Informacion</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {[["Codigo",motor.code],["Marca",motor.brand],["Modelo",motor.model||"—"],["Ubicacion",motor.location||"—"],["Estado",motor.status],["Notas",motor.notes||"—"]].map(([l,v])=>(
              <React.Fragment key={l}>
                <span className="text-[#9ab0c7] col-span-1">{l}</span>
                <span className="text-[#eaf2fb] col-span-2">{v}</span>
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historial mantenimientos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench size={14}/> Mantenimientos ({maintenances.length})</CardTitle></CardHeader>
        <CardContent>
          {maintenances.length === 0
            ? <p className="text-sm text-[#9ab0c7]">Sin mantenimientos registrados.</p>
            : <Table>
                <Thead><tr><Th>Tipo</Th><Th>Fecha</Th><Th>Tecnico</Th><Th>Costo</Th><Th>Descripcion</Th></tr></Thead>
                <Tbody>
                  {maintenances.map(m => (
                    <Tr key={m.id}>
                      <Td><Badge variant={statusBadgeVariant(m.maintenance_type)}>{m.maintenance_type}</Badge></Td>
                      <Td className="text-[#9ab0c7]">{m.maintenance_date}</Td>
                      <Td className="text-[#9ab0c7]">{m.technician_name||"—"}</Td>
                      <Td>${m.cost||0}</Td>
                      <Td className="text-[#9ab0c7] max-w-[200px] truncate">{m.description||"—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
          }
        </CardContent>
      </Card>

      {/* Historial fallas */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle size={14}/> Fallas ({failures.length})</CardTitle></CardHeader>
        <CardContent>
          {failures.length === 0
            ? <p className="text-sm text-[#9ab0c7]">Sin fallas registradas.</p>
            : <Table>
                <Thead><tr><Th>Tipo</Th><Th>Prioridad</Th><Th>Estado</Th><Th>Fecha</Th><Th>Solucion</Th></tr></Thead>
                <Tbody>
                  {failures.map(f => (
                    <Tr key={f.id}>
                      <Td className="font-medium">{f.failure_type}</Td>
                      <Td><Badge variant={statusBadgeVariant(f.priority)}>{f.priority}</Badge></Td>
                      <Td><Badge variant={statusBadgeVariant(f.status)}>{f.status}</Badge></Td>
                      <Td className="text-[#9ab0c7]">{f.reported_at}</Td>
                      <Td className="text-[#9ab0c7] max-w-[200px] truncate">{f.solution||"Pendiente"}</Td>
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
