const MOTOR_ALLOWED_STATUSES = ["Operativo", "En mantenimiento", "En almacen", "Fuera de servicio"];

const OPERATIONAL_LOCATIONS = ["En planta", "Afuera", "Taller externo", "Almacen", "En mantenimiento"];

const LOGISTICS_STATUS_OPTIONS = [
  "Permiso de salida aprobado",
  "Equipo en transito",
  "Entrada registrada",
  "Equipo entregado",
];

const SHIPMENT_EQUIPMENT_TYPES = ["motor", "turbine"];

module.exports = {
  MOTOR_ALLOWED_STATUSES,
  OPERATIONAL_LOCATIONS,
  LOGISTICS_STATUS_OPTIONS,
  SHIPMENT_EQUIPMENT_TYPES,
};
