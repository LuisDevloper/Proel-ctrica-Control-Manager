import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Plus, Pencil, Trash2, X, Check, Truck, ArrowRight, FileText, Paperclip } from "lucide-react";
import { exportShipmentPermitPDF } from "../lib/pdfReport";
import { DocumentsModal } from "../components/documents/EntityDocuments";
import { useDbHealth } from "../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";
import { ReadOnlyBanner } from "../components/ui/ReadOnlyBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { ShipmentStatusCell } from "../components/ui/Badge";
import {
  LOGISTICS_STATUS_OPTIONS,
  SHIPMENT_FILTER_OPTIONS,
  EQUIPMENT_TYPE_OPTIONS,
  SHIPMENT_EQUIPMENT_CONDITION_PRESETS,
  parseEquipmentCondition,
  serializeEquipmentCondition,
  formatEquipmentCondition,
  matchesShipmentFilter,
} from "../lib/equipment";

const EXCEL_COLS = [
  { key: "equipmentCode", header: "Equipo", width: 14 },
  { key: "equipmentType", header: "Tipo", width: 12 },
  { key: "workshopName", header: "Taller", width: 22 },
  { key: "responsible", header: "Responsable", width: 18 },
  { key: "departureDate", header: "Salida", width: 14 },
  { key: "expectedReturnDate", header: "Retorno est.", width: 14 },
  { key: "actualReturnDate", header: "Retorno real", width: 14 },
  { key: "logisticsStatus", header: "Estado logistica", width: 22 },
  { key: "equipmentCondition", header: "Estado equipo", width: 16 },
  { key: "motive", header: "Motivo", width: 28 },
];

const EMPTY_FORM = {
  equipment_type: "motor",
  equipment_id: "",
  workshop_name: "",
  responsible: "",
  departure_date: "",
  expected_return_date: "",
  motive: "",
  equipment_condition: "",
  logistics_status: "Permiso de salida aprobado",
  notes: "",
};

const SHIPMENT_EDIT_FIELDS = [
  "equipment_type", "equipment_id", "workshop_name", "responsible", "departure_date",
  "expected_return_date", "actual_return_date", "motive", "equipment_condition", "logistics_status", "notes",
];

function shipmentEditSnapshot(item) {
  return {
    equipment_type: item.equipmentType,
    equipment_id: String(item.equipmentId),
    workshop_name: item.workshopName || "",
    responsible: item.responsible || "",
    departure_date: item.departureDate || "",
    expected_return_date: item.expectedReturnDate || "",
    actual_return_date: item.actualReturnDate || "",
    motive: item.motive || "",
    equipment_condition: item.equipmentCondition || "",
    logistics_status: item.logisticsStatus || "Permiso de salida aprobado",
    notes: item.notes || "",
  };
}

