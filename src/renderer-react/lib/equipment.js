/** Catalogos compartidos de equipos (motores / turbinas). */

export const EQUIPMENT_STATUS_OPTIONS = [
  "Operativo",
  "En mantenimiento",
  "En almacen",
  "Fuera de servicio",
];

export const OPERATIONAL_LOCATIONS = [
  "En planta",
  "Afuera",
  "Taller externo",
  "Almacen",
  "En mantenimiento",
];

export const LOCATION_FILTER_OPTIONS = [
  { value: "", label: "Todas las ubicaciones" },
  { value: "En planta", label: "En planta" },
  { value: "Afuera", label: "Afuera" },
  { value: "Taller externo", label: "En taller externo" },
  { value: "Almacen", label: "En almacen" },
  { value: "En mantenimiento", label: "En mantenimiento (ubic.)" },
  { value: "fuera_planta", label: "Fuera de planta" },
  { value: "activos_planta", label: "Activos en planta" },
  { value: "pendiente_entrada", label: "Pendientes de entrada" },
];

export const LOGISTICS_STATUS_OPTIONS = [
  "Permiso de salida aprobado",
  "Equipo en transito",
  "Entrada registrada",
  "Equipo entregado",
];

export const LOGISTICS_STATUS_SHORT_LABELS = {
  "Permiso de salida aprobado": "Salida autorizada",
  "Equipo en transito": "En transito",
  "Entrada registrada": "Entrada registrada",
  "Equipo entregado": "Entregado",
};

export function logisticsStatusShortLabel(status) {
  return LOGISTICS_STATUS_SHORT_LABELS[status] || status || "Salida autorizada";
}

export const SHIPMENT_FILTER_OPTIONS = [
  { value: "", label: "Todos los envios" },
  { value: "Permiso de salida aprobado", label: "Salida autorizada" },
  { value: "Equipo en transito", label: "En transito" },
  { value: "Entrada registrada", label: "Entrada registrada" },
  { value: "Equipo entregado", label: "Equipo entregado" },
  { value: "pendiente_entrada", label: "Pendientes de entrada" },
  { value: "fuera_planta", label: "Fuera de planta" },
  { value: "en_taller", label: "En taller externo" },
];

export const EQUIPMENT_TYPE_OPTIONS = [
  { value: "motor", label: "Motor" },
  { value: "turbine", label: "Turbina" },
];

/** Estado fisico del equipo al enviar/recibir en taller externo. */
export const SHIPMENT_EQUIPMENT_CONDITION_PRESETS = ["Operativo", "Dañado", "Otros"];

export function parseEquipmentCondition(stored) {
  const raw = String(stored || "").trim();
  if (!raw) return { preset: "", custom: "" };
  const lower = raw.toLowerCase();
  if (lower === "operativo") return { preset: "Operativo", custom: "" };
  if (lower === "dañado" || lower === "danado") return { preset: "Dañado", custom: "" };
  if (lower.startsWith("otros:")) return { preset: "Otros", custom: raw.slice(6).trim() };
  if (lower === "otros") return { preset: "Otros", custom: "" };
  return { preset: "Otros", custom: raw };
}

export function serializeEquipmentCondition(preset, custom = "") {
  if (preset === "Operativo" || preset === "Dañado") return preset;
  if (preset === "Otros") {
    const text = String(custom || "").trim();
    return text ? `Otros: ${text}` : "Otros";
  }
  return "";
}

export function formatEquipmentCondition(stored) {
  const { preset, custom } = parseEquipmentCondition(stored);
  if (!preset) return "—";
  if (preset === "Otros" && custom) return custom;
  return preset;
}

export function isShipmentOpen(status) {
  return status && !["Entrada registrada", "Equipo entregado"].includes(status);
}

export function matchesLocationFilter(item, locationFilter) {
  if (!locationFilter) return true;
  const loc = item.operational_location || "En planta";
  if (locationFilter === "fuera_planta") {
    return loc === "Afuera" || loc === "Taller externo" || isShipmentOpen(item.active_logistics_status);
  }
  if (locationFilter === "activos_planta") {
    return loc === "En planta" && item.status === "Operativo" && !isShipmentOpen(item.active_logistics_status);
  }
  if (locationFilter === "pendiente_entrada") {
    return isShipmentOpen(item.active_logistics_status);
  }
  if (locationFilter === "en_taller_externo" || locationFilter === "Taller externo") {
    return loc === "Taller externo" || isShipmentOpen(item.active_logistics_status);
  }
  return loc === locationFilter;
}

export function matchesShipmentFilter(item, filter) {
  if (!filter) return true;
  const status = item.logisticsStatus || item.logistics_status;
  if (filter === "pendiente_entrada") return isShipmentOpen(status);
  if (filter === "fuera_planta") {
    return isShipmentOpen(status) && status !== "Equipo entregado";
  }
  if (filter === "en_taller") {
    return isShipmentOpen(status) || status === "Equipo en transito";
  }
  return status === filter;
}
