import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea, Field } from "../components/ui/Input";
import { Badge, statusBadgeVariant } from "../components/ui/Badge";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";

const EXCEL_COLS = [
  { key: "id",            header: "ID",              width: 8  },
  { key: "motor_code",    header: "Motor",           width: 14 },
  { key: "failure_type",  header: "Tipo de Falla",   width: 26 },
  { key: "reported_at",   header: "Fecha Reporte",   width: 16 },
  { key: "priority",      header: "Prioridad",       width: 12 },
  { key: "status",        header: "Estado",          width: 16 },
  { key: "technician_name", header: "Tecnico",       width: 22 },
  { key: "resolved_at",   header: "Fecha Resolucion",width: 18 },
  { key: "description",   header: "Descripcion",     width: 36 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { exportFailuresPDF } from "../lib/pdfReport";
import { Plus, Pencil, Trash2, X, Check, FileText } from "lucide-react";

const filterFn = (item, query, status) => {
  const hay = `${item.failure_type||""} ${item.motor_code||""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && (!status || item.status === status);
};

export function Fallas() {
  const [items, setItems]         = useState([]);
  const [motors, setMotors]       = useState([]);
  const [technicians, setTechs]   = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ motorId:"", technicianId:"", failureType:"", priority:"Alta", status:"Pendiente", reportedAt:"", solution:"" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const filters = useFilters(items, { filterFn, defaultSortField:"reported_at", perPage:8 });

  const load = useCallback(async () => {
    const [m, t, f] = await Promise.all([window.proelectricaApi.getMotors(), window.proelectricaApi.getTechnicians(), window.proelectricaApi.getFailures()]);
    setMotors(m); setTechs(t); setItems(f);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.motorId || !form.failureType || !form.reportedAt) { showToast("Motor, tipo y fecha son obligatorios.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createFailure(form), "Falla registrada.");
    if (ok) { setForm({ motorId:"", technicianId:"", failureType:"", priority:"Alta", status:"Pendiente", reportedAt:"", solution:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateFailure({ id: editId, ...editData }), "Falla actualizada.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteFailure(deleteId), "Falla eliminada.");
    if (ok) { setDeleteId(null); load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Fallas</h2>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar falla</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Motor*"><Select value={form.motorId} onChange={(e)=>setForm({...form,motorId:e.target.value})}><option value="">Seleccionar motor</option>{motors.map(m=><option key={m.id} value={m.id}>{m.code}</option>)}</Select></Field>
            <Field label="Tecnico"><Select value={form.technicianId} onChange={(e)=>setForm({...form,technicianId:e.target.value})}><option value="">Sin asignar</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></Field>
            <Field label="Tipo de falla*"><Input placeholder="Tipo de falla" value={form.failureType} onChange={(e)=>setForm({...form,failureType:e.target.value})}/></Field>
            <Field label="Fecha*"><Input type="date" value={form.reportedAt} onChange={(e)=>setForm({...form,reportedAt:e.target.value})}/></Field>
            <Field label="Prioridad"><Select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></Select></Field>
            <Field label="Estado"><Select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Resuelta</option></Select></Field>
            <Field label="Solucion" className="col-span-2"><Textarea placeholder="Solucion aplicada" value={form.solution} onChange={(e)=>setForm({...form,solution:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave}>Guardar falla</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Registro de fallas</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => { if (!filters.filtered.length) { showToast("No hay datos para exportar.", "warning"); return; } exportFailuresPDF(filters.filtered); }}>
              <FileText size={13} className="mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por tipo de falla o motor"
            query={filters.query} onQueryChange={filters.setQuery}
            statusOptions={["Pendiente","En proceso","Resuelta"]} status={filters.status} onStatusChange={filters.setStatus}
            sortOptions={[{value:"reported_at",label:"Fecha"},{value:"priority",label:"Prioridad"},{value:"status",label:"Estado"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={() => xlsxExport("Fallas", "Registro de Fallas", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay fallas para mostrar.</p>
            : <Table>
                <Thead><tr><Th>Tipo</Th><Th>Motor</Th><Th>Prioridad</Th><Th>Estado</Th><Th>Fecha</Th><Th>Tecnico</Th><Th>Acciones</Th></tr></Thead>
                <Tbody>
                  {filters.paged.map(item=>(
                    <React.Fragment key={item.id}>
                      <Tr>
                        <Td className="font-medium">{item.failure_type}</Td>
                        <Td>{item.motor_code}</Td>
                        <Td><Badge variant={statusBadgeVariant(item.priority)}>{item.priority}</Badge></Td>
                        <Td><Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge></Td>
                        <Td className="text-[#9ab0c7]">{item.reported_at}</Td>
                        <Td className="text-[#9ab0c7]">{item.technician_name||"—"}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({failureType:item.failure_type||"",priority:item.priority,status:item.status,reportedAt:item.reported_at||"",solution:item.solution||"",motorId:motors.find(m=>m.code===item.motor_code)?.id||"",technicianId:technicians.find(t=>t.full_name===item.technician_name)?.id||""})}}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={7}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Tipo"><Input value={editData.failureType} onChange={(e)=>setEditData({...editData,failureType:e.target.value})}/></Field>
                              <Field label="Fecha"><Input type="date" value={editData.reportedAt} onChange={(e)=>setEditData({...editData,reportedAt:e.target.value})}/></Field>
                              <Field label="Prioridad"><Select value={editData.priority} onChange={(e)=>setEditData({...editData,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></Select></Field>
                              <Field label="Estado"><Select value={editData.status} onChange={(e)=>setEditData({...editData,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Resuelta</option></Select></Field>
                              <Field label="Solucion" className="col-span-2"><Textarea value={editData.solution} onChange={(e)=>setEditData({...editData,solution:e.target.value})}/></Field>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={handleUpdate}><Check size={13} className="mr-1"/>Guardar</Button>
                              <Button size="sm" variant="secondary" onClick={()=>setEditId(null)}><X size={13} className="mr-1"/>Cancelar</Button>
                            </div>
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  ))}
                </Tbody>
              </Table>
          }
          <Pager page={filters.page} totalPages={filters.totalPages} onPrev={()=>filters.setPage(filters.page-1)} onNext={()=>filters.setPage(filters.page+1)}/>
        </CardContent>
      </Card>

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara esta falla de forma permanente."/>
    </div>
  );
}