const filterFn = (item, query, _status, shipmentFilter) => {
  const hay = `${item.equipmentCode || ""} ${item.workshopName || ""} ${item.responsible || ""} ${item.motive || ""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase())) && matchesShipmentFilter(item, shipmentFilter);
};

function nextLogisticsStatus(current) {
  const idx = LOGISTICS_STATUS_OPTIONS.indexOf(current);
  if (idx < 0 || idx >= LOGISTICS_STATUS_OPTIONS.length - 1) return current;
  return LOGISTICS_STATUS_OPTIONS[idx + 1];
}

function EquipmentConditionField({ label = "Estado del equipo", value, onChange, disabled, className }) {
  const { preset, custom } = parseEquipmentCondition(value);

  return (
    <Field label={label} className={className}>
      <Select
        disabled={disabled}
        value={preset}
        onChange={(e) => onChange(serializeEquipmentCondition(e.target.value, custom))}
      >
        <option value="">Seleccionar</option>
        {SHIPMENT_EQUIPMENT_CONDITION_PRESETS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </Select>
      {preset === "Otros" && (
        <Input
          disabled={disabled}
          className="mt-2"
          placeholder="Especifique el estado"
          value={custom}
          onChange={(e) => onChange(serializeEquipmentCondition("Otros", e.target.value))}
        />
      )}
    </Field>
  );
}

const PERMIT_DOC_TYPE_OPTIONS = [{ value: "permiso_firmado", label: "Permiso firmado" }];

export function TallerExternoPanel({ user }) {
  const [items, setItems] = useState([]);
  const [motors, setMotors] = useState([]);
  const [turbinas, setTurbinas] = useState([]);
  const { editId, editData, setEditData, openEdit, closeEdit, isEditUnchanged, guardEditSave } = useInlineEdit();
  const [deleteId, setDeleteId] = useState(null);
  const [docsId, setDocsId] = useState(null);
  const [advanceConfirm, setAdvanceConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [permitFile, setPermitFile] = useState(null);
  const { showToast } = useToast();
  const { run } = useAsync();
  const { dbWritable } = useDbHealth();
  const dbTitle = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate = canMutateRecords(user?.role);
  const mutBlockTitle = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled = !dbWritable || !canMutate;
  const filters = useFilters(items, { filterFn, defaultSortField: "departureDate", perPage: 10 });

  const equipmentOptions = useMemo(() => {
    if (form.equipment_type === "turbine") {
      return turbinas.map((t) => ({ id: t.id, label: t.code }));
    }
    return motors.map((m) => ({ id: m.id, label: `${m.code} — ${m.brand}` }));
  }, [form.equipment_type, motors, turbinas]);

  const editEquipmentOptions = useMemo(() => {
    if (editData.equipment_type === "turbine") {
      return turbinas.map((t) => ({ id: t.id, label: t.code }));
    }
    return motors.map((m) => ({ id: m.id, label: `${m.code} — ${m.brand}` }));
  }, [editData.equipment_type, turbinas, motors]);

  const load = useCallback(async () => {
    const [shipments, motorList, turbinaList] = await Promise.all([
      window.proelectricaApi.getExternalShipments(),
      window.proelectricaApi.getMotors(),
      window.proelectricaApi.getTurbinas(),
    ]);
    setItems(shipments || []);
    setMotors(motorList || []);
    setTurbinas(turbinaList || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toPayload(data, id) {
    return {
      id,
      equipmentType: data.equipment_type,
      equipmentId: data.equipment_id,
      workshopName: data.workshop_name,
      responsible: data.responsible,
      departureDate: data.departure_date,
      expectedReturnDate: data.expected_return_date,
      actualReturnDate: data.actual_return_date,
      motive: data.motive,
      equipmentCondition: data.equipment_condition,
      logisticsStatus: data.logistics_status,
      notes: data.notes,
      _username: user?.username,
    };
  }

  function handlePermitFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast("El PDF no debe superar 15 MB.", "warning");
      e.target.value = "";
      return;
    }
    const mime = file.type || "application/pdf";
    const isPdf = mime === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      showToast("El permiso firmado debe ser un archivo PDF.", "warning");
      e.target.value = "";
      return;
    }
    setPermitFile(file);
  }

  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSave() {
    if (!form.equipment_id || !form.workshop_name || !form.departure_date) {
      showToast("Equipo, taller y fecha de salida son obligatorios.", "warning");
      return;
    }
    const { ok, result } = await run(
      () => window.proelectricaApi.createExternalShipment(toPayload(form)),
      "Envio a taller registrado."
    );
    if (!ok) return;

    if (permitFile && result?.id) {
      try {
        const dataBase64 = await readFileBase64(permitFile);
        const up = await window.proelectricaApi.uploadDocument({
          entityType: "external_shipment",
          entityId: result.id,
          docType: "permiso_firmado",
          fileName: permitFile.name,
          mimeType: "application/pdf",
          dataBase64,
          username: user?.username,
        });
        if (up?.ok) showToast("Permiso firmado adjuntado al envio.", "success");
        else if (up?.message) showToast(up.message, "warning");
      } catch {
        showToast("Envio registrado, pero no se pudo adjuntar el PDF.", "warning");
      }
    }

    setForm(EMPTY_FORM);
    setPermitFile(null);
    load();
  }

  async function handleUpdate() {
    if (!guardEditSave(SHIPMENT_EDIT_FIELDS, showToast)) return;
    const { ok } = await run(
      () => window.proelectricaApi.updateExternalShipment(toPayload(editData, editId)),
      "Envio actualizado."
    );
    if (ok) { closeEdit(); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(
      () => window.proelectricaApi.deleteExternalShipment(deleteId),
      "Envio eliminado."
    );
    if (ok) { setDeleteId(null); load(); }
  }

  async function handleAdvance(item, nextStatus) {
    const next = nextStatus || nextLogisticsStatus(item.logisticsStatus);
    if (next === item.logisticsStatus) return;
    const { ok } = await run(
      () => window.proelectricaApi.updateExternalShipment({
        id: item.id,
        equipmentType: item.equipmentType,
        equipmentId: item.equipmentId,
        workshopName: item.workshopName,
        responsible: item.responsible,
        departureDate: item.departureDate,
        expectedReturnDate: item.expectedReturnDate,
        actualReturnDate: item.actualReturnDate,
        motive: item.motive,
        equipmentCondition: item.equipmentCondition,
        logisticsStatus: next,
        notes: item.notes,
        _username: user?.username,
      }),
      `Estado: ${next}`
    );
    if (ok) load();
  }

  function requestAdvance(item) {
    const next = nextLogisticsStatus(item.logisticsStatus);
    if (next === item.logisticsStatus) return;
    if (!item.signedPermitDocId) {
      setAdvanceConfirm({ item, next });
      return;
    }
    handleAdvance(item, next);
  }

  async function confirmAdvanceWithoutSignatures() {
    if (!advanceConfirm) return;
    const { item, next } = advanceConfirm;
    setAdvanceConfirm(null);
    await handleAdvance(item, next);
  }

  function startEdit(item) {
    openEdit(item.id, shipmentEditSnapshot(item));
  }

  async function handleExportPdf(item) {
    try {
      if (item.signedPermitDocId) {
        const dl = await window.proelectricaApi.downloadDocument({ id: item.signedPermitDocId });
        if (dl?.ok) showToast("Permiso firmado descargado.", "success");
        else if (dl?.message !== "Cancelado") showToast(dl?.message || "No se pudo descargar el permiso firmado.", "warning");
        return;
      }
      exportShipmentPermitPDF(item);
      showToast("PDF del permiso generado (plantilla sin firmas).", "success");
    } catch {
      showToast("No se pudo generar el PDF.", "warning");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!canMutate && (
        <ReadOnlyBanner message="Estas viendo envios a taller en modo solo lectura." />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar envio a taller externo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <Field label="Tipo de equipo">
              <Select disabled={formDisabled} value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value, equipment_id: "" })}>
                {EQUIPMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Equipo*">
              <Select disabled={formDisabled} value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })}>
                <option value="">Seleccionar</option>
                {equipmentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Taller externo*"><Input disabled={formDisabled} placeholder="Nombre del taller" value={form.workshop_name} onChange={(e) => setForm({ ...form, workshop_name: e.target.value })} /></Field>
            <Field label="Responsable"><Input disabled={formDisabled} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></Field>
            <Field label="Fecha de salida*"><Input disabled={formDisabled} type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} /></Field>
            <Field label="Retorno estimado"><Input disabled={formDisabled} type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} /></Field>
            <EquipmentConditionField disabled={formDisabled} value={form.equipment_condition} onChange={(v) => setForm({ ...form, equipment_condition: v })} />
            <Field label="Estado logistica">
              <Select disabled={formDisabled} value={form.logistics_status} onChange={(e) => setForm({ ...form, logistics_status: e.target.value })}>
                {LOGISTICS_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Motivo del envio" className="md:col-span-2 xl:col-span-3"><Textarea disabled={formDisabled} value={form.motive} onChange={(e) => setForm({ ...form, motive: e.target.value })} /></Field>
            <Field label="Permiso firmado (PDF, opcional)" className="md:col-span-2 xl:col-span-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  {!formDisabled ? (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[#2f8dff] hover:text-[#5fb3ff] transition-colors">
                      <Paperclip size={14} />
                      {permitFile ? "Cambiar PDF" : "Adjuntar permiso firmado"}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={handlePermitFile}
                      />
                    </label>
                  ) : (
                    <span className="text-xs text-[#6a7d94]">Solo lectura</span>
                  )}
                  {permitFile && (
                    <>
                      <span className="text-xs text-[#9ab0c7] truncate max-w-[280px]" title={permitFile.name}>{permitFile.name}</span>
                      {!formDisabled && (
                        <button
                          type="button"
                          onClick={() => setPermitFile(null)}
                          className="text-xs text-[#9ab0c7] hover:text-[#e07070] cursor-pointer border-none bg-transparent p-0"
                        >
                          Quitar
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-[#7a9bb8]">PDF firmado — max. 15 MB. Se vincula al registrar el envio.</p>
              </div>
            </Field>
            <Field label="Observaciones" className="md:col-span-2 xl:col-span-3"><Textarea disabled={formDisabled} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Registrar envio</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Truck size={15}/> Control logístico — taller externo</CardTitle></CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por equipo, taller o responsable"
            query={filters.query} onQueryChange={filters.setQuery}
            locationOptions={SHIPMENT_FILTER_OPTIONS} location={filters.location} onLocationChange={filters.setLocation}
            sortOptions={[
              { value: "departureDate", label: "Fecha salida" },
              { value: "expectedReturnDate", label: "Retorno est." },
              { value: "logisticsStatus", label: "Estado" },
              { value: "workshopName", label: "Taller" },
            ]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            perPage={filters.perPage} onPerPageChange={filters.setPerPage}
            onExport={() => xlsxExport(
              "TallerExterno",
              "Envios a Taller Externo",
              EXCEL_COLS,
              filters.filtered.map((row) => ({
                ...row,
                equipmentCondition: formatEquipmentCondition(row.equipmentCondition),
              }))
            )}
            exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {filters.paged.length === 0 ? (
            <EmptyState message="No hay envios a taller para mostrar." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th className="w-[13%]">Equipo</Th>
                  <Th className="w-[17%]">Taller</Th>
                  <Th className="w-[12%]">Responsable</Th>
                  <Th className="w-[10%]">Salida</Th>
                  <Th className="w-[14%]">Retorno</Th>
                  <Th className="w-[18%]">Estado</Th>
                  <Th className="w-[16%]">Acciones</Th>
                </tr>
              </Thead>
              <Tbody>
                {filters.paged.map((item) => (
                  <React.Fragment key={item.id}>
                    <Tr>
                      <Td>
                        <div className="font-medium">{item.equipmentCode || "—"}</div>
                        <div className="text-[10px] text-[#7a9bb8]">{item.equipmentType === "motor" ? "Motor" : "Turbina"}</div>
                      </Td>
                      <Td className="text-[#9ab0c7]">{item.workshopName}</Td>
                      <Td className="text-[#9ab0c7]">{item.responsible || "—"}</Td>
                      <Td className="text-[#9ab0c7]">{item.departureDate || "—"}</Td>
                      <Td className="text-xs text-[#9ab0c7]">
                        {item.expectedReturnDate ? `Est: ${item.expectedReturnDate}` : "—"}
                        {item.actualReturnDate && <div className="text-[#29a16a]">Real: {item.actualReturnDate}</div>}
                      </Td>
                      <Td className="align-top">
                        <ShipmentStatusCell
                          logisticsStatus={item.logisticsStatus}
                          signedPermitDocId={item.signedPermitDocId}
                        />
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={item.signedPermitDocId ? "Descargar permiso firmado" : "Generar PDF del permiso (plantilla)"}
                            onClick={() => handleExportPdf(item)}
                          >
                            <FileText size={14} className={item.signedPermitDocId ? "text-[#29a16a]" : "text-[#5fb3ff]"} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={item.signedPermitDocId ? "Permiso firmado adjunto — ver o reemplazar" : "Adjuntar permiso firmado (PDF)"}
                            onClick={() => setDocsId(item.id)}
                          >
                            <Paperclip size={14} className={item.signedPermitDocId ? "text-[#29a16a]" : "text-[#9ab0c7]"} />
                          </Button>
                          {item.logisticsStatus !== "Equipo entregado" && (
                            <Button variant="ghost" size="icon" title="Avanzar estado" onClick={() => requestAdvance(item)} disabled={formDisabled}>
                              <ArrowRight size={14} className="text-[#29a16a]" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => startEdit(item)} disabled={formDisabled} title={mutBlockTitle}><Pencil size={13}/></Button>
                          <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={() => setDeleteId(item.id)} disabled={formDisabled} title={mutBlockTitle}><Trash2 size={13}/></Button>
                        </div>
                      </Td>
                    </Tr>
                    {editId === item.id && (
                      <Tr className="bg-[#0d1e30]">
                        <Td colSpan={7} className="!p-4 align-top">
                          <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 py-1">
                            <Field label="Tipo" className="min-w-0 mb-0">
                              <Select disabled={formDisabled} value={editData.equipment_type} onChange={(e) => setEditData({ ...editData, equipment_type: e.target.value, equipment_id: "" })}>
                                {EQUIPMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </Select>
                            </Field>
                            <Field label="Equipo" className="min-w-0 mb-0">
                              <Select disabled={formDisabled} value={editData.equipment_id} onChange={(e) => setEditData({ ...editData, equipment_id: e.target.value })}>
                                {editEquipmentOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                              </Select>
                            </Field>
                            <Field label="Taller" className="min-w-0 mb-0"><Input disabled={formDisabled} value={editData.workshop_name} onChange={(e) => setEditData({ ...editData, workshop_name: e.target.value })}/></Field>
                            <Field label="Responsable" className="min-w-0 mb-0"><Input disabled={formDisabled} value={editData.responsible} onChange={(e) => setEditData({ ...editData, responsible: e.target.value })}/></Field>
                            <Field label="Salida" className="min-w-0 mb-0"><Input disabled={formDisabled} type="date" value={editData.departure_date} onChange={(e) => setEditData({ ...editData, departure_date: e.target.value })}/></Field>
                            <Field label="Retorno est." className="min-w-0 mb-0"><Input disabled={formDisabled} type="date" value={editData.expected_return_date} onChange={(e) => setEditData({ ...editData, expected_return_date: e.target.value })}/></Field>
                            <Field label="Retorno real" className="min-w-0 mb-0"><Input disabled={formDisabled} type="date" value={editData.actual_return_date || ""} onChange={(e) => setEditData({ ...editData, actual_return_date: e.target.value })}/></Field>
                            <EquipmentConditionField label="Estado equipo" disabled={formDisabled} className="min-w-0 mb-0" value={editData.equipment_condition} onChange={(v) => setEditData({ ...editData, equipment_condition: v })} />
                            <Field label="Estado logistica" className="min-w-0 mb-0">
                              <Select disabled={formDisabled} value={editData.logistics_status} onChange={(e) => setEditData({ ...editData, logistics_status: e.target.value })}>
                                {LOGISTICS_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                              </Select>
                            </Field>
                            <Field label="Motivo" className="min-w-0 mb-0 md:col-span-2 xl:col-span-3"><Textarea disabled={formDisabled} value={editData.motive} onChange={(e) => setEditData({ ...editData, motive: e.target.value })}/></Field>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button size="sm" onClick={handleUpdate} disabled={formDisabled || isEditUnchanged(SHIPMENT_EDIT_FIELDS)} title={isEditUnchanged(SHIPMENT_EDIT_FIELDS) ? "No hay cambios para guardar" : mutBlockTitle}><Check size={13} className="mr-1"/>Guardar</Button>
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

      <ConfirmModal
        open={!!advanceConfirm}
        onClose={() => setAdvanceConfirm(null)}
        onConfirm={confirmAdvanceWithoutSignatures}
        title="Firmas no adjuntas"
        message={
          advanceConfirm
            ? `El envio ${advanceConfirm.item.equipmentCode || ""} no tiene el PDF del permiso firmado. ¿Desea avanzar a "${advanceConfirm.next}" de todas formas?`
            : ""
        }
        confirmText="Continuar sin firmas"
        confirmVariant="primary"
      />

      <DocumentsModal
        open={!!docsId}
        onClose={() => setDocsId(null)}
        onChange={load}
        entityType="external_shipment"
        entityId={docsId}
        title="Permiso firmado"
        canMutate={canMutate && dbWritable}
        username={user?.username}
        docTypeOptions={PERMIT_DOC_TYPE_OPTIONS}
        defaultDocType="permiso_firmado"
        acceptHint="PDF firmado — max. 15 MB. Al subir uno nuevo, reemplaza el anterior."
      />

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este registro de envio a taller." />
    </div>
  );
}
