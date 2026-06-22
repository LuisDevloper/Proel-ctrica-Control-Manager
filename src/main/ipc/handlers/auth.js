function registerAuthHandlers({ ipcMain, getDatabase, bcrypt, guards, auth, logActivity }) {
  const { denyIfNotAuthenticated } = guards;
  const { setAuthSession, clearAuthSession, getAuthSession } = auth;
  const { validate, schemas } = require("../schemas");

  ipcMain.handle("auth:login", async (_event, credentials) => {
    const invalid = validate(schemas.loginSchema, credentials);
    if (invalid) return invalid;
    const db = getDatabase();
    const user = await db.prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?").get(credentials.username);

    if (!user) {
      return { ok: false, message: "Usuario o contraseña incorrecta." };
    }

    const validPassword = await bcrypt.compare(credentials.password, user.password_hash);
    if (!validPassword) {
      return { ok: false, message: "Usuario o contraseña incorrecta." };
    }

    setAuthSession({ id: user.id, username: user.username, role: user.role });
    await logActivity(db, user.username, "LOGIN", "auth", user.id, `Inicio de sesion (${user.role})`);

    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  });

  ipcMain.handle("auth:logout", async () => {
    const session = getAuthSession();
    if (session) {
      const db = getDatabase();
      await logActivity(db, session.username, "LOGOUT", "auth", session.id, "Cierre de sesion");
    }
    clearAuthSession();
    return { ok: true };
  });

  ipcMain.handle("auth:changePassword", async (_event, data) => {
    const invalid = validate(schemas.changePasswordSchema, data);
    if (invalid) return invalid;
    const { userId, currentPassword, newPassword } = data;
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const session = auth.getAuthSession();
    if (Number(userId) !== Number(session.id)) {
      return { ok: false, message: "No puedes cambiar la contrasena de otro usuario desde aqui." };
    }
    const db = getDatabase();
    const user = await db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
    if (!user) return { ok: false, message: "Usuario no encontrado." };
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return { ok: false, message: "La contrasena actual es incorrecta." };
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, userId);
    await logActivity(db, session.username, "UPDATE", "auth", userId, "Contrasena actualizada");
    return { ok: true };
  });
}

module.exports = registerAuthHandlers;
