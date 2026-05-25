function registerMaintenancesHandlers({ ipcMain, getDatabase, guards, equipment, logActivity, deleteDocumentsForEntity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { calendarMonthIsoRange } = equipment;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");

  const MAINTENANCE_UPDATE_FIELDS = [
    ["motor_id", "Motor"],
    ["technician_id", "Tecnico"],
    ["maintenance_type", "Tipo"],
    ["maintenance_date", "Fecha"],
    ["description", "Descripcion"],
    ["cost", "Costo"],
    ["status", "Estado"],
  ];

  ipcMain.handle(
    "maintenances:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT
        m.id,
        m.maintenance_type,
        m.maintenance_date,
        m.description,
        m.cost,
        m.status,
        mo.code AS motor_code,
        t.full_name AS technician_name,
        (SELECT COUNT(*) FROM documents d WHERE d.entity_type = 'maintenance' AND d.entity_id = m.id) AS document_count
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      LEFT JOIN technicians t ON t.id = m.technician_id
      ORDER BY m.id DESC
    `).all();
    })
  );

  ipcMain.handle(
    "maintenances:calendar",
    secureHandler(denyIfNotAuthenticated, (_event, { year, month }) => {
      const db = getDatabase();
      const { from, to } = calendarMonthIsoRange(year, month);
      return db.prepare(`
      SELECT m.*, mo.code as motor_code, t.full_name as technician_name
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      LEFT JOIN technicians t ON t.id = m.technician_id
      WHERE m.maintenance_date BETWEEN ? AND ?
      ORDER BY m.maintenance_date
    `).all(from, to);
    })
  );

  ipcMain.handle("maintenances:create", async (_event, maintenance) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO maintenances (
        motor_id, technician_id, maintenance_type, maintenance_date, description, parts_used, cost, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(maintenance.motorId),
      maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance.maintenanceType,
      maintenance.maintenanceDate,
      maintenance.description || "",
      maintenance.partsUsed || "",
      Number(maintenance.cost || 0),
      maintenance.status || "Pendiente",
      maintenance.notes || "",
      new Date().toISOString()
    );
    const newMtn = db.prepare("SELECT id FROM maintenances ORDER BY id DESC LIMIT 1").get();
    logActivity(db, maintenance._username, "CREATE", "maintenances", newMtn?.id, `${maintenance.maintenanceType} — Motor #${maintenance.motorId}`);
    return { ok: true, id: newMtn?.id };
  });

  ipcMain.handle("maintenances:update", async (_event, maintenance) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM maintenances WHERE id = ?").get(Number(maintenance.id));
    if (!before) return { ok: false, message: "Mantenimiento no encontrado." };

    const after = {
      motor_id: Number(maintenance.motorId),
      technician_id: maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance_type: maintenance.maintenanceType,
      maintenance_date: maintenance.maintenanceDate,
      description: maintenance.description || "",
      cost: Number(maintenance.cost || 0),
      status: maintenance.status || "Pendiente",
    };

    db.prepare(`
      UPDATE maintenances
      SET motor_id = ?, technician_id = ?, maintenance_type = ?, maintenance_date = ?, description = ?, cost = ?, status = ?
      WHERE id = ?
    `).run(
      after.motor_id,
      after.technician_id,
      after.maintenance_type,
      after.maintenance_date,
      after.description,
      after.cost,
      after.status,
      Number(maintenance.id)
    );

    logActivity(
      db,
      maintenance._username,
      "UPDATE",
      "maintenances",
      maintenance.id,
      buildUpdateDetails({
        summary: `Mantenimiento #${maintenance.id}`,
        fields: MAINTENANCE_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("maintenances:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    deleteDocumentsForEntity(db, "maintenance", id);
    db.prepare("DELETE FROM maintenances WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "maintenances", id, "");
    return { ok: true };
  });
}

module.exports = registerMaintenancesHandlers;
