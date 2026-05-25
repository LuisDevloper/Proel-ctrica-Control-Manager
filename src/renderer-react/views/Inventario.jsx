import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea, Field } from "../components/ui/Input";
import { Badge, MovementTypeBadge } from "../components/ui/Badge";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { Pencil, Trash2, Plus, X, Check, Package, FileText, ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import { exportInventoryPDF } from "../lib/pdfReport";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";
import { PageHeader } from "../components/ui/PageHeader";
import { ReadOnlyBanner } from "../components/ui/ReadOnlyBanner";
import { EmptyState } from "../components/ui/EmptyState";
import {
  MOVEMENT_TYPE_OPTIONS,
  MOVEMENT_FILTER_OPTIONS,
  REFERENCE_TYPE_OPTIONS,
} from "../lib/inventory";

const EXCEL_COLS = [
  { key: "part_name", header: "Repuesto", width: 30 },
  { key: "sku", header: "SKU / Codigo", width: 18 },
  { key: "quantity", header: "Cantidad", width: 12 },
  { key: "min_stock", header: "Stock Minimo", width: 14 },
  { key: "location", header: "Ubicacion", width: 22 },
];

const MOVEMENT_EXCEL_COLS = [
  { key: "partName", header: "Repuesto", width: 24 },
  { key: "movementType", header: "Tipo", width: 12 },
  { key: "quantity", header: "Cantidad", width: 10 },
  { key: "stockBefore", header: "Stock antes", width: 12 },
  { key: "stockAfter", header: "Stock despues", width: 12 },
  { key: "referenceLabel", header: "Referencia", width: 24 },
  { key: "createdBy", header: "Usuario", width: 14 },
  { key: "createdAt", header: "Fecha", width: 18 },
];

const itemFilterFn = (item, query) => {
  const hay = `${item.part_name || ""} ${item.sku || ""} ${item.location || ""}`.toLowerCase();
  return !query || hay.includes(query.toLowerCase());
};

const movementFilterFn = (item, query, _status, typeFilter) => {
  const hay = `${item.partName || ""} ${item.referenceLabel || ""} ${item.notes || ""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase()))
    && (!typeFilter || item.movementType === typeFilter);
};

function InventarioTabs({ tab, onTabChange }) {
  const tabs = [
    { id: "stock", label: "Stock", icon: Package },
    { id: "movimientos", label: "Movimientos", icon: History },
  ];
  return (
    <div className="flex gap-2 mb-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
            tab === id
              ? "bg-[#2f8dff22] text-[#5fb3ff] border-[#2f8dff66]"
              : "bg-transparent text-[#9ab0c7] border-[#2a3d57] hover:bg-white/5"
          }`}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

export function Inventario({ user }) {
  const [tab, setTab] = useState("stock");
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ partName: "", sku: "", quantity: "", minStock: "", location: "" });
  const [movForm, setMovForm] = useState({
    inventoryItemId: "",
    movementType: "entrada",
    quantity: "",
    referenceType: "manual",
    referenceId: "",
    notes: "",
  });
  const { showToast } = useToast();
  const { run } = useAsync();
  const { dbWritable } = useDbHealth();
  const dbTitle = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate = canMutateRecords(user?.role);
  const mutBlockTitle = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled = !dbWritable || !canMutate;

  const itemFilters = useFilters(items, { filterFn: itemFilterFn, defaultSortField: "part_name", perPage: 10 });
  const movFilters = useFilters(movements, { filterFn: movementFilterFn, defaultSortField: "createdAt", perPage: 12 });

  const load = useCallback(async () => {
    const [inv, movs, mtn, ships] = await Promise.all([
      window.proelectricaApi.getInventoryItems(),
      window.proelectricaApi.getInventoryMovements({ limit: 300 }),
      window.proelectricaApi.getMaintenances(),
      window.proelectricaApi.getExternalShipments(),
    ]);
    setItems(inv || []);
    setMovements(movs || []);
    setMaintenances(mtn || []);
    setShipments(ships || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.partName) { showToast("Nombre del repuesto es obligatorio.", "warning"); return; }
    const { ok } = await run(
      () => window.proelectricaApi.createInventoryItem({
        ...form,
        quantity: Number(form.quantity || 0),
        minStock: Number(form.minStock || 0),
        _username: user?.username,
      }),
      "Repuesto registrado."
    );
    if (ok) {
      setForm({ partName: "", sku: "", quantity: "", minStock: "", location: "" });
      load();
    }
  }

  async function handleMovement() {
    if (!movForm.inventoryItemId || !movForm.quantity) {
      showToast("Repuesto y cantidad son obligatorios.", "warning");
      return;
    }
    const { ok } = await run(
      () => window.proelectricaApi.createInventoryMovement({
        inventoryItemId: movForm.inventoryItemId,
        movementType: movForm.movementType,
        quantity: Number(movForm.quantity),
        referenceType: movForm.referenceType,
        referenceId: movForm.referenceId || null,
        notes: movForm.notes,
        _username: user?.username,
      }),
      movForm.movementType === "entrada" ? "Entrada registrada." : "Salida registrada."
    );
    if (ok) {
      setMovForm({
        inventoryItemId: movForm.inventoryItemId,
        movementType: "entrada",
        quantity: "",
        referenceType: "manual",
        referenceId: "",
        notes: "",
      });
      load();
    }
  }

  async function handleUpdate() {
    const { ok } = await run(
      () => window.proelectricaApi.updateInventoryItem({
        id: editId,
        partName: editData.partName,
        sku: editData.sku,
        minStock: Number(editData.minStock || 0),
        location: editData.location,
        _username: user?.username,
      }),
      "Repuesto actualizado."
    );
    if (ok) { setEditId(null); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteInventoryItem(deleteId), "Repuesto eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  function quickMovement(item, type) {
    setMovForm((f) => ({
      ...f,
      inventoryItemId: String(item.id),
      movementType: type,
      quantity: "",
    }));
    setTab("movimientos");
  }

  const referenceOptions = movForm.referenceType === "maintenance"
    ? maintenances.map((m) => ({
        id: m.id,
        label: `#${m.id} ${m.maintenance_type} — ${m.motor_code}`,
      }))
    : movForm.referenceType === "external_shipment"
      ? shipments.map((s) => ({
          id: s.id,
          label: `#${s.id} ${s.workshopName} — ${s.equipmentCode}`,
        }))
      : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Inventario" description="Stock, entradas, salidas e historial de movimientos" icon={Package} />

      {!canMutate && (
        <ReadOnlyBanner message="Estas viendo inventario en modo solo lectura." />
      )}

      <InventarioTabs tab={tab} onTabChange={setTab} />

      {tab === "stock" && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar repuesto</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Nombre*"><Input disabled={formDisabled} placeholder="Nombre del repuesto" value={form.partName} onChange={(e) => setForm({ ...form, partName: e.target.value })}/></Field>
                <Field label="SKU"><Input disabled={formDisabled} placeholder="SKU/Codigo" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}/></Field>
                <Field label="Ubicacion"><Input disabled={formDisabled} placeholder="Ubicacion en almacen" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}/></Field>
                <Field label="Stock inicial"><Input disabled={formDisabled} type="number" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}/></Field>
                <Field label="Stock minimo"><Input disabled={formDisabled} type="number" placeholder="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })}/></Field>
              </div>
              <p className="text-xs text-[#7a9bb8] mt-2">El stock inicial se registra como una entrada automatica en el historial.</p>
              <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar repuesto</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stock actual</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => {
                  if (!itemFilters.filtered.length) { showToast("No hay datos para exportar.", "warning"); return; }
                  exportInventoryPDF(itemFilters.filtered);
                }}>
                  <FileText size={13} className="mr-1" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <FilterBar
                searchPlaceholder="Buscar repuesto, codigo o ubicacion"
                query={itemFilters.query} onQueryChange={itemFilters.setQuery}
                sortOptions={[
                  { value: "part_name", label: "Repuesto" },
                  { value: "quantity", label: "Cantidad" },
                  { value: "min_stock", label: "Stock min" },
                ]}
                sortField={itemFilters.sortField} onSortFieldChange={itemFilters.setSortField}
                sortDir={itemFilters.sortDir} onSortDirChange={itemFilters.setSortDir}
                onExport={() => xlsxExport("Inventario", "Inventario de Repuestos", EXCEL_COLS, itemFilters.filtered)}
                exportCount={itemFilters.filtered.length}
                onClear={itemFilters.reset}
              />
              {itemFilters.paged.length === 0 ? (
                <EmptyState message="No hay repuestos para mostrar." />
              ) : (
                <Table>
                  <Thead>
                    <tr><Th>Repuesto</Th><Th>SKU</Th><Th>Stock</Th><Th>Minimo</Th><Th>Ubicacion</Th><Th>Estado</Th><Th>Acciones</Th></tr>
                  </Thead>
                  <Tbody>
                    {itemFilters.paged.map((item) => (
                      <React.Fragment key={item.id}>
                        <Tr>
                          <Td className="font-medium">{item.part_name}</Td>
                          <Td className="text-[#9ab0c7]">{item.sku || "—"}</Td>
                          <Td className="font-semibold">{item.quantity}</Td>
                          <Td className="text-[#9ab0c7]">{item.min_stock}</Td>
                          <Td className="text-[#9ab0c7]">{item.location || "—"}</Td>
                          <Td>
                            <Badge variant={item.quantity <= item.min_stock ? "danger" : "success"}>
                              {item.quantity <= item.min_stock ? "Bajo" : "OK"}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title="Registrar entrada" onClick={() => quickMovement(item, "entrada")} disabled={formDisabled}>
                                <ArrowDownCircle size={14} className="text-[#29a16a]" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Registrar salida" onClick={() => quickMovement(item, "salida")} disabled={formDisabled}>
                                <ArrowUpCircle size={14} className="text-[#e07070]" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setEditId(item.id); setEditData({ partName: item.part_name, sku: item.sku || "", minStock: item.min_stock, location: item.location || "" }); }} disabled={formDisabled} title={mutBlockTitle}>
                                <Pencil size={13}/>
                              </Button>
                              <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={() => setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}>
                                <Trash2 size={13}/>
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                        {editId === item.id && (
                          <Tr className="bg-[#0d1e30]">
                            <Td colSpan={7}>
                              <div className="grid grid-cols-3 gap-3 py-1">
                                <Field label="Nombre"><Input disabled={formDisabled} value={editData.partName} onChange={(e) => setEditData({ ...editData, partName: e.target.value })}/></Field>
                                <Field label="SKU"><Input disabled={formDisabled} value={editData.sku} onChange={(e) => setEditData({ ...editData, sku: e.target.value })}/></Field>
                                <Field label="Ubicacion"><Input disabled={formDisabled} value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })}/></Field>
                                <Field label="Stock minimo"><Input disabled={formDisabled} type="number" value={editData.minStock} onChange={(e) => setEditData({ ...editData, minStock: e.target.value })}/></Field>
                                <Field label="Stock actual"><Input disabled value={item.quantity} title="Use movimientos para cambiar el stock"/></Field>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={handleUpdate} disabled={formDisabled} title={mutBlockTitle}><Check size={13} className="mr-1"/>Guardar</Button>
                                <Button size="sm" variant="secondary" onClick={() => setEditId(null)}><X size={13} className="mr-1"/>Cancelar</Button>
                              </div>
                            </Td>
                          </Tr>
                        )}
                      </React.Fragment>
                    ))}
                  </Tbody>
                </Table>
              )}
              <Pager page={itemFilters.page} totalPages={itemFilters.totalPages} onPrev={() => itemFilters.setPage(itemFilters.page - 1)} onNext={() => itemFilters.setPage(itemFilters.page + 1)} total={itemFilters.filtered.length} perPage={itemFilters.perPage}/>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "movimientos" && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownCircle size={15}/> Registrar entrada o salida</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Repuesto*">
                  <Select disabled={formDisabled} value={movForm.inventoryItemId} onChange={(e) => setMovForm({ ...movForm, inventoryItemId: e.target.value })}>
                    <option value="">Seleccionar</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.part_name} (stock: {i.quantity})</option>)}
                  </Select>
                </Field>
                <Field label="Tipo*">
                  <Select disabled={formDisabled} value={movForm.movementType} onChange={(e) => setMovForm({ ...movForm, movementType: e.target.value })}>
                    {MOVEMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="Cantidad*"><Input disabled={formDisabled} type="number" min="1" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })}/></Field>
                <Field label="Referencia">
                  <Select disabled={formDisabled} value={movForm.referenceType} onChange={(e) => setMovForm({ ...movForm, referenceType: e.target.value, referenceId: "" })}>
                    {REFERENCE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                {movForm.referenceType !== "manual" && (
                  <Field label="Vinculo">
                    <Select disabled={formDisabled} value={movForm.referenceId} onChange={(e) => setMovForm({ ...movForm, referenceId: e.target.value })}>
                      <option value="">Seleccionar</option>
                      {referenceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Notas" className="col-span-3"><Textarea disabled={formDisabled} value={movForm.notes} onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })}/></Field>
              </div>
              <Button className="mt-2" onClick={handleMovement} disabled={formDisabled} title={mutBlockTitle}>
                {movForm.movementType === "entrada" ? "Registrar entrada" : "Registrar salida"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History size={15}/> Historial de movimientos</CardTitle></CardHeader>
            <CardContent>
              <FilterBar
                searchPlaceholder="Buscar por repuesto o referencia"
                query={movFilters.query} onQueryChange={movFilters.setQuery}
                locationOptions={MOVEMENT_FILTER_OPTIONS}
                location={movFilters.location}
                onLocationChange={movFilters.setLocation}
                sortOptions={[
                  { value: "createdAt", label: "Fecha" },
                  { value: "partName", label: "Repuesto" },
                  { value: "movementType", label: "Tipo" },
                ]}
                sortField={movFilters.sortField} onSortFieldChange={movFilters.setSortField}
                sortDir={movFilters.sortDir} onSortDirChange={movFilters.setSortDir}
                onExport={() => xlsxExport("Movimientos", "Historial de Almacen", MOVEMENT_EXCEL_COLS, movFilters.filtered)}
                exportCount={movFilters.filtered.length}
                onClear={movFilters.reset}
              />
              {movFilters.paged.length === 0 ? (
                <EmptyState message="Sin movimientos registrados." />
              ) : (
                <Table>
                  <Thead>
                    <tr><Th>Fecha</Th><Th>Repuesto</Th><Th>Tipo</Th><Th>Cant.</Th><Th>Antes</Th><Th>Despues</Th><Th>Referencia</Th><Th>Usuario</Th></tr>
                  </Thead>
                  <Tbody>
                    {movFilters.paged.map((m) => (
                      <Tr key={m.id}>
                        <Td className="text-xs text-[#9ab0c7]">{m.createdAt ? new Date(m.createdAt).toLocaleString("es-CO") : "—"}</Td>
                        <Td className="font-medium">{m.partName}</Td>
                        <Td><MovementTypeBadge type={m.movementType} /></Td>
                        <Td>{m.quantity}</Td>
                        <Td className="text-[#9ab0c7]">{m.stockBefore}</Td>
                        <Td className="font-semibold text-[#eaf2fb]">{m.stockAfter}</Td>
                        <Td className="text-xs text-[#9ab0c7] max-w-[180px] truncate">{m.referenceLabel || m.referenceType || "—"}</Td>
                        <Td className="text-xs text-[#7a9bb8]">{m.createdBy || "—"}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
              <Pager page={movFilters.page} totalPages={movFilters.totalPages} onPrev={() => movFilters.setPage(movFilters.page - 1)} onNext={() => movFilters.setPage(movFilters.page + 1)} total={movFilters.filtered.length} perPage={movFilters.perPage}/>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara el repuesto y todo su historial de movimientos."/>
    </div>
  );
}
