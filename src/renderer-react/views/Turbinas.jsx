import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea, Field } from "../components/ui/Input";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { Plus, Pencil, Trash2, X, Check, Paperclip, Fan } from "lucide-react";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";
import { ReadOnlyBanner } from "../components/ui/ReadOnlyBanner";
import { EmptyState } from "../components/ui/EmptyState";
import {
  EQUIPMENT_STATUS_OPTIONS,
  LOCATION_FILTER_OPTIONS,
  OPERATIONAL_LOCATIONS,
  matchesLocationFilter,
} from "../lib/equipment";
import { OperationalStatusBadge, OperationalLocationBadge } from "../components/ui/Badge";
import { DocumentsModal } from "../components/documents/EntityDocuments";

const EXCEL_COLS = [
  { key: "code", header: "Codigo", width: 14 },
  { key: "gg", header: "GG", width: 12 },
  { key: "pt", header: "PT", width: 12 },
  { key: "bearing_1", header: "Rodamiento 1", width: 18 },
  { key: "bearing_2", header: "Rodamiento 2", width: 18 },
  { key: "operational_location", header: "Ubicacion", width: 18 },
  { key: "status", header: "Estado", width: 16 },
  { key: "motor_code", header: "Motor vinculado", width: 16 },
  { key: "runtime_retiro", header: "Runtime retiro", width: 16 },
  { key: "notes", header: "Notas", width: 28 },
];

const EMPTY_FORM = {
  code: "",
  gg: "",
  pt: "",
  bearing_1: "",
  bearing_2: "",
  runtime_retiro: "",
  comentarios_retiro: "",
  operational_location: "En planta",
  status: "Operativo",
  motor_id: "",
  notes: "",
};

const TURBINE_EDIT_FIELDS = [
  "code", "gg", "pt", "bearing_1", "bearing_2", "runtime_retiro", "comentarios_retiro",
  "operational_location", "status", "motor_id", "notes",
];

function turbineEditSnapshot(item) {
  return {
    code: item.code,
    gg: item.gg || "",
    pt: item.pt || "",
    bearing_1: item.bearing_1 || "",
    bearing_2: item.bearing_2 || "",
    runtime_retiro: item.runtime_retiro || "",
    comentarios_retiro: item.comentarios_retiro || "",
    operational_location: item.operational_location || "En planta",
    status: item.status || "Operativo",
    motor_id: item.motor_id || "",
    notes: item.notes || "",
  };
}

