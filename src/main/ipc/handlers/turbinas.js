function registerTurbinasHandlers({ ipcMain, getDatabase, guards, equipment, logActivity, deleteDocumentsForEntity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { canonicalMotorStatus, canonicalOperationalLocation } = equipment;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNullableId } = require("../../../modules/activity/unchanged");

  const TURBINE_UPDATE_FIELDS = [
    ["code", "Codigo"],
    ["serial_number", "Numero de serie"],
    ["gg", "GG"],
    ["pt", "PT"],
    ["bearing_1", "Rodamiento 1"],
    ["bearing_2", "Rodamiento 2"],
    ["runtime_retiro", "Runtime retiro"],
    ["comentarios_retiro", "Comentarios retiro"],
    ["operational_location", "Ubicacion operativa"],
    ["status", "Estado"],
    ["motor_id", "Motor asociado"],
    ["notes", "Notas"],
  ];

  ipcMain.handle(
    "turbinas:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT
        t.*,
        m.code AS motor_code,
        (SELECT COUNT(*) FROM documents d WHERE d.entity_type = 'turbine' AND d.entity_id = t.id) AS document_count,
        (SELECT s.logistics_status FROM external_workshop_shipments s
         WHERE s.equipment_type = 'turbine' AND s.equipment_id = t.id
           AND s.logistics_status NOT IN ('Entrada registrada', 'Equipo entregado')
         ORDER BY s.id DESC LIMIT 1) AS active_logistics_status
      FROM turbinas t
      LEFT JOIN motors m ON m.id = t.motor_id
      ORDER BY t.id DESC
    `).all();
    })
  );

  ipcMain.handle(
    "turbinas:detail",
    secureHandler(denyIfNotAuthenticated, (_event, id) => {
      const db = getDatabase();
      const turbine = db.prepare(`
      SELECT t.*, m.code AS motor_code
      FROM turbinas t
      LEFT JOIN motors m ON m.id = t.motor_id
      WHERE t.id = ?
    `).get(Number(id));
      return { turbine };
    })
  );

  ipcMain.handle("turbinas:create", async (_event, turbine) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    try {
      db.prepare(`
        INSERT INTO turbinas (
          code, serial_number, gg, pt, bearing_1, bearing_2, runtime_retiro, comentarios_retiro,
          operational_location, status, motor_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        turbine.code,
        turbine.serialNumber || turbine.serial_number || "",
        turbine.gg || "",
        turbine.pt || "",
        turbine.bearing1 || turbine.bearing_1 || "",
        turbine.bearing2 || turbine.bearing_2 || "",
        turbine.runtimeRetiro || turbine.runtime_retiro || "",
        turbine.comentariosRetiro || turbine.comentarios_retiro || "",
        canonicalOperationalLocation(turbine.operationalLocation || turbine.operational_location),
        canonicalMotorStatus(turbine.status).status,
        turbine.motorId || turbine.motor_id ? Number(turbine.motorId || turbine.motor_id) : null,
        turbine.notes || "",
        new Date().toISOString()
      );
    } catch (e) {
      if (String(e.message || "").includes("UNIQUE")) {
        return { ok: false, message: "Ya existe una turbina con ese codigo." };
      }
      throw e;
    }
    const newRow = db.prepare("SELECT id FROM turbinas WHERE code = ? ORDER BY id DESC LIMIT 1").get(turbine.code);
    logActivity(db, turbine._username, "CREATE", "turbinas", newRow?.id, `Turbina ${turbine.code}`);
    return { ok: true };
  });

  ipcMain.handle("turbinas:update", async (_event, turbine) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM turbinas WHERE id = ?").get(Number(turbine.id));
    if (!before) return { ok: false, message: "Turbina no encontrada." };

    const operationalLocation = canonicalOperationalLocation(turbine.operationalLocation || turbine.operational_location);
    const status = canonicalMotorStatus(turbine.status).status;
    const motorId = turbine.motorId || turbine.motor_id ? Number(turbine.motorId || turbine.motor_id) : null;

    const after = {
      code: turbine.code,
      serial_number: turbine.serialNumber || turbine.serial_number || "",
      gg: turbine.gg || "",
      pt: turbine.pt || "",
      bearing_1: turbine.bearing1 || turbine.bearing_1 || "",
      bearing_2: turbine.bearing2 || turbine.bearing_2 || "",
      runtime_retiro: turbine.runtimeRetiro || turbine.runtime_retiro || "",
      comentarios_retiro: turbine.comentariosRetiro || turbine.comentarios_retiro || "",
      operational_location: operationalLocation,
      status,
      motor_id: motorId,
      notes: turbine.notes || "",
    };

    if (isRowUnchanged(before, after, [
      { beforeKey: "code", normalize: normStr },
      { beforeKey: "serial_number", normalize: normStr },
      { beforeKey: "gg", normalize: normStr },
      { beforeKey: "pt", normalize: normStr },
      { beforeKey: "bearing_1", normalize: normStr },
      { beforeKey: "bearing_2", normalize: normStr },
      { beforeKey: "runtime_retiro", normalize: normStr },
      { beforeKey: "comentarios_retiro", normalize: normStr },
      { beforeKey: "operational_location", normalize: normStr },
      { beforeKey: "status", normalize: normStr },
      { beforeKey: "motor_id", normalize: normNullableId },
      { beforeKey: "notes", normalize: normStr },
    ])) {
      return { ok: true, unchanged: true };
    }

    try {
      db.prepare(`
        UPDATE turbinas
        SET code = ?, serial_number = ?, gg = ?, pt = ?, bearing_1 = ?, bearing_2 = ?,
            runtime_retiro = ?, comentarios_retiro = ?,
            operational_location = ?, status = ?, motor_id = ?, notes = ?
        WHERE id = ?
      `).run(
        after.code,
        after.serial_number,
        after.gg,
        after.pt,
        after.bearing_1,
        after.bearing_2,
        after.runtime_retiro,
        after.comentarios_retiro,
        after.operational_location,
        after.status,
        after.motor_id,
        after.notes,
        Number(turbine.id)
      );
    } catch (e) {
      if (String(e.message || "").includes("UNIQUE")) {
        return { ok: false, message: "Ya existe otra turbina con ese codigo." };
      }
      throw e;
    }

    logActivity(
      db,
      turbine._username,
      "UPDATE",
      "turbinas",
      turbine.id,
      buildUpdateDetails({
        summary: `Turbina ${turbine.code}`,
        fields: TURBINE_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("turbinas:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT code FROM turbinas WHERE id = ?").get(Number(id));
    deleteDocumentsForEntity(db, "turbine", id);
    db.prepare("DELETE FROM turbinas WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "turbinas", id, row ? `Turbina ${row.code}` : "");
    return { ok: true };
  });
}

module.exports = registerTurbinasHandlers;
