function registerMaintenancesHandlers({ ipcMain, getDatabase, guards, equipment, logActivity, deleteDocumentsForEntity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { calendarMonthIsoRange } = equipment;
  const { syncMotorStatusWithMaintenances } = require("../../../modules/equipment/status");
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNum, normNullableId } = require("../../../modules/activity/unchanged");
  const { validate, validateId, schemas } = require("../schemas");

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
    secureHandler(denyIfNotAuthenticated, async () => {
      const db = getDatabase();
      return await db.prepare(`
      SELECT
        m.id,
        m.motor_id,
        m.technician_id,
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
    secureHandler(denyIfNotAuthenticated, async (_event, params) => {
      const invalid = validate(schemas.calendarParamsSchema, params ?? {});
      if (invalid) return invalid;
      const { year, month } = params ?? {};
      const db = getDatabase();
      const { from, to } = calendarMonthIsoRange(year, month);
      return await db.prepare(`
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
    const invalid = validate(schemas.maintenanceCreateSchema, maintenance);
    if (invalid) return invalid;
    const db = getDatabase();
    const result = await db.prepare(`
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
    await syncMotorStatusWithMaintenances(db, maintenance.motorId);
    await logActivity(db, maintenance._username, "CREATE", "maintenances", result.lastInsertRowid, `${maintenance.maintenanceType} — Motor #${maintenance.motorId}`);
    return { ok: true, id: result.lastInsertRowid };
  });

  ipcMain.handle("maintenances:update", async (_event, maintenance) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.maintenanceUpdateSchema, maintenance);
    if (invalid) return invalid;
    const db = getDatabase();
    const before = await db.prepare("SELECT * FROM maintenances WHERE id = ?").get(Number(maintenance.id));
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

    if (isRowUnchanged(before, after, [
      { beforeKey: "motor_id", normalize: normNullableId },
      { beforeKey: "technician_id", normalize: normNullableId },
      { beforeKey: "maintenance_type", normalize: normStr },
      { beforeKey: "maintenance_date", normalize: normStr },
      { beforeKey: "description", normalize: normStr },
      { beforeKey: "cost", normalize: normNum },
      { beforeKey: "status", normalize: normStr },
    ])) {
      return { ok: true, unchanged: true };
    }

    await db.prepare(`
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

    await syncMotorStatusWithMaintenances(db, before.motor_id);
    if (after.motor_id !== before.motor_id) {
      await syncMotorStatusWithMaintenances(db, after.motor_id);
    }

    await logActivity(
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
    const invalid = validateId(id);
    if (invalid) return invalid;
    const db = getDatabase();
    const row = await db.prepare("SELECT motor_id FROM maintenances WHERE id = ?").get(Number(id));
    await deleteDocumentsForEntity(db, "maintenance", id);
    await db.prepare("DELETE FROM maintenances WHERE id = ?").run(Number(id));
    if (row?.motor_id) await syncMotorStatusWithMaintenances(db, row.motor_id);
    await logActivity(db, null, "DELETE", "maintenances", id, "");
    return { ok: true };
  });
}

module.exports = registerMaintenancesHandlers;
