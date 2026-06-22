function registerUsersHandlers({ ipcMain, getDatabase, bcrypt, guards, logActivity, auth }) {
  const { denyIfNotAdmin } = guards;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr } = require("../../../modules/activity/unchanged");
  const { validate, validateId, schemas } = require("../schemas");

  function actorUsername() {
    return auth.getAuthSession()?.username || "sistema";
  }

  ipcMain.handle("users:list", async () => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    return await db.prepare("SELECT id, username, role FROM users ORDER BY id ASC").all();
  });

  ipcMain.handle("users:create", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const invalid = validate(schemas.userCreateSchema, data);
    if (invalid) return invalid;
    const db = getDatabase();
    const exists = await db.prepare("SELECT id FROM users WHERE username = ?").get(data.username);
    if (exists) return { ok: false, message: "El nombre de usuario ya existe." };
    const hash = await bcrypt.hash(data.password, 10);
    const result = await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(
      data.username,
      hash,
      data.role || "OPERADOR"
    );
    await logActivity(
      db,
      actorUsername(),
      "CREATE",
      "users",
      result.lastInsertRowid,
      `Usuario ${data.username} (${data.role || "OPERADOR"})`
    );
    return { ok: true };
  });

  ipcMain.handle("users:update-role", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const invalid = validate(schemas.userUpdateRoleSchema, data);
    if (invalid) return invalid;
    const db = getDatabase();
    const before = await db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(Number(data.id));
    if (!before) return { ok: false, message: "Usuario no encontrado." };
    if (isRowUnchanged(before, { role: data.role }, [{ beforeKey: "role", normalize: normStr }])) {
      return { ok: true, unchanged: true };
    }
    await db.prepare("UPDATE users SET role = ? WHERE id = ?").run(data.role, Number(data.id));
    await logActivity(
      db,
      actorUsername(),
      "UPDATE",
      "users",
      data.id,
      buildUpdateDetails({
        summary: before.username,
        fields: [["role", "Rol"]],
        before,
        after: { role: data.role },
      })
    );
    return { ok: true };
  });

  ipcMain.handle("users:reset-password", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const invalid = validate(schemas.userResetPasswordSchema, data);
    if (invalid) return invalid;
    const db = getDatabase();
    const target = await db.prepare("SELECT username FROM users WHERE id = ?").get(Number(data.id));
    if (!target) return { ok: false, message: "Usuario no encontrado." };
    const hash = await bcrypt.hash(data.password, 10);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, Number(data.id));
    await logActivity(
      db,
      actorUsername(),
      "UPDATE",
      "users",
      data.id,
      `${target.username} | Contrasena: (oculto) -> (restablecida)`
    );
    return { ok: true };
  });

  ipcMain.handle("users:delete", async (_event, id) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const invalid = validateId(id);
    if (invalid) return invalid;
    const db = getDatabase();
    const admins = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'ADMIN'").get();
    const target = await db.prepare("SELECT username, role FROM users WHERE id = ?").get(Number(id));
    if (target?.role === "ADMIN" && Number(admins.c) <= 1) return { ok: false, message: "No puedes eliminar el ultimo administrador." };
    await db.prepare("DELETE FROM users WHERE id = ?").run(Number(id));
    await logActivity(db, actorUsername(), "DELETE", "users", id, target?.username || "");
    return { ok: true };
  });
}

module.exports = registerUsersHandlers;
