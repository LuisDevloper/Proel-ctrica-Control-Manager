import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters, csvExport } from "../hooks/useFilters";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

const filterFn = (item, query) => {
  const hay = `${item.full_name||""} ${item.specialty||""} ${item.phone||""}`.toLowerCase();
  return !query || hay.includes(query.toLowerCase());
};

export function Tecnicos() {
  const [items, setItems]         = useState([]);
  const [editId, setEditId]       = useState(null);
  const [editData, setEditData]   = useState({});
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState({ fullName:"", specialty:"", phone:"", email:"" });
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const filters = useFilters(items, { filterFn, defaultSortField:"full_name", perPage:8 });

  const load = useCallback(async () => {
    setItems(await window.proelectricaApi.getTechnicians());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.fullName) { showToast("El nombre es obligatorio.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createTechnician(form), "Tecnico registrado.");
    if (ok) { setForm({ fullName:"", specialty:"", phone:"", email:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateTechnician({ id: editId, ...editData }), "Tecnico actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteTechnician(deleteId), "Tecnico eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Tecnicos</h2>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar tecnico</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo*"><Input placeholder="Nombre completo" value={form.fullName} onChange={(e)=>setForm({...form,fullName:e.target.value})}/></Field>
            <Field label="Especialidad"><Input placeholder="Especialidad" value={form.specialty} onChange={(e)=>setForm({...form,specialty:e.target.value})}/></Field>
            <Field label="Telefono"><Input placeholder="Telefono" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></Field>
            <Field label="Email"><Input type="email" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave}>Guardar tecnico</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de tecnicos</CardTitle></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por nombre, especialidad o telefono"
            query={filters.query} onQueryChange={filters.setQuery}
            sortOptions={[{value:"full_name",label:"Nombre"},{value:"specialty",label:"Especialidad"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={()=>csvExport("tecnicos.csv",filters.filtered)} exportCount={filters.filtered.length}
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
                            <Button variant="ghost" size="icon" onClick={()=>{setEditId(item.id);setEditData({fullName:item.full_name,specialty:item.specialty||"",phone:item.phone||"",email:item.email||""})}}><Pencil size={13}/></Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)}><Trash2 size={13}/></Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId===item.id&&(
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={5}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Nombre"><Input value={editData.fullName} onChange={(e)=>setEditData({...editData,fullName:e.target.value})}/></Field>
                              <Field label="Especialidad"><Input value={editData.specialty} onChange={(e)=>setEditData({...editData,specialty:e.target.value})}/></Field>
                              <Field label="Telefono"><Input value={editData.phone} onChange={(e)=>setEditData({...editData,phone:e.target.value})}/></Field>
                              <Field label="Email"><Input type="email" value={editData.email} onChange={(e)=>setEditData({...editData,email:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este tecnico de forma permanente."/>
    </div>
  );
}
