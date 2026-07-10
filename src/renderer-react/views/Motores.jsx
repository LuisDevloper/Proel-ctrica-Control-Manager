import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea, Field } from "../components/ui/Input";
import { OperationalStatusBadge, OperationalLocationBadge } from "../components/ui/Badge";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { ConfirmModal } from "../components/ui/Modal";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { xlsxExport } from "../lib/excelExport";

const EXCEL_COLS = [
  { key: "code",          header: "Codigo",             width: 14 },
  { key: "brand",         header: "Marca",              width: 18 },
  { key: "model",         header: "Modelo",             width: 18 },
  { key: "serial_number", header: "Numero de serie",    width: 20 },
  { key: "power",         header: "Potencia (kW)",      width: 16 },
  { key: "voltage",       header: "Voltaje (V)",        width: 14 },
  { key: "rpm",           header: "RPM",                width: 12 },
  { key: "status",        header: "Estado",             width: 18 },
  { key: "operational_location", header: "Ubicacion operativa", width: 22 },
  { key: "location",      header: "Detalle ubicacion",  width: 24 },
  { key: "installed_at",  header: "Instalacion",        width: 16 },
  { key: "notes",         header: "Observaciones",      width: 34 },
];
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { SkeletonTable } from "../components/ui/Skeleton";
import { MotorDetail } from "./MotorDetail";
import { useDbHealth } from "../context/DbHealthContext";
import { Pencil, Trash2, Plus, X, Check, Eye, Camera, ImageOff, FileText, FileSpreadsheet, Fan, Truck } from "lucide-react";
import { ElectricMotorIcon } from "../components/icons/ElectricMotorIcon";
import { exportMotoresPDF } from "../lib/pdfReport";
import { ImportModal } from "../components/ui/ImportModal";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";
import { PageHeader } from "../components/ui/PageHeader";
import { ReadOnlyBanner } from "../components/ui/ReadOnlyBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { TurbinasPanel } from "./Turbinas";
import { TallerExternoPanel } from "./TallerExterno";
import {
  EQUIPMENT_STATUS_OPTIONS,
  LOCATION_FILTER_OPTIONS,
  OPERATIONAL_LOCATIONS,
  matchesLocationFilter,
} from "../lib/equipment";

