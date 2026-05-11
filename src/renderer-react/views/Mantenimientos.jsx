import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea, Field } from "../components/ui/Input";
import { Badge, statusBadgeVariant } from "../components/ui/Badge";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters, csvExport } from "../hooks/useFilters";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { exportMaintenancesPDF } from "../lib/pdfReport";
import { CurrencyInput } from "../components/ui/CurrencyInput";
import { Plus, Pencil, Trash2, X, Check, FileText } from "lucide-react";

const filterFn = (item, query, status) => {
  const hay = `${item.motor_code||""} ${item.technician_name||""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && (!status || item.maintenance_type === status);
};

export function Mantenimientos() {
  const [items, setItems]         = useState([]);
  const [motors, setMotors]       = useState([]);
  const [technicians, setTechs]   = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ motorId:"", technicianId:"", maintenanceType:"Preventivo", maintenanceDate:"", description:"", cost:"" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const filters = useFilters(items, { filterFn, defaultSortField:"maintenance_date", perPage:8 });

  const load = useCallback(async () => {
    const [m, t, main] = await Promise.all([window.proelectricaApi.getMotors(), window.proelectricaApi.getTechnicians(), window.proelectricaApi.getMaintenances()]);
    setMotors(m); setTechs(t); setItems(main);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.motorId || !form.maintenanceDate) { showToast("Motor y fecha son obligatorios.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createMaintenance(form), "Mantenimiento registrado.");
    if (ok) { setForm({ motorId:"", technicianId:"", maintenanceType:"Preventivo", maintenanceDate:"", description:"", cost:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateMaintenance({ id: editId, ...editData }), "Mantenimiento actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteMaintenance(deleteId), "Mantenimiento eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Mantenimientos</h2>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar mantenimiento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Motor*">
              <Select value={form.motorId} onChange={(e)=>setForm({...form,motorId:e.target.value})}>
                <option value="">Seleccionar motor</option>
                {motors.map(m=><option key={m.id} value={m.id}>{m.code}</option>)}
              </Select>
            </Field>
            <Field label="Tecnico">
              <Select value={form.technicianId} onChange={(e)=>setForm({...form,technicianId:e.target.value})}>
                <option value="">Sin asignar</option>
                {technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.maintenanceType} onChange={(e)=>setForm({...form,maintenanceType:e.target.value})}>
                <option>Preventivo</option><option>Correctivo</option>
              </Select>
            </Field>
            <Field label="Fecha*"><Input type="date" value={form.maintenanceDate} onChange={(e)=>setForm({...form,maintenanceDate:e.target.value})}/></Field>
            <Field label="Costo"><CurrencyInput value={form.cost} onChange={(v)=>setForm({...form,cost:v})}/></Field>
            <Field label="Descripcion"><Textarea placeholder="Descripcion del trabajo" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave}>Guardar mantenimiento</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historial de mantenimientos</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => { if (!filters.filtered.length) { showToast("No hay datos para exportar.", "warning"); return; } exportMaintenancesPDF(filters.filtered); }}>
              <FileText size={13} className="mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por motor o tecnico"
            query={filters.query} onQueryChange={filters.setQuery}
            statusOptions={["Preventivo","Correctivo"]} status={filters.status} onStatusChange={filters.setStatus}
            sortOptions={[{value:"maintenance_date",label:"Fecha"},{value:"maintenance_type",label:"Tipo"},{value:"motor_code",label:"Motor"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={()=>csvExport("mantenimientos.csv",filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay mantenimientos para mostrar.</p>
            : <Table>
                <Thead><tr><Th>Tipo</Th><Th>Motor</Th><Th>Tecnico</Th><Th>Fecha</Th><Th>Costo</Th><Th>Acciones</Th></tr></Thead>
                <Tbody>
                  {filters.paged.map(item=>(
                    <React.Fragment key={item.id}>
                      <Tr>
                        <Td><Badge variant={statusBadgeVariant(item.maintenance_type)}>{item.maintenance_type}</Badge></Td>
                        <Td className="font-medium">{item.motor_code}</Td>
                        <Td className="text-[#9ab0c7]">{item.technician_name||"No asignado"}</Td>
                        <Td className="text-[#9ab0c7]">{item.maintenance_date}</Td>
                        <Td>${item.cost||0}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({maintenanceType:item.maintenance_type,maintenanceDate:item.maintenance_date||"",description:item.description||"",cost:item.cost||0,motorId:motors.find(m=>m.code===item.motor_code)?.id||"",technicianId:technicians.find(t=>t.full_name===item.technician_name)?.id||""})}}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={6}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Tipo"><Select value={editData.maintenanceType} onChange={(e)=>setEditData({...editData,maintenanceType:e.target.value})}><option>Preventivo</option><option>Correctivo</option></Select></Field>
                              <Field label="Fecha"><Input type="date" value={editData.maintenanceDate} onChange={(e)=>setEditData({...editData,maintenanceDate:e.target.value})}/></Field>
                              <Field label="Costo"><CurrencyInput value={editData.cost} onChange={(v)=>setEditData({...editData,cost:v})}/></Field>
                              <Field label="Descripcion"><Textarea value={editData.description} onChange={(e)=>setEditData({...editData,description:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este mantenimiento de forma permanente."/>
    </div>
  );
}