const filterFn = (item, query, status, location) => {
  const hay = `${item.code} ${item.gg || ""} ${item.pt || ""} ${item.motor_code || ""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase()))
    && (!status || item.status === status)
    && matchesLocationFilter(item, location);
};

export function TurbinasPanel({ user }) {
  const [items, setItems] = useState([]);
  const [motors, setMotors] = useState([]);
  const { editId, editData, setEditData, openEdit, closeEdit, isEditUnchanged, guardEditSave } = useInlineEdit();
  const [deleteId, setDeleteId] = useState(null);
  const [docsTarget, setDocsTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { showToast } = useToast();
  const { run } = useAsync();
  const { dbWritable } = useDbHealth();
  const dbTitle = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate = canMutateRecords(user?.role);
  const mutBlockTitle = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled = !dbWritable || !canMutate;
  const filters = useFilters(items, { filterFn, defaultSortField: "code", perPage: 8 });

  const load = useCallback(async () => {
    const [turbinas, motorList] = await Promise.all([
      window.proelectricaApi.getTurbinas(),
      window.proelectricaApi.getMotors(),
    ]);
    setItems(turbinas);
    setMotors(motorList);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.code) { showToast("El codigo es obligatorio.", "warning"); return; }
    const payload = {
      code: form.code,
      gg: form.gg,
      pt: form.pt,
      bearing1: form.bearing_1,
      bearing2: form.bearing_2,
      runtimeRetiro: form.runtime_retiro,
      comentariosRetiro: form.comentarios_retiro,
      operationalLocation: form.operational_location,
      status: form.status,
      motorId: form.motor_id || null,
      notes: form.notes,
      _username: user?.username,
    };
    const { ok, message } = await run(() => window.proelectricaApi.createTurbina(payload), "Turbina registrada.");
    if (ok) { setForm(EMPTY_FORM); load(); }
    else if (message) showToast(message, "warning");
  }

  async function handleUpdate() {
    if (!guardEditSave(TURBINE_EDIT_FIELDS, showToast)) return;
    const payload = {
      id: editId,
      code: editData.code,
      gg: editData.gg,
      pt: editData.pt,
      bearing1: editData.bearing_1,
      bearing2: editData.bearing_2,
      runtimeRetiro: editData.runtime_retiro,
      comentariosRetiro: editData.comentarios_retiro,
      operationalLocation: editData.operational_location,
      status: editData.status,
      motorId: editData.motor_id || null,
      notes: editData.notes,
      _username: user?.username,
    };
    const { ok, message } = await run(() => window.proelectricaApi.updateTurbina(payload), "Turbina actualizada.");
    if (ok) { closeEdit(); load(); }
    else if (message) showToast(message, "warning");
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteTurbina(deleteId), "Turbina eliminada.");
    if (ok) { setDeleteId(null); load(); }
  }

  function startEdit(item) {
    openEdit(item.id, turbineEditSnapshot(item));
  }

  return (
    <div className="flex flex-col gap-4">
      {!canMutate && (
        <ReadOnlyBanner message="Estas viendo turbinas en modo solo lectura." />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar turbina</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Codigo*"><Input disabled={formDisabled} placeholder="Ej: TUR-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="GG"><Input disabled={formDisabled} placeholder="GG" value={form.gg} onChange={(e) => setForm({ ...form, gg: e.target.value })} /></Field>
            <Field label="PT"><Input disabled={formDisabled} placeholder="PT" value={form.pt} onChange={(e) => setForm({ ...form, pt: e.target.value })} /></Field>
            <Field label="Rodamiento #1"><Input disabled={formDisabled} value={form.bearing_1} onChange={(e) => setForm({ ...form, bearing_1: e.target.value })} /></Field>
            <Field label="Rodamiento #2"><Input disabled={formDisabled} value={form.bearing_2} onChange={(e) => setForm({ ...form, bearing_2: e.target.value })} /></Field>
            <Field label="Motor vinculado">
              <Select disabled={formDisabled} value={form.motor_id} onChange={(e) => setForm({ ...form, motor_id: e.target.value })}>
                <option value="">Sin vincular</option>
                {motors.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
              </Select>
            </Field>
            <Field label="Ubicacion operativa">
              <Select disabled={formDisabled} value={form.operational_location} onChange={(e) => setForm({ ...form, operational_location: e.target.value })}>
                {OPERATIONAL_LOCATIONS.map((loc) => <option key={loc}>{loc}</option>)}
              </Select>
            </Field>
            <Field label="Estado">
              <Select disabled={formDisabled} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {EQUIPMENT_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Runtime de retiro"><Input disabled={formDisabled} placeholder="Horas / valor" value={form.runtime_retiro} onChange={(e) => setForm({ ...form, runtime_retiro: e.target.value })} /></Field>
            <Field label="Comentarios de retiro" className="col-span-3"><Textarea disabled={formDisabled} value={form.comentarios_retiro} onChange={(e) => setForm({ ...form, comentarios_retiro: e.target.value })} /></Field>
            <Field label="Notas" className="col-span-3"><Textarea disabled={formDisabled} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar turbina</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Fan size={15}/> Lista de turbinas</CardTitle></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por codigo, GG, PT o motor"
            query={filters.query} onQueryChange={filters.setQuery}
            statusOptions={EQUIPMENT_STATUS_OPTIONS} status={filters.status} onStatusChange={filters.setStatus}
            locationOptions={LOCATION_FILTER_OPTIONS} location={filters.location} onLocationChange={filters.setLocation}
            sortOptions={[
              { value: "code", label: "Codigo" },
              { value: "operational_location", label: "Ubicacion" },
              { value: "status", label: "Estado" },
            ]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            perPage={filters.perPage} onPerPageChange={filters.setPerPage}
            onExport={() => xlsxExport("Turbinas", "Registro de Turbinas", EXCEL_COLS, filters.filtered)}
            exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0 ? (
            <EmptyState message="No hay turbinas para mostrar." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Codigo</Th><Th>GG / PT</Th><Th>Rodamientos</Th><Th>Ubicacion</Th><Th>Estado</Th><Th>Motor</Th><Th>Docs</Th><Th>Acciones</Th>
                </tr>
              </Thead>
              <Tbody>
                {filters.paged.map((item) => (
                  <React.Fragment key={item.id}>
                    <Tr>
                      <Td className="font-medium">{item.code}</Td>
                      <Td className="text-[#9ab0c7]">{item.gg || "—"} / {item.pt || "—"}</Td>
                      <Td className="text-xs text-[#9ab0c7]">{item.bearing_1 || "—"} · {item.bearing_2 || "—"}</Td>
                      <Td><OperationalLocationBadge location={item.operational_location} /></Td>
                      <Td><OperationalStatusBadge status={item.status} /></Td>
                      <Td className="text-[#9ab0c7]">{item.motor_code || "—"}</Td>
                      <Td>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDocsTarget({ id: item.id, label: item.code })}>
                          <Paperclip size={13} className="mr-1" />{Number(item.document_count) > 0 ? item.document_count : "0"}
                        </Button>
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(item)} disabled={formDisabled} title={mutBlockTitle}><Pencil size={13}/></Button>
                          <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={() => setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}><Trash2 size={13}/></Button>
                        </div>
                      </Td>
                    </Tr>
                    {editId === item.id && (
                      <Tr className="bg-[#0d1e30]">
                        <Td colSpan={8}>
                          <div className="grid grid-cols-3 gap-3 py-1">
                            <Field label="Codigo"><Input disabled={formDisabled} value={editData.code} onChange={(e) => setEditData({ ...editData, code: e.target.value })}/></Field>
                            <Field label="GG"><Input disabled={formDisabled} value={editData.gg} onChange={(e) => setEditData({ ...editData, gg: e.target.value })}/></Field>
                            <Field label="PT"><Input disabled={formDisabled} value={editData.pt} onChange={(e) => setEditData({ ...editData, pt: e.target.value })}/></Field>
                            <Field label="Rodamiento #1"><Input disabled={formDisabled} value={editData.bearing_1} onChange={(e) => setEditData({ ...editData, bearing_1: e.target.value })}/></Field>
                            <Field label="Rodamiento #2"><Input disabled={formDisabled} value={editData.bearing_2} onChange={(e) => setEditData({ ...editData, bearing_2: e.target.value })}/></Field>
                            <Field label="Motor">
                              <Select disabled={formDisabled} value={editData.motor_id} onChange={(e) => setEditData({ ...editData, motor_id: e.target.value })}>
                                <option value="">Sin vincular</option>
                                {motors.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
                              </Select>
                            </Field>
                            <Field label="Ubicacion">
                              <Select disabled={formDisabled} value={editData.operational_location} onChange={(e) => setEditData({ ...editData, operational_location: e.target.value })}>
                                {OPERATIONAL_LOCATIONS.map((loc) => <option key={loc}>{loc}</option>)}
                              </Select>
                            </Field>
                            <Field label="Estado">
                              <Select disabled={formDisabled} value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>
                                {EQUIPMENT_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                              </Select>
                            </Field>
                            <Field label="Runtime retiro"><Input disabled={formDisabled} value={editData.runtime_retiro} onChange={(e) => setEditData({ ...editData, runtime_retiro: e.target.value })}/></Field>
                            <Field label="Comentarios retiro" className="col-span-3"><Textarea disabled={formDisabled} value={editData.comentarios_retiro} onChange={(e) => setEditData({ ...editData, comentarios_retiro: e.target.value })}/></Field>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={handleUpdate} disabled={formDisabled || isEditUnchanged(TURBINE_EDIT_FIELDS)} title={isEditUnchanged(TURBINE_EDIT_FIELDS) ? "No hay cambios para guardar" : mutBlockTitle}><Check size={13} className="mr-1"/>Guardar</Button>
                            <Button size="sm" variant="secondary" onClick={closeEdit}><X size={13} className="mr-1"/>Cancelar</Button>
                          </div>
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                ))}
              </Tbody>
            </Table>
          )}
          <Pager page={filters.page} totalPages={filters.totalPages} onPrev={() => filters.setPage(filters.page - 1)} onNext={() => filters.setPage(filters.page + 1)} total={filters.filtered.length} perPage={filters.perPage}/>
        </CardContent>
      </Card>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara esta turbina de forma permanente." />

      <DocumentsModal
        open={!!docsTarget}
        onClose={() => setDocsTarget(null)}
        entityType="turbine"
        entityId={docsTarget?.id}
        title={`Documentos — Turbina ${docsTarget?.label || ""}`}
        canMutate={canMutate}
        username={user?.username}
        onChange={load}
      />
    </div>
  );
}
