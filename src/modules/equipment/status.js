const { MOTOR_ALLOWED_STATUSES } = require("./constants");
const { canonicalMotorStatus, canonicalOperationalLocation } = require("./canonical");

/**
 * Estado operativo mostrado en dashboard y reportes.
 * Combina el campo status, ubicacion operativa y mantenimientos abiertos.
 */
function resolveEffectiveEquipmentStatus({ status, operationalLocation, hasOpenMaintenance = false }) {
  const { status: canonical } = canonicalMotorStatus(status);
  if (canonical === "Fuera de servicio" || canonical === "En almacen") return canonical;
  if (canonical === "En mantenimiento") return canonical;
  if (hasOpenMaintenance) return "En mantenimiento";
  if (canonicalOperationalLocation(operationalLocation) === "En mantenimiento") return "En mantenimiento";
  return canonical;
}

function countEquipmentByEffectiveStatus(rows) {
  const map = Object.fromEntries(MOTOR_ALLOWED_STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    const effective = resolveEffectiveEquipmentStatus(row);
    map[effective] = (map[effective] || 0) + 1;
  }
  return MOTOR_ALLOWED_STATUSES.map((status) => ({ status, count: map[status] }));
}

function countInMaintenance(rows) {
  return rows.filter((row) => resolveEffectiveEquipmentStatus(row) === "En mantenimiento").length;
}

function syncMotorStatusWithMaintenances(db, motorId) {
  const id = Number(motorId);
  if (!Number.isFinite(id) || id <= 0) return;

  const motor = db.prepare("SELECT id, status FROM motors WHERE id = ?").get(id);
  if (!motor) return;

  const openCount = db.prepare(`
    SELECT COUNT(*) AS c FROM maintenances
    WHERE motor_id = ? AND status != 'Completado'
  `).get(id).c;

  const current = canonicalMotorStatus(motor.status).status;
  if (openCount > 0) {
    if (current === "Operativo") {
      db.prepare("UPDATE motors SET status = 'En mantenimiento' WHERE id = ?").run(id);
    }
    return;
  }

  if (current === "En mantenimiento") {
    db.prepare("UPDATE motors SET status = 'Operativo' WHERE id = ?").run(id);
  }
}

module.exports = {
  resolveEffectiveEquipmentStatus,
  countEquipmentByEffectiveStatus,
  countInMaintenance,
  syncMotorStatusWithMaintenances,
};
