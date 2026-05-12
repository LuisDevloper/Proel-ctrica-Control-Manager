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
  { key: "code",        header: "Código",          width: 14 },
  { key: "name",        header: "Nombre",           width: 28 },
  { key: "type",        header: "Tipo",             width: 18 },
  { key: "power_kw",   header: "Potencia (kW)",    width: 16 },
  { key: "voltage",    header: "Voltaje (V)",       width: 14 },
  { key: "status",     header: "Estado",            width: 18 },
  { key: "location",   header: "Ubicacion",         width: 24 },
  { key: "brand",      header: "Marca",             width: 16 },
  { key: "model",      header: "Modelo",            width: 16 },
  { key: "installed_at", header: "Instalacion",     width: 16 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { SkeletonTable } from "../components/ui/Skeleton";
import { MotorDetail } from "./MotorDetail";
import { Pencil, Trash2, Plus, X, Check, Eye } from "lucide-react";

const STATUS_OPTIONS = ["Operativo", "En mantenimiento", "Fuera de servicio"];

const filterFn = (item, query, status) => {
  const hay = `${item.code} ${item.brand} ${item.model || ""} ${item.location || ""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && (!status || item.status === status);
};

export function Motores() {
  const [motors, setMotors]       = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [detailId, setDetailId]   = useState(null);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ code: "", brand: "", model: "", location: "", status: "Operativo", notes: "" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();

  const filters = useFilters(motors, {
    filterFn,
    defaultSortField: "code",
    perPage: 8
  });

  const load = useCallback(async () => {
    setLoadingData(true);
    setMotors(await window.proelectricaApi.getMotors());
    setLoadingData(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.code || !form.brand) { showToast("Codigo y marca son obligatorios.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createMotor(form), "Motor registrado.");
    if (ok) { setForm({ code: "", brand: "", model: "", location: "", status: "Operativo", notes: "" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateMotor({ id: editId, ...editData }), "Motor actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteMotor(deleteId), "Motor eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  if (detailId) return <MotorDetail motorId={detailId} onBack={() => setDetailId(null)} />;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Motores</h2>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar motor</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Codigo*"><Input placeholder="Codigo interno" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} /></Field>
            <Field label="Marca*"><Input placeholder="Marca" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} /></Field>
            <Field label="Modelo"><Input placeholder="Modelo" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} /></Field>
            <Field label="Ubicacion"><Input placeholder="Ubicacion" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} /></Field>
            <Field label="Estado">
              <Select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Observaciones"><Textarea placeholder="Notas..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></Field>
          </div>
          <Button className="mt-2" onClick={handleSave}>Guardar motor</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de motores</CardTitle></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por codigo, marca o ubicacion"
            query={filters.query} onQueryChange={filters.setQuery}
            statusOptions={STATUS_OPTIONS} status={filters.status} onStatusChange={filters.setStatus}
            sortOptions={[{value:"code",label:"Codigo"},{value:"brand",label:"Marca"},{value:"status",label:"Estado"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={() => xlsxExport("Motores", "Registro de Motores", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {loadingData
            ? <SkeletonTable rows={5} cols={5} />
            : filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay motores para mostrar.</p>
            : <Table>
                <Thead>
                  <tr>
                    <Th>Codigo</Th><Th>Marca / Modelo</Th><Th>Ubicacion</Th><Th>Estado</Th><Th>Acciones</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filters.paged.map(motor => (
                    <React.Fragment key={motor.id}>
                      <Tr>
                        <Td className="font-medium">{motor.code}</Td>
                        <Td>{motor.brand} {motor.model || ""}</Td>
                        <Td className="text-[#9ab0c7]">{motor.location || "—"}</Td>
                        <Td><Badge variant={statusBadgeVariant(motor.status)}>{motor.status}</Badge></Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => setDetailId(motor.id)}>
                              <Eye size={13}/>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditId(motor.id); setEditData({code:motor.code,brand:motor.brand,model:motor.model||"",location:motor.location||"",status:motor.status,notes:motor.notes||""}); }}>
                              <Pencil size={13}/>
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={() => setDeleteId(motor.id)}>
                              <Trash2 size={13}/>
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId === motor.id && (
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={5}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Codigo"><Input value={editData.code} onChange={(e)=>setEditData({...editData,code:e.target.value})}/></Field>
                              <Field label="Marca"><Input value={editData.brand} onChange={(e)=>setEditData({...editData,brand:e.target.value})}/></Field>
                              <Field label="Modelo"><Input value={editData.model} onChange={(e)=>setEditData({...editData,model:e.target.value})}/></Field>
                              <Field label="Ubicacion"><Input value={editData.location} onChange={(e)=>setEditData({...editData,location:e.target.value})}/></Field>
                              <Field label="Estado"><Select value={editData.status} onChange={(e)=>setEditData({...editData,status:e.target.value})}>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</Select></Field>
                              <Field label="Notas"><Textarea value={editData.notes} onChange={(e)=>setEditData({...editData,notes:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este motor de forma permanente."/>
    </div>
  );
}
