import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";

const EXCEL_COLS = [
  { key: "id",          header: "ID",              width: 8  },
  { key: "part_name",   header: "Repuesto",        width: 30 },
  { key: "sku",         header: "SKU / Codigo",    width: 18 },
  { key: "quantity",    header: "Cantidad",         width: 12 },
  { key: "min_stock",   header: "Stock Minimo",    width: 14 },
  { key: "location",    header: "Ubicacion",       width: 22 },
  { key: "created_at",  header: "Fecha Registro",  width: 18 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";

const filterFn = (item, query) => {
  const hay = `${item.part_name||""} ${item.sku||""} ${item.location||""}`.toLowerCase();
  return !query || hay.includes(query.toLowerCase());
};

export function Inventario({ user }) {
  const [items, setItems]       = useState([]);
  const [editId, setEditId]     = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm]         = useState({ partName:"", sku:"", quantity:"", minStock:"", location:"" });
  const { showToast }           = useToast();
  const { run }                 = useAsync();
  const { dbWritable }          = useDbHealth();
  const dbTitle                 = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate               = canMutateRecords(user?.role);
  const mutBlockTitle           = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled            = !dbWritable || !canMutate;

  const filters = useFilters(items, { filterFn, defaultSortField:"part_name", perPage:10 });

  const load = useCallback(async () => {
    setItems(await window.proelectricaApi.getInventoryItems());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.partName) { showToast("Nombre del repuesto es obligatorio.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createInventoryItem({ ...form, quantity: Number(form.quantity||0), minStock: Number(form.minStock||0) }), "Repuesto registrado.");
    if (ok) { setForm({ partName:"", sku:"", quantity:"", minStock:"", location:"" }); load(); }
  }

  async function handleUpdate() {
    const { ok } = await run(() => window.proelectricaApi.updateInventoryItem({ id: editId, ...editData, quantity: Number(editData.quantity||0), minStock: Number(editData.minStock||0) }), "Repuesto actualizado.");
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteInventoryItem(deleteId), "Repuesto eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Inventario</h2>

      {!canMutate && (
        <p className="text-sm text-[#9ab0c7] bg-[#2f8dff]/5 border border-[#2f8dff]/20 rounded-xl px-4 py-2">
          Modulo en modo solo lectura: consulta y exportacion permitidas; no altas ni ediciones de stock.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar repuesto</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Nombre*"><Input disabled={formDisabled} placeholder="Nombre del repuesto" value={form.partName} onChange={(e)=>setForm({...form,partName:e.target.value})}/></Field>
            <Field label="SKU"><Input disabled={formDisabled} placeholder="SKU/Codigo" value={form.sku} onChange={(e)=>setForm({...form,sku:e.target.value})}/></Field>
            <Field label="Ubicacion"><Input disabled={formDisabled} placeholder="Ubicacion" value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></Field>
            <Field label="Cantidad"><Input disabled={formDisabled} type="number" placeholder="0" value={form.quantity} onChange={(e)=>setForm({...form,quantity:e.target.value})}/></Field>
            <Field label="Stock minimo"><Input disabled={formDisabled} type="number" placeholder="0" value={form.minStock} onChange={(e)=>setForm({...form,minStock:e.target.value})}/></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar repuesto</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de repuestos</CardTitle></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por repuesto, codigo o ubicacion"
            query={filters.query} onQueryChange={filters.setQuery}
            sortOptions={[{value:"part_name",label:"Repuesto"},{value:"quantity",label:"Cantidad"},{value:"min_stock",label:"Stock min"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            onExport={() => xlsxExport("Inventario", "Inventario de Repuestos", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay repuestos para mostrar.</p>
            : <Table>
                <Thead>
                  <tr><Th>Repuesto</Th><Th>SKU</Th><Th>Cantidad</Th><Th>Minimo</Th><Th>Ubicacion</Th><Th>Estado stock</Th><Th>Acciones</Th></tr>
                </Thead>
                <Tbody>
                  {filters.paged.map(item => (
                    <React.Fragment key={item.id}>
                      <Tr>
                        <Td className="font-medium">{item.part_name}</Td>
                        <Td className="text-[#9ab0c7]">{item.sku||"N/A"}</Td>
                        <Td>{item.quantity}</Td>
                        <Td className="text-[#9ab0c7]">{item.min_stock}</Td>
                        <Td className="text-[#9ab0c7]">{item.location||"—"}</Td>
                        <Td>
                          <Badge variant={item.quantity <= item.min_stock ? "danger" : "success"}>
                            {item.quantity <= item.min_stock ? "Bajo" : "OK"}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={()=>{ setEditId(item.id); setEditData({partName:item.part_name,sku:item.sku||"",quantity:item.quantity,minStock:item.min_stock,location:item.location||""}); }} disabled={formDisabled} title={mutBlockTitle}>
                              <Pencil size={13}/>
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={()=>setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}>
                              <Trash2 size={13}/>
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId === item.id && (
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={7}>
                            <div className="grid grid-cols-3 gap-3 py-1">
                              <Field label="Nombre"><Input disabled={formDisabled} value={editData.partName} onChange={(e)=>setEditData({...editData,partName:e.target.value})}/></Field>
                              <Field label="SKU"><Input disabled={formDisabled} value={editData.sku} onChange={(e)=>setEditData({...editData,sku:e.target.value})}/></Field>
                              <Field label="Ubicacion"><Input disabled={formDisabled} value={editData.location} onChange={(e)=>setEditData({...editData,location:e.target.value})}/></Field>
                              <Field label="Cantidad"><Input disabled={formDisabled} type="number" value={editData.quantity} onChange={(e)=>setEditData({...editData,quantity:e.target.value})}/></Field>
                              <Field label="Stock minimo"><Input disabled={formDisabled} type="number" value={editData.minStock} onChange={(e)=>setEditData({...editData,minStock:e.target.value})}/></Field>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este repuesto de forma permanente."/>
    </div>
  );
}
