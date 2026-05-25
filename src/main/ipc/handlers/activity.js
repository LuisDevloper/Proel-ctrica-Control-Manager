function registerActivityHandlers({ ipcMain, getDatabase, guards }) {
  const { denyIfNotAdmin } = guards;

  ipcMain.handle("activity:list", (_event, { limit = 100 } = {}) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  });

}

module.exports = registerActivityHandlers;
