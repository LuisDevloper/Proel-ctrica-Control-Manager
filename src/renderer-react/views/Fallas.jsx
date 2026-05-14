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
import { Plus, Pencil, Trash2, X, Check, FileText, CheckCircle2 } from "lucide-react";
import { Input as InputComp, Field as FieldComp } from "../components/ui/Input";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";

const filterFn = (item, query, status) => {
  const hay = `${item.failure_type||""} ${item.motor_code||""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && (!status || item.status === status);
};

function ResolveModal({ open, failure, motors, technicians, onClose, onConfirm, confirmDisabled, disableTitle }) {
  const today = new Date().toISOString().split("T")[0];
  const [createMtn, setCreateMtn] = useState(true);
  const [solution, setSolution]   = useState("");
  const [mtnDate, setMtnDate]     = useState(today);
  const [techId, setTechId]       = useState("");
  const ro = confirmDisabled;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !failure) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative z-10 bg-[#111d2c] border border-[#2a3d57] rounded-2xl shadow-2xl p-6 w-[440px] animate-slideUp">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[#29a16a]/10 border border-[#29a16a]/30 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-[#29a16a]" />
          </div>
        </div>
        <h3 className="text-center text-base font-bold text-[#eaf2fb] mb-1">Resolver falla</h3>
        <p className="text-center text-sm text-[#9ab0c7] mb-5">
          Falla: <span className="text-[#eaf2fb] font-medium">{failure.failure_type}</span> — Motor: <span className="text-[#eaf2fb] font-medium">{failure.motor_code}</span>
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <FieldComp label="Solucion aplicada">
            <InputComp disabled={ro} placeholder="Describe la solucion..." value={solution} onChange={e => setSolution(e.target.value)} />
          </FieldComp>

          {/* Toggle crear mantenimiento */}
          <label className={`flex items-start gap-3 select-none bg-[#0d1825] rounded-xl p-3 border border-[#2a3d57] ${ro ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
            <div
              onClick={() => { if (!ro) setCreateMtn(v => !v); }}
              className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 mt-0.5 transition-all ${createMtn ? "bg-[#2f8dff] border-[#2f8dff]" : "bg-transparent border-[#2a3d57]"}`}
            >
              {createMtn && <Check size={11} className="text-white" />}
            </div>
            <div>
              <p className="text-sm text-[#eaf2fb] font-medium">Crear mantenimiento correctivo</p>
              <p className="text-xs text-[#9ab0c7] mt-0.5">Se registrara automaticamente un mantenimiento asociado a esta falla</p>
            </div>
          </label>

          {createMtn && (
            <div className="grid grid-cols-2 gap-3 pl-1">
              <FieldComp label="Fecha mantenimiento">
                <InputComp disabled={ro} type="date" value={mtnDate} onChange={e => setMtnDate(e.target.value)} />
              </FieldComp>
              <FieldComp label="Tecnico">
                <select
                  disabled={ro}
                  value={techId}
                  onChange={e => setTechId(e.target.value)}
                  className="w-full rounded-lg border border-[#2a3d57] bg-[#0d1825] text-[#eaf2fb] text-sm px-3 py-2 focus:outline-none focus:border-[#2f8dff]"
                >
                  <option value="">Sin asignar</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </FieldComp>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium border border-[#2a3d57] text-[#9ab0c7] hover:text-[#eaf2fb] hover:bg-white/5 transition-all cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ solution, createMtn, mtnDate, techId })}
            disabled={confirmDisabled}
            title={disableTitle}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#29a16a] hover:bg-[#34c47e] text-white transition-all cursor-pointer shadow-lg shadow-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resolver falla
          </button>
        </div>
      </div>
    </div>
  );
}

export function Fallas({ user }) {
  const [items, setItems]         = useState([]);
  const [motors, setMotors]       = useState([]);
  const [technicians, setTechs]   = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [resolveItem, setResolveItem] = useState(null);
  const [form, setForm]           = useState({ motorId:"", technicianId:"", failureType:"", priority:"Alta", status:"Pendiente", reportedAt:"", solution:"" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const { dbWritable }            = useDbHealth();
  const dbTitle                   = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate                 = canMutateRecords(user?.role);
  const mutBlockTitle             = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled              = !dbWritable || !canMutate;
  const filters = useFilters(items, { filterFn, defaultSortField:"reported_at", perPage:10, dateField:"reported_at" });

  const load = useCallback(async () => {
    const [m, t, f] = await Promise.all([window.proelectricaApi.getMotors(), window.proelectricaApi.getTechnicians(), window.proelectricaApi.getFailures()]);
    setMotors(m); setTechs(t); setItems(f);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.motorId || !form.failureType || !form.reportedAt) { showToast("Motor, tipo y fecha son obligatorios.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createFailure({ ...form, _username: user?.username }), "Falla registrada.");
    if (ok) { setForm({ motorId:"", technicianId:"", failureType:"", priority:"Alta", status:"Pendiente", reportedAt:"", solution:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateFailure({ id: editId, ...editData, _username: user?.username }), "Falla actualizada.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteFailure(deleteId), "Falla eliminada.");
    if (ok) { setDeleteId(null); load(); }
  }

  async function handleResolve({ solution, createMtn, mtnDate, techId }) {
    const item = resolveItem;
    const motorObj = motors.find(m => m.code === item.motor_code);
    const { ok } = await run(() => window.proelectricaApi.updateFailure({
      id: item.id,
      motorId: motorObj?.id || "",
      technicianId: technicians.find(t => t.full_name === item.technician_name)?.id || "",
      failureType: item.failure_type,
      priority: item.priority,
      status: "Resuelta",
      reportedAt: item.reported_at,
      solution,
      _username: user?.username,
    }), "Falla marcada como resuelta.");
    if (ok && createMtn && motorObj) {
      await run(() => window.proelectricaApi.createMaintenance({
        motorId: motorObj.id,
        technicianId: techId || "",
        maintenanceType: "Correctivo",
        maintenanceDate: mtnDate,
        description: `Mantenimiento correctivo por falla: ${item.failure_type}`,
        cost: "",
        status: "Pendiente",
        _username: user?.username,
      }), "Mantenimiento correctivo creado.");
    }
    setResolveItem(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Fallas</h2>

      {!canMutate && (
        <p className="text-sm text-[#9ab0c7] bg-[#2f8dff]/5 border border-[#2f8dff]/20 rounded-xl px-4 py-2">
          Modulo en modo solo lectura: consulta e informes permitidos; no registrar ni resolver fallas desde aqui.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar falla</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Motor*"><Select disabled={formDisabled} value={form.motorId} onChange={(e)=>setForm({...form,motorId:e.target.value})}><option value="">Seleccionar motor</option>{motors.map(m=><option key={m.id} value={m.id}>{m.code}</option>)}</Select></Field>
            <Field label="Tecnico"><Select disabled={formDisabled} value={form.technicianId} onChange={(e)=>setForm({...form,technicianId:e.target.value})}><option value="">Sin asignar</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></Field>
            <Field label="Tipo de falla*"><Input disabled={formDisabled} placeholder="Tipo de falla" value={form.failureType} onChange={(e)=>setForm({...form,failureType:e.target.value})}/></Field>
            <Field label="Fecha*"><Input disabled={formDisabled} type="date" value={form.reportedAt} onChange={(e)=>setForm({...form,reportedAt:e.target.value})}/></Field>
            <Field label="Prioridad"><Select disabled={formDisabled} value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></Select></Field>
            <Field label="Estado"><Select disabled={formDisabled} value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Resuelta</option></Select></Field>
            <Field label="Solucion" className="col-span-2"><Textarea disabled={formDisabled} placeholder="Solucion aplicada" value={form.solution} onChange={(e)=>setForm({...form,solution:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar falla</Button>
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
            dateFrom={filters.dateFrom} onDateFromChange={filters.setDateFrom}
            dateTo={filters.dateTo} onDateToChange={filters.setDateTo}
            perPage={filters.perPage} onPerPageChange={filters.setPerPage}
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
                            {item.status !== "Resuelta" && (
                              <Button variant="ghost" size="icon" className="hover:text-[#29a16a]" title={mutBlockTitle || "Resolver falla"} onClick={() => setResolveItem(item)} disabled={formDisabled}>
                                <CheckCircle2 size={14}/>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({failureType:item.failure_type||"",priority:item.priority,status:item.status,reportedAt:item.reported_at||"",solution:item.solution||"",motorId:motors.find(m=>m.code===item.motor_code)?.id||"",technicianId:technicians.find(t=>t.full_name===item.technician_name)?.id||""})}} disabled={formDisabled} title={mutBlockTitle}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={7}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Tipo"><Input disabled={formDisabled} value={editData.failureType} onChange={(e)=>setEditData({...editData,failureType:e.target.value})}/></Field>
                              <Field label="Fecha"><Input disabled={formDisabled} type="date" value={editData.reportedAt} onChange={(e)=>setEditData({...editData,reportedAt:e.target.value})}/></Field>
                              <Field label="Prioridad"><Select disabled={formDisabled} value={editData.priority} onChange={(e)=>setEditData({...editData,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></Select></Field>
                              <Field label="Estado"><Select disabled={formDisabled} value={editData.status} onChange={(e)=>setEditData({...editData,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Resuelta</option></Select></Field>
                              <Field label="Solucion" className="col-span-2"><Textarea disabled={formDisabled} value={editData.solution} onChange={(e)=>setEditData({...editData,solution:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara esta falla de forma permanente."/>
      <ResolveModal open={!!resolveItem} failure={resolveItem} motors={motors} technicians={technicians} onClose={()=>setResolveItem(null)} onConfirm={handleResolve} confirmDisabled={formDisabled} disableTitle={mutBlockTitle}/>
    </div>
  );
}
