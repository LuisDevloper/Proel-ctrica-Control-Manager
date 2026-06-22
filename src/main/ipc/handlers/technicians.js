function registerTechniciansHandlers({ ipcMain, getDatabase, guards, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr } = require("../../../modules/activity/unchanged");
  const { validate, validateId, schemas } = require("../schemas");

  const TECHNICIAN_UPDATE_FIELDS = [
    ["full_name", "Nombre"],
    ["phone", "Telefono"],
    ["email", "Email"],
    ["specialty", "Especialidad"],
  ];

  ipcMain.handle(
    "technicians:list",
    secureHandler(denyIfNotAuthenticated, async () => {
      const db = getDatabase();
      return await db.prepare("SELECT * FROM technicians ORDER BY id DESC").all();
    })
  );

  ipcMain.handle("technicians:create", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.technicianCreateSchema, technician);
    if (invalid) return invalid;
    const db = getDatabase();
    const result = await db.prepare(`
      INSERT INTO technicians (full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", new Date().toISOString());
    await logActivity(db, technician._username, "CREATE", "technicians", result.lastInsertRowid, technician.fullName);
    return { ok: true };
  });

  ipcMain.handle("technicians:update", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.technicianUpdateSchema, technician);
    if (invalid) return invalid;
    const db = getDatabase();
    const before = await db.prepare("SELECT * FROM technicians WHERE id = ?").get(Number(technician.id));
    if (!before) return { ok: false, message: "Tecnico no encontrado." };

    const after = {
      full_name: technician.fullName,
      phone: technician.phone || "",
      email: technician.email || "",
      specialty: technician.specialty || "",
    };

    if (isRowUnchanged(before, after, [
      { beforeKey: "full_name", normalize: normStr },
      { beforeKey: "phone", normalize: normStr },
      { beforeKey: "email", normalize: normStr },
      { beforeKey: "specialty", normalize: normStr },
    ])) {
      return { ok: true, unchanged: true };
    }

    await db.prepare(`
      UPDATE technicians
      SET full_name = ?, phone = ?, email = ?, specialty = ?
      WHERE id = ?
    `).run(after.full_name, after.phone, after.email, after.specialty, Number(technician.id));

    await logActivity(
      db,
      technician._username,
      "UPDATE",
      "technicians",
      technician.id,
      buildUpdateDetails({
        summary: before.full_name,
        fields: TECHNICIAN_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("technicians:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validateId(id);
    if (invalid) return invalid;
    const db = getDatabase();
    const row = await db.prepare("SELECT full_name FROM technicians WHERE id = ?").get(Number(id));
    await db.prepare("DELETE FROM technicians WHERE id = ?").run(Number(id));
    await logActivity(db, null, "DELETE", "technicians", id, row?.full_name || "");
    return { ok: true };
  });
}

module.exports = registerTechniciansHandlers;
