function registerTechniciansHandlers({ ipcMain, getDatabase, guards, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");

  const TECHNICIAN_UPDATE_FIELDS = [
    ["full_name", "Nombre"],
    ["phone", "Telefono"],
    ["email", "Email"],
    ["specialty", "Especialidad"],
  ];

  ipcMain.handle(
    "technicians:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare("SELECT * FROM technicians ORDER BY id DESC").all();
    })
  );

  ipcMain.handle("technicians:create", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO technicians (full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", new Date().toISOString());
    const newTech = db.prepare("SELECT id FROM technicians WHERE full_name = ? ORDER BY id DESC LIMIT 1").get(technician.fullName);
    logActivity(db, technician._username, "CREATE", "technicians", newTech?.id, technician.fullName);
    return { ok: true };
  });

  ipcMain.handle("technicians:update", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM technicians WHERE id = ?").get(Number(technician.id));
    if (!before) return { ok: false, message: "Tecnico no encontrado." };

    const after = {
      full_name: technician.fullName,
      phone: technician.phone || "",
      email: technician.email || "",
      specialty: technician.specialty || "",
    };

    db.prepare(`
      UPDATE technicians
      SET full_name = ?, phone = ?, email = ?, specialty = ?
      WHERE id = ?
    `).run(after.full_name, after.phone, after.email, after.specialty, Number(technician.id));

    logActivity(
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
    const db = getDatabase();
    const row = db.prepare("SELECT full_name FROM technicians WHERE id = ?").get(Number(id));
    db.prepare("DELETE FROM technicians WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "technicians", id, row?.full_name || "");
    return { ok: true };
  });
}

module.exports = registerTechniciansHandlers;