function PhotoInput({ value, onChange, disabled }) {
  const { showToast } = useToast();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("La imagen no debe superar 2 MB.", "warning");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }
  return (
    <div className="flex items-center gap-3">
      {value
        ? <img src={value} alt="motor" className="w-16 h-16 rounded-xl object-cover border border-[#2a3d57]" />
        : <div className="w-16 h-16 rounded-xl bg-[#0d1825] border border-[#2a3d57] flex items-center justify-center text-[#4a6a8a]"><Camera size={22}/></div>
      }
      <div className="flex flex-col gap-1">
        {!disabled ? (
          <>
            <label className="cursor-pointer text-xs text-[#2f8dff] hover:text-[#4a9fff] transition-colors">
              {value ? "Cambiar foto" : "Subir foto"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
            {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-[#9ab0c7] hover:text-[#e07070] text-left cursor-pointer">Quitar foto</button>}
          </>
        ) : (
          <span className="text-xs text-[#6a7d94]">Solo lectura</span>
        )}
      </div>
    </div>
  );
}

const filterFn = (item, query, status, location) => {
  const hay = `${item.code} ${item.brand} ${item.model || ""} ${item.location || ""}`.toLowerCase();
  return (!query || hay.includes(query.toLowerCase()))
    && (!status || item.status === status)
    && matchesLocationFilter(item, location);
};

const EMPTY_FORM = {
  code: "", brand: "", model: "", serial_number: "", power: "", voltage: "", rpm: "",
  location: "", operational_location: "En planta", status: "Operativo", installed_at: "", notes: "", photo: null,
};

const MOTOR_EDIT_FIELDS = [
  "code", "brand", "model", "serial_number", "power", "voltage", "rpm", "location",
  "operational_location", "status", "installed_at", "notes", "photo",
];

function motorEditSnapshot(motor) {
  return {
    code: motor.code,
    brand: motor.brand,
    model: motor.model || "",
    serial_number: motor.serial_number || "",
    power: motor.power || "",
    voltage: motor.voltage || "",
    rpm: motor.rpm || "",
    location: motor.location || "",
    operational_location: motor.operational_location || "En planta",
    status: motor.status,
    installed_at: motor.installed_at || "",
    notes: motor.notes || "",
    photo: motor.photo || null,
  };
}

function EquiposTabs({ tab, onTabChange }) {
  const tabs = [
    { id: "motores", label: "Motores", icon: ElectricMotorIcon },
    { id: "turbinas", label: "Turbinas", icon: Fan },
    { id: "taller", label: "Taller externo", icon: Truck },
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

export function Motores({ user, navState, onNavDone }) {
  const [tab, setTab] = useState("motores");
  const [motors, setMotors]       = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [detailId, setDetailId]   = useState(null);

  // Abrir detalle directamente cuando se navega desde la búsqueda global
  useEffect(() => {
    if (navState?.motorId) {
      setDetailId(navState.motorId);
      onNavDone?.();
    }
  }, [navState?.motorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { editId, editData, setEditData, openEdit, closeEdit, isEditUnchanged, guardEditSave } = useInlineEdit();
  const [deleteId, setDeleteId]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [showImport, setShowImport] = useState(false);
  const { showToast }             = useToast();
  const { run }                   = useAsync();
  const { dbWritable }            = useDbHealth();
  const dbTitle                   = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canMutate                 = canMutateRecords(user?.role);
  const mutBlockTitle             = !dbWritable ? dbTitle : (!canMutate ? READ_ONLY_ROLE_TITLE : undefined);
  const formDisabled              = !dbWritable || !canMutate;

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
    const { ok } = await run(() => window.proelectricaApi.createMotor({ ...form, _username: user?.username }), "Motor registrado.");
    if (ok) { setForm(EMPTY_FORM); load(); }
  }

  async function handleUpdate() {
    if (!guardEditSave(MOTOR_EDIT_FIELDS, showToast)) return;
    const { ok } = await run(() => window.proelectricaApi.updateMotor({ id: editId, ...editData, _username: user?.username }), "Motor actualizado.");
    if (ok) { closeEdit(); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteMotor(deleteId), "Motor eliminado.");
    if (ok) { setDeleteId(null); load(); }
  }

  if (detailId) return <MotorDetail motorId={detailId} onBack={() => setDetailId(null)} user={user} />;

  if (tab === "turbinas") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Equipos" description="Registro y seguimiento de turbinas industriales" icon={Fan} />
        <EquiposTabs tab={tab} onTabChange={setTab} />
        <TurbinasPanel user={user} />
      </div>
    );
  }

  if (tab === "taller") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Equipos" description="Logistica y envios a taller externo" icon={Truck} />
        <EquiposTabs tab={tab} onTabChange={setTab} />
        <TallerExternoPanel user={user} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Equipos" description="Registro y seguimiento de motores electricos" icon={ElectricMotorIcon} />
      <EquiposTabs tab={tab} onTabChange={setTab} />

      {!canMutate && (
        <ReadOnlyBanner message="Estas viendo este modulo en modo solo lectura. Puedes consultar datos y exportar, pero no crear ni editar registros." />
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Registrar motor</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Codigo*"><Input disabled={formDisabled} placeholder="Ej: MOT-001" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} /></Field>
            <Field label="Marca*"><Input disabled={formDisabled} placeholder="Ej: Siemens" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} /></Field>
            <Field label="Modelo"><Input disabled={formDisabled} placeholder="Ej: 1LA7" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} /></Field>
            <Field label="Numero de serie"><Input disabled={formDisabled} placeholder="Ej: SN-12345" value={form.serial_number} onChange={(e) => setForm({...form, serial_number: e.target.value})} /></Field>
            <Field label="Potencia (kW)"><Input disabled={formDisabled} placeholder="Ej: 15" type="number" value={form.power} onChange={(e) => setForm({...form, power: e.target.value})} /></Field>
            <Field label="Voltaje (V)"><Input disabled={formDisabled} placeholder="Ej: 440" type="number" value={form.voltage} onChange={(e) => setForm({...form, voltage: e.target.value})} /></Field>
            <Field label="RPM"><Input disabled={formDisabled} placeholder="Ej: 1800" type="number" value={form.rpm} onChange={(e) => setForm({...form, rpm: e.target.value})} /></Field>
            <Field label="Detalle ubicacion"><Input disabled={formDisabled} placeholder="Ej: Planta Norte - Sector A" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} /></Field>
            <Field label="Ubicacion operativa">
              <Select disabled={formDisabled} value={form.operational_location} onChange={(e) => setForm({...form, operational_location: e.target.value})}>
                {OPERATIONAL_LOCATIONS.map(s => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Fecha instalacion"><Input disabled={formDisabled} type="date" value={form.installed_at} onChange={(e) => setForm({...form, installed_at: e.target.value})} /></Field>
            <Field label="Estado">
              <Select disabled={formDisabled} value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                {EQUIPMENT_STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Observaciones" className="col-span-2"><Textarea disabled={formDisabled} placeholder="Notas adicionales..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></Field>
            <Field label="Foto del motor" className="col-span-3">
              <PhotoInput disabled={formDisabled} value={form.photo} onChange={v => setForm({...form, photo: v})} />
            </Field>
          </div>
          <Button className="mt-2" onClick={handleSave} disabled={formDisabled} title={mutBlockTitle}>Guardar motor</Button>
        </CardContent>
      </Card>

      <ImportModal open={showImport} entity="motors" user={user} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); load(); }} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de motores</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="border border-[#2a3d57] text-[#9ab0c7]" onClick={() => setShowImport(true)} disabled={formDisabled} title={mutBlockTitle}>
                <FileSpreadsheet size={13} className="mr-1" /> Importar Excel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { if (!filters.filtered.length) { showToast("No hay datos para exportar.", "warning"); return; } exportMotoresPDF(filters.filtered); }}>
                <FileText size={13} className="mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            searchPlaceholder="Buscar por codigo, marca o ubicacion"
            query={filters.query} onQueryChange={filters.setQuery}
            statusOptions={EQUIPMENT_STATUS_OPTIONS} status={filters.status} onStatusChange={filters.setStatus}
            locationOptions={LOCATION_FILTER_OPTIONS} location={filters.location} onLocationChange={filters.setLocation}
            sortOptions={[{value:"code",label:"Codigo"},{value:"brand",label:"Marca"},{value:"status",label:"Estado"},{value:"operational_location",label:"Ubicacion"}]}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            perPage={filters.perPage} onPerPageChange={filters.setPerPage}
            onExport={() => xlsxExport("Motores", "Registro de Motores", EXCEL_COLS, filters.filtered)} exportCount={filters.filtered.length}
            onClear={filters.reset}
          />
          {loadingData
            ? <SkeletonTable rows={5} cols={5} />
            : filters.paged.length === 0
            ? <EmptyState message="No hay motores para mostrar. Ajusta los filtros o registra uno nuevo." />
            : <Table>
                <Thead>
                  <tr>
                    <Th>Foto</Th><Th>Codigo</Th><Th>Marca / Modelo</Th><Th>Ubicacion</Th><Th>Estado</Th><Th>Acciones</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filters.paged.map(motor => (
                    <React.Fragment key={motor.id}>
                      <Tr>
                        <Td>
                          {motor.photo
                            ? <img src={motor.photo} alt={motor.code} className="w-10 h-10 rounded-lg object-cover border border-[#2a3d57]" />
                            : <div className="w-10 h-10 rounded-lg bg-[#0d1825] border border-[#2a3d57] flex items-center justify-center text-[#2a3d57]"><ImageOff size={13}/></div>
                          }
                        </Td>
                        <Td className="font-medium">{motor.code}</Td>
                        <Td>{motor.brand} {motor.model || ""}</Td>
                        <Td>
                          <div className="flex flex-col gap-1">
                            <OperationalLocationBadge location={motor.operational_location} />
                            {motor.location && <span className="text-[10px] text-[#7a9bb8] truncate max-w-[140px]">{motor.location}</span>}
                          </div>
                        </Td>
                        <Td><OperationalStatusBadge status={motor.status} /></Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => setDetailId(motor.id)}>
                              <Eye size={13}/>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(motor.id, motorEditSnapshot(motor))} disabled={formDisabled} title={mutBlockTitle}>
                              <Pencil size={13}/>
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:text-[#e07070]" onClick={() => setDeleteId(motor.id)} disabled={formDisabled} title={mutBlockTitle}>
                              <Trash2 size={13}/>
                            </Button>
                          </div>
                        </Td>
                      </Tr>
                      {editId === motor.id && (
                        <Tr className="bg-[#0d1e30]">
                          <Td colSpan={6}>
                            <div className="grid grid-cols-2 gap-3 py-1">
                              <Field label="Codigo"><Input disabled={formDisabled} value={editData.code} onChange={(e)=>setEditData({...editData,code:e.target.value})}/></Field>
                              <Field label="Marca"><Input disabled={formDisabled} value={editData.brand} onChange={(e)=>setEditData({...editData,brand:e.target.value})}/></Field>
                              <Field label="Modelo"><Input disabled={formDisabled} value={editData.model} onChange={(e)=>setEditData({...editData,model:e.target.value})}/></Field>
                              <Field label="Numero de serie"><Input disabled={formDisabled} placeholder="Ej: SN-12345" value={editData.serial_number} onChange={(e)=>setEditData({...editData,serial_number:e.target.value})}/></Field>
                              <Field label="Potencia (kW)"><Input disabled={formDisabled} type="number" value={editData.power} onChange={(e)=>setEditData({...editData,power:e.target.value})}/></Field>
                              <Field label="Voltaje (V)"><Input disabled={formDisabled} type="number" value={editData.voltage} onChange={(e)=>setEditData({...editData,voltage:e.target.value})}/></Field>
                              <Field label="RPM"><Input disabled={formDisabled} type="number" value={editData.rpm} onChange={(e)=>setEditData({...editData,rpm:e.target.value})}/></Field>
                              <Field label="Detalle ubicacion"><Input disabled={formDisabled} value={editData.location} onChange={(e)=>setEditData({...editData,location:e.target.value})}/></Field>
                              <Field label="Ubicacion operativa">
                                <Select disabled={formDisabled} value={editData.operational_location||"En planta"} onChange={(e)=>setEditData({...editData,operational_location:e.target.value})}>
                                  {OPERATIONAL_LOCATIONS.map(s=><option key={s}>{s}</option>)}
                                </Select>
                              </Field>
                              <Field label="Instalacion"><Input disabled={formDisabled} type="date" value={editData.installed_at} onChange={(e)=>setEditData({...editData,installed_at:e.target.value})}/></Field>
                              <Field label="Estado"><Select disabled={formDisabled} value={editData.status} onChange={(e)=>setEditData({...editData,status:e.target.value})}>{EQUIPMENT_STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</Select></Field>
                              <Field label="Notas"><Textarea disabled={formDisabled} value={editData.notes} onChange={(e)=>setEditData({...editData,notes:e.target.value})}/></Field>
                              <Field label="Foto" className="col-span-2">
                                <PhotoInput disabled={formDisabled} value={editData.photo} onChange={v=>setEditData({...editData,photo:v})}/>
                              </Field>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={handleUpdate} disabled={formDisabled || isEditUnchanged(MOTOR_EDIT_FIELDS)} title={isEditUnchanged(MOTOR_EDIT_FIELDS) ? "No hay cambios para guardar" : mutBlockTitle}><Check size={13} className="mr-1"/>Guardar</Button>
                              <Button size="sm" variant="secondary" onClick={closeEdit}><X size={13} className="mr-1"/>Cancelar</Button>
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

      <ConfirmModal open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este motor de forma permanente."/>
    </div>
  );
}
