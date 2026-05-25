/** Tipos de movimiento de almacen. */

export const MOVEMENT_TYPE_OPTIONS = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
];

export const MOVEMENT_FILTER_OPTIONS = [
  { value: "", label: "Todos los movimientos" },
  { value: "entrada", label: "Entradas" },
  { value: "salida", label: "Salidas" },
];

export const REFERENCE_TYPE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "external_shipment", label: "Taller externo" },
];

export function movementTypeLabel(type) {
  if (type === "entrada") return "Entrada";
  if (type === "salida") return "Salida";
  if (type === "ajuste") return "Ajuste";
  return type || "—";
}
