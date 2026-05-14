import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";
import { ImportModal } from "../components/ui/ImportModal";
import { FileSpreadsheet } from "lucide-react";

const EXCEL_COLS = [
  { key: "id",           header: "ID",              width: 8  },
  { key: "name",         header: "Nombre",          width: 28 },
  { key: "specialty",    header: "Especialidad",    width: 24 },
  { key: "phone",        header: "Telefono",        width: 18 },
  { key: "email",        header: "Correo",          width: 28 },
  { key: "status",       header: "Estado",          width: 14 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";

const filterFn = (item, query) => {
  const hay = `${item.full_name||""} ${item.specialty||""} ${item.phone||""}`.toLowerCase();
  return !query || hay.includes(query.toLowerCase());
};

export function Tecnicos({ user }) {
  const [items, setItems]         = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ fullName:"", specialty:"", phone:"", email:"" });
  const [showImport, setShowImport] = useState(false);
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const { dbWritable }            = useDbHealth();
  const dbTitle                   = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate                 = canMutateRecords(user?.role);
  const mutBlockTitle             = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled              = !dbWritable || !canMutate;
  const filters = useFilters(items, { filterFn, defaultSortField:"full_name", perPage:8 });

  const load = useCallback(async () => {
    setItems(await window.proelectricaApi.getTechnicians());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.fullName) { showToast("El nombre es obligatorio.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createTechnician({ ...form, _username: user?.username }), "Tecnico registrado.");
    if (ok) { setForm({ fullName:"", specialty:"", phone:"", email:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateTechnician({ id: editId, ...editData, _username: user?.username }), "Tecnico actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteTechnician(deleteId), "Tecnico eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <ImportModal open={showImport} entity="technicians" user={user} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); load(); }} />

      <h2 className="text-xl font-bold text-[#eaf2fb]">Tecnicos</h2>

      {!canMutate && (
        <p className="text-sm text-[#9ab0c7] bg-[#2f8dff]/5 border border-[#2f8dff]/20 rounded-xl px-4 py-2">
          Modulo en modo solo lectura: puedes consultar y exportar, no registrar ni editar tecnicos.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar tecnico</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo*"><Input disabled={formDisabled} placeholder="Nombre completo" value={form.fullName} onChange={(e)=>setForm({...form,fullName:e.target.value})}/></Field>
            <Field label="Especialidad"><Input disabled={formDisabled} placeholder="Especialidad" value={form.specialty} onChange={(e)=>setForm({...form,specialty:e.target.value})}/></Field>
            <Field label="Telefono"><Input disabled={formDisabled} placeholder="Telefono" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></Field>
            <Field label="Email"><Input disabled={formDisabled} type="email" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar tecnico</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de tecnicos</CardTitle>
            <Button variant="ghost" size="sm" className="border border-[#2a3d57] text-[#9ab0c7]" onClick={() => setShowImport(true)} disabled={formDisabled} title={mutBlockTitle}>
              <FileSpreadsheet size={13} className="mr-1" /> Importar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por nombre, especialidad o telefono"
            query={filters.query} onQueryChange={filters.setQuery}
            sortOptions={[{value:"full_name",label:"Nombre"},{value:"specialty",label:"Especialidad"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={() => xlsxExport("Tecnicos", "Registro de Tecnicos", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay tecnicos para mostrar.</p>
            : <Table>
                <Thead><tr><Th>Nombre</Th><Th>Especialidad</Th><Th>Telefono</Th><Th>Email</Th><Th>Acciones</Th></tr></Thead>
                <Tbody>
                  {filters.paged.map(item=>(
                    <React.Fragment key={item.id}>
                      <Tr>
                        <Td className="font-medium">{item.full_name}</Td>
                        <Td className="text-[#9ab0c7]">{item.specialty||"—"}</Td>
                        <Td className="text-[#9ab0c7]">{item.phone||"—"}</Td>
                        <Td className="text-[#9ab0c7]">{item.email||"—"}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({fullName:item.full_name,specialty:item.specialty||"",phone:item.phone||"",email:item.email||""})}} disabled={formDisabled} title={mutBlockTitle}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={5}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Nombre"><Input disabled={formDisabled} value={editData.fullName} onChange={(e)=>setEditData({...editData,fullName:e.target.value})}/></Field>
                              <Field label="Especialidad"><Input disabled={formDisabled} value={editData.specialty} onChange={(e)=>setEditData({...editData,specialty:e.target.value})}/></Field>
                              <Field label="Telefono"><Input disabled={formDisabled} value={editData.phone} onChange={(e)=>setEditData({...editData,phone:e.target.value})}/></Field>
                              <Field label="Email"><Input disabled={formDisabled} type="email" value={editData.email} onChange={(e)=>setEditData({...editData,email:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este tecnico de forma permanente."/>
    </div>
  );
}
