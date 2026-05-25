function registerFailuresHandlers({ ipcMain, getDatabase, guards, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNullableId } = require("../../../modules/activity/unchanged");

  const FAILURE_UPDATE_FIELDS = [
    ["motor_id", "Motor"],
    ["technician_id", "Tecnico"],
    ["failure_type", "Tipo"],
    ["priority", "Prioridad"],
    ["status", "Estado"],
    ["reported_at", "Fecha reporte"],
    ["solution", "Solucion"],
  ];

  ipcMain.handle(
    "failures:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT
        f.id,
        f.motor_id,
        f.technician_id,
        f.failure_type,
        f.priority,
        f.status,
        f.reported_at,
        f.solution,
        f.notes,
        mo.code AS motor_code,
        t.full_name AS technician_name
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      LEFT JOIN technicians t ON t.id = f.technician_id
      ORDER BY f.id DESC
    `).all();
    })
  );

  ipcMain.handle("failures:create", async (_event, failure) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO failures (
        motor_id, technician_id, failure_type, priority, status, reported_at, solution, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(failure.motorId),
      failure.technicianId ? Number(failure.technicianId) : null,
      failure.failureType,
      failure.priority,
      failure.status,
      failure.reportedAt,
      failure.solution || "",
      failure.notes || "",
      new Date().toISOString()
    );
    const newFail = db.prepare("SELECT id FROM failures ORDER BY id DESC LIMIT 1").get();
    logActivity(db, failure._username, "CREATE", "failures", newFail?.id, `${failure.failureType} — Motor #${failure.motorId}`);
    return { ok: true };
  });

  ipcMain.handle("failures:update", async (_event, failure) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM failures WHERE id = ?").get(Number(failure.id));
    if (!before) return { ok: false, message: "Falla no encontrada." };

    const after = {
      motor_id: Number(failure.motorId),
      technician_id: failure.technicianId ? Number(failure.technicianId) : null,
      failure_type: failure.failureType,
      priority: failure.priority,
      status: failure.status,
      reported_at: failure.reportedAt,
      solution: failure.solution || "",
    };

    const unchanged = isRowUnchanged(before, after, [
      { beforeKey: "motor_id", normalize: normNullableId },
      { beforeKey: "technician_id", normalize: normNullableId },
      { beforeKey: "failure_type", normalize: normStr },
      { beforeKey: "priority", normalize: normStr },
      { beforeKey: "status", normalize: normStr },
      { beforeKey: "reported_at", normalize: normStr },
      { beforeKey: "solution", normalize: normStr },
    ]);

    if (unchanged) return { ok: true, unchanged: true };

    db.prepare(`
      UPDATE failures
      SET motor_id = ?, technician_id = ?, failure_type = ?, priority = ?, status = ?, reported_at = ?, solution = ?
      WHERE id = ?
    `).run(
      after.motor_id,
      after.technician_id,
      after.failure_type,
      after.priority,
      after.status,
      after.reported_at,
      after.solution,
      Number(failure.id)
    );

    logActivity(
      db,
      failure._username,
      "UPDATE",
      "failures",
      failure.id,
      buildUpdateDetails({
        summary: `Falla #${failure.id}`,
        fields: FAILURE_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("failures:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare("DELETE FROM failures WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "failures", id, "");
    return { ok: true };
  });
}

module.exports = registerFailuresHandlers;
