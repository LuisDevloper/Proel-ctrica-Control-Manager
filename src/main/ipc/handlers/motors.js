function registerMotorsHandlers({ ipcMain, getDatabase, guards, equipment, logActivity, logInfo, deleteDocumentsForEntity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { canonicalMotorStatus, canonicalOperationalLocation } = equipment;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");

  const MOTOR_UPDATE_FIELDS = [
    ["code", "Codigo"],
    ["brand", "Marca"],
    ["model", "Modelo"],
    ["serial_number", "Serie"],
    ["power", "Potencia"],
    ["voltage", "Voltaje"],
    ["rpm", "RPM"],
    ["location", "Ubicacion"],
    ["operational_location", "Ubicacion operativa"],
    ["status", "Estado"],
    ["installed_at", "Instalacion"],
    ["notes", "Notas"],
    ["photo", "Foto", { binary: true }],
  ];

  ipcMain.handle(
    "motors:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT m.*,
        (SELECT s.logistics_status FROM external_workshop_shipments s
         WHERE s.equipment_type = 'motor' AND s.equipment_id = m.id
           AND s.logistics_status NOT IN ('Entrada registrada', 'Equipo entregado')
         ORDER BY s.id DESC LIMIT 1) AS active_logistics_status
      FROM motors m
      ORDER BY m.id DESC
    `).all();
    })
  );

  ipcMain.handle(
    "motors:detail",
    secureHandler(denyIfNotAuthenticated, (_event, id) => {
      const db = getDatabase();
      const motor = db.prepare("SELECT * FROM motors WHERE id = ?").get(Number(id));
      const maintenances = db.prepare(`
      SELECT m.*, t.full_name as technician_name
      FROM maintenances m
      LEFT JOIN technicians t ON t.id = m.technician_id
      WHERE m.motor_id = ? ORDER BY m.maintenance_date DESC
    `).all(Number(id));
      const failures = db.prepare(`
      SELECT f.*, t.full_name as technician_name
      FROM failures f
      LEFT JOIN technicians t ON t.id = f.technician_id
      WHERE f.motor_id = ? ORDER BY f.reported_at DESC
    `).all(Number(id));
      return { motor, maintenances, failures };
    })
  );

  ipcMain.handle("motors:create", async (_event, motor) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO motors (
        code, brand, model, serial_number, voltage, power, rpm, location, operational_location, status, installed_at, notes, photo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      motor.code,
      motor.brand,
      motor.model || "",
      motor.serial_number || "",
      motor.voltage || null,
      motor.power || null,
      motor.rpm || null,
      motor.location || "",
      canonicalOperationalLocation(motor.operationalLocation || motor.operational_location),
      canonicalMotorStatus(motor.status).status,
      motor.installed_at || null,
      motor.notes || "",
      motor.photo || null,
      new Date().toISOString()
    );
    logInfo("motors.create", { code: motor.code });
    const newRow = db.prepare("SELECT id FROM motors WHERE code = ? ORDER BY id DESC LIMIT 1").get(motor.code);
    logActivity(db, motor._username, "CREATE", "motors", newRow?.id, `Motor ${motor.code} — ${motor.brand}`);
    return { ok: true };
  });

  ipcMain.handle("motors:update", async (_event, motor) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM motors WHERE id = ?").get(Number(motor.id));
    if (!before) return { ok: false, message: "Motor no encontrado." };

    const operationalLocation = canonicalOperationalLocation(motor.operationalLocation || motor.operational_location);
    const status = canonicalMotorStatus(motor.status).status;
    const photo = motor.photo !== undefined ? motor.photo : before.photo;

    db.prepare(`
      UPDATE motors
      SET code = ?, brand = ?, model = ?, serial_number = ?, power = ?, voltage = ?, rpm = ?,
          location = ?, operational_location = ?, status = ?, installed_at = ?, notes = ?, photo = ?
      WHERE id = ?
    `).run(
      motor.code,
      motor.brand,
      motor.model || "",
      motor.serial_number || "",
      motor.power || null,
      motor.voltage || null,
      motor.rpm || null,
      motor.location || "",
      operationalLocation,
      status,
      motor.installed_at || null,
      motor.notes || "",
      photo,
      Number(motor.id)
    );

    const after = {
      code: motor.code,
      brand: motor.brand,
      model: motor.model || "",
      serial_number: motor.serial_number || "",
      power: motor.power || null,
      voltage: motor.voltage || null,
      rpm: motor.rpm || null,
      location: motor.location || "",
      operational_location: operationalLocation,
      status,
      installed_at: motor.installed_at || null,
      notes: motor.notes || "",
      photo,
    };

    logActivity(
      db,
      motor._username,
      "UPDATE",
      "motors",
      motor.id,
      buildUpdateDetails({
        summary: `Motor ${motor.code}`,
        fields: MOTOR_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("motors:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT code, brand FROM motors WHERE id = ?").get(Number(id));
    deleteDocumentsForEntity(db, "motor", id);
    db.prepare("DELETE FROM motors WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "motors", id, row ? `Motor ${row.code} — ${row.brand}` : "");
    return { ok: true };
  });
}

module.exports = registerMotorsHandlers;
