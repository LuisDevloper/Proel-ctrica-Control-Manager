function registerActivityHandlers({ ipcMain, getDatabase, guards }) {
  const { denyIfNotAdmin } = guards;

  ipcMain.handle("activity:list", async (_event, { limit = 100 } = {}) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    return await db.prepare(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  });

}

module.exports = registerActivityHandlers;
