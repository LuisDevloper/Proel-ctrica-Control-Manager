function registerSystemHandlers({ ipcMain, app, fs, path, BrowserWindow, getDatabase, closeDatabaseForFileReplace, reopenDatabase, logInfo, logError, guards, logActivity, auth }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;

  ipcMain.handle("db:ping", () => {
    try {
      const db = getDatabase();
      db.prepare("SELECT 1").get();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Sin autenticacion: metadatos publicos utiles en login y Configuracion.
  ipcMain.handle("app:info", () => {
    let productName = app.getName();
    try {
      const pkgPath = path.join(__dirname, "../../../package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.build && typeof pkg.build.productName === "string" && pkg.build.productName.trim()) {
        productName = pkg.build.productName.trim();
      }
    } catch (_) {
      /* nombre por defecto de app.getName() */
    }

    const plat = process.platform;
    const osName =
      plat === "win32" ? "Windows" :
      plat === "darwin" ? "macOS" :
      plat === "linux" ? "Linux" :
      plat;

    let archLabel = process.arch;
    if (process.arch === "x64") archLabel = "64 bits (x64)";
    else if (process.arch === "arm64") archLabel = "64 bits (ARM)";

    return {
      productName,
      version: app.getVersion(),
      osName,
      arch: archLabel,
      packaged: app.isPackaged,
      userDataPath: app.getPath("userData"),
    };
  });

  // Sin autenticacion: atajo Alt+Enter y F11 deben funcionar tambien en login.
  ipcMain.handle("window:toggleFullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return { ok: true, fullScreen: next };
  });

  ipcMain.handle("window:isFullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return { ok: !!win, fullScreen: win ? win.isFullScreen() : false };
  });

  ipcMain.handle("db:backup", async (_event) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const dbPath = path.join(app.getPath("userData"), "proelectrica.db");
    const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const { dialog } = require("electron");
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar copia de seguridad",
      defaultPath: `proelectrica-backup-${now}.db`,
      filters: [{ name: "Base de datos SQLite", extensions: ["db"] }],
    });
    if (canceled || !filePath) return { ok: false, message: "Cancelado" };
    fs.copyFileSync(dbPath, filePath);
    logInfo("db.backup", { dest: filePath });
    logActivity(
      getDatabase(),
      auth.getAuthSession()?.username,
      "BACKUP",
      "db",
      null,
      `Copia guardada: ${path.basename(filePath)}`
    );
    return { ok: true };
  });

  ipcMain.handle("db:restore", async (_event) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const dbPath = path.join(app.getPath("userData"), "proelectrica.db");
    const { dialog } = require("electron");
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: "Seleccionar copia de seguridad",
      filters: [{ name: "Base de datos SQLite", extensions: ["db"] }],
      properties: ["openFile"],
    });
    if (canceled || !filePaths?.length) return { ok: false, message: "Cancelado" };

    const autoBackup = dbPath + ".before-restore";
    const restoreUsername = auth.getAuthSession()?.username;
    const restoreDetails = `Base restaurada desde ${path.basename(filePaths[0])}`;
    closeDatabaseForFileReplace();
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, autoBackup);
      }
      fs.copyFileSync(filePaths[0], dbPath);
      logInfo("db.restore", { src: filePaths[0] });
      return { ok: true, message: "Base de datos restaurada. Reinicia la aplicacion si ves comportamientos extranos." };
    } catch (err) {
      logError("db.restore_failed", err);
      return { ok: false, message: err?.message || "No se pudo restaurar la base de datos." };
    } finally {
      try {
        reopenDatabase();
        logActivity(getDatabase(), restoreUsername, "RESTORE", "db", null, restoreDetails);
      } catch (err) {
        logError("db.reopen_after_restore_failed", err);
      }
    }
  });
}

module.exports = registerSystemHandlers;
