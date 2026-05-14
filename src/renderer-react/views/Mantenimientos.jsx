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
  { key: "id",               header: "ID",                width: 8  },
  { key: "motor_code",       header: "Motor",             width: 14 },
  { key: "maintenance_type", header: "Tipo",              width: 22 },
  { key: "maintenance_date", header: "Fecha",             width: 14 },
  { key: "technician_name",  header: "Tecnico",           width: 22 },
  { key: "cost",             header: "Costo (Bs)",        width: 14 },
  { key: "status",           header: "Estado",            width: 16 },
  { key: "description",      header: "Descripcion",       width: 36 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { exportMaintenancesPDF } from "../lib/pdfReport";
import { CurrencyInput } from "../components/ui/CurrencyInput";
import { Plus, Pencil, Trash2, X, Check, FileText, CheckCircle2 } from "lucide-react";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";

const filterFn = (item, query, status) => {
  const hay = `${item.motor_code||""} ${item.technician_name||""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && (!status || item.maintenance_type === status);
};

const fmtCost = (v) => {
  if (!v && v !== 0) return "$0";
  return "$" + Number(v).toLocaleString("es-CO");
};

function StatusBadge({ status }) {
  const styles = {
    "Pendiente":   "bg-[#e0a91f22] text-[#e0a91f] border border-[#e0a91f44]",
    "Completado":  "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]",
    "En progreso": "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || styles["Pendiente"]}`}>
      {status || "Pendiente"}
    </span>
  );
}

export function Mantenimientos({ user }) {
  const [items, setItems]         = useState([]);
  const [motors, setMotors]       = useState([]);
  const [technicians, setTechs]   = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ motorId:"", technicianId:"", maintenanceType:"Preventivo", maintenanceDate:"", description:"", cost:"" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const { dbWritable }            = useDbHealth();
  const dbTitle                   = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate                 = canMutateRecords(user?.role);
  const mutBlockTitle             = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled              = !dbWritable || !canMutate;
  const filters = useFilters(items, { filterFn, defaultSortField:"maintenance_date", perPage:10, dateField:"maintenance_date" });

  const load = useCallback(async () => {
    const [m, t, main] = await Promise.all([window.proelectricaApi.getMotors(), window.proelectricaApi.getTechnicians(), window.proelectricaApi.getMaintenances()]);
    setMotors(m); setTechs(t); setItems(main);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.motorId || !form.maintenanceDate) { showToast("Motor y fecha son obligatorios.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createMaintenance({ ...form, _username: user?.username }), "Mantenimiento registrado.");
    if (ok) { setForm({ motorId:"", technicianId:"", maintenanceType:"Preventivo", maintenanceDate:"", description:"", cost:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateMaintenance({ id: editId, ...editData, _username: user?.username }), "Mantenimiento actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteMaintenance(deleteId), "Mantenimiento eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  async function handleComplete(item) {
    const motorObj = motors.find(m => m.code === item.motor_code);
    const techObj  = technicians.find(t => t.full_name === item.technician_name);
    await run(() => window.proelectricaApi.updateMaintenance({
      id: item.id,
      motorId: motorObj?.id || "",
      technicianId: techObj?.id || "",
      maintenanceType: item.maintenance_type,
      maintenanceDate: item.maintenance_date,
      description: item.description || "",
      cost: item.cost || 0,
      status: "Completado",
    }), "Mantenimiento marcado como completado.");
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Mantenimientos</h2>

      {!canMutate && (
        <p className="text-sm text-[#9ab0c7] bg-[#2f8dff]/5 border border-[#2f8dff]/20 rounded-xl px-4 py-2">
          Modulo en modo solo lectura: consulta e informes permitidos; no registrar ni modificar mantenimientos.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar mantenimiento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Motor*">
              <Select disabled={formDisabled} value={form.motorId} onChange={(e)=>setForm({...form,motorId:e.target.value})}>
                <option value="">Seleccionar motor</option>
                {motors.map(m=><option key={m.id} value={m.id}>{m.code}</option>)}
              </Select>
            </Field>
            <Field label="Tecnico">
              <Select disabled={formDisabled} value={form.technicianId} onChange={(e)=>setForm({...form,technicianId:e.target.value})}>
                <option value="">Sin asignar</option>
                {technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select disabled={formDisabled} value={form.maintenanceType} onChange={(e)=>setForm({...form,maintenanceType:e.target.value})}>
                <option>Preventivo</option><option>Correctivo</option>
              </Select>
            </Field>
            <Field label="Fecha*"><Input disabled={formDisabled} type="date" value={form.maintenanceDate} onChange={(e)=>setForm({...form,maintenanceDate:e.target.value})}/></Field>
            <Field label="Costo"><CurrencyInput disabled={formDisabled} value={form.cost} onChange={(v)=>setForm({...form,cost:v})}/></Field>
            <Field label="Descripcion"><Textarea disabled={formDisabled} placeholder="Descripcion del trabajo" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar mantenimiento</Button>
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
            dateFrom={filters.dateFrom} onDateFromChange={filters.setDateFrom}
            dateTo={filters.dateTo} onDateToChange={filters.setDateTo}
            perPage={filters.perPage} onPerPageChange={filters.setPerPage}
            onExport={() => xlsxExport("Mantenimientos", "Registro de Mantenimientos", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay mantenimientos para mostrar.</p>
            : <Table>
                <Thead><tr><Th>Tipo</Th><Th>Motor</Th><Th>Tecnico</Th><Th>Fecha</Th><Th>Costo</Th><Th>Estado</Th><Th>Acciones</Th></tr></Thead>
                <Tbody>
                  {filters.paged.map(item=>(
                    <React.Fragment key={item.id}>
                      <Tr className={item.status === "Completado" ? "opacity-60" : ""}>
                        <Td><Badge variant={statusBadgeVariant(item.maintenance_type)}>{item.maintenance_type}</Badge></Td>
                        <Td className="font-medium">{item.motor_code}</Td>
                        <Td className="text-[#9ab0c7]">{item.technician_name||"No asignado"}</Td>
                        <Td className="text-[#9ab0c7]">{item.maintenance_date}</Td>
                        <Td>{fmtCost(item.cost)}</Td>
                        <Td><StatusBadge status={item.status} /></Td>
                        <Td>
                          <div className="flex gap-2">
                            {item.status !== "Completado" && (
                              <Button variant="ghost" size="icon" className="hover:text-[#29a16a]" title={mutBlockTitle || "Marcar como completado"} onClick={()=>handleComplete(item)} disabled={formDisabled}>
                                <CheckCircle2 size={14}/>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({maintenanceType:item.maintenance_type,maintenanceDate:item.maintenance_date||"",description:item.description||"",cost:item.cost||0,status:item.status||"Pendiente",motorId:motors.find(m=>m.code===item.motor_code)?.id||"",technicianId:technicians.find(t=>t.full_name===item.technician_name)?.id||""})}} disabled={formDisabled} title={mutBlockTitle}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={7}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Tipo"><Select disabled={formDisabled} value={editData.maintenanceType} onChange={(e)=>setEditData({...editData,maintenanceType:e.target.value})}><option>Preventivo</option><option>Correctivo</option></Select></Field>
                              <Field label="Fecha"><Input disabled={formDisabled} type="date" value={editData.maintenanceDate} onChange={(e)=>setEditData({...editData,maintenanceDate:e.target.value})}/></Field>
                              <Field label="Costo"><CurrencyInput disabled={formDisabled} value={editData.cost} onChange={(v)=>setEditData({...editData,cost:v})}/></Field>
                              <Field label="Estado">
                                <Select disabled={formDisabled} value={editData.status} onChange={(e)=>setEditData({...editData,status:e.target.value})}>
                                  <option>Pendiente</option>
                                  <option>En progreso</option>
                                  <option>Completado</option>
                                </Select>
                              </Field>
                              <Field label="Descripcion" className="col-span-2"><Textarea disabled={formDisabled} value={editData.description} onChange={(e)=>setEditData({...editData,description:e.target.value})}/></Field>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={handleUpdate} disabled={formDisabled} title={mutBlockTitle}><Check size={13} className="mr-1"/>Guardar</Button>
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
          <Pager page={filters.page} totalPages={filters.totalPages} onPrev={()=>filters.setPage(filters.page-1)} onNext={()=>filters.setPage(filters.page+1)} total={filters.filtered.length} perPage={filters.perPage}/>
        </CardContent>
      </Card>

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este mantenimiento de forma permanente."/>
    </div>
  );
}
