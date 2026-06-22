function registerSystemHandlers({ ipcMain, app, fs, path, BrowserWindow, getDatabase, closeDatabaseForFileReplace, reopenDatabase, logInfo, logError, guards, logActivity, auth }) {
  const { denyIfNotAuthenticated, denyIfVisor } = guards;

  ipcMain.handle("db:ping", async () => {
    try {
      const db = getDatabase();
      await db.prepare("SELECT 1 AS ok").get();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("app:info", () => {
    let productName = app.getName();
    try {
      const pkgPath = path.join(__dirname, "../../../package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.build && typeof pkg.build.productName === "string" && pkg.build.productName.trim()) {
        productName = pkg.build.productName.trim();
      }
    } catch (_) {}

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

  /** Backup no aplica con PostgreSQL en la nube — los datos ya están respaldados por Neon. */
  ipcMain.handle("db:backup", async (_event) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    return {
      ok: false,
      message: "El backup local no aplica con la base de datos en la nube (Neon). Los datos están respaldados automáticamente.",
    };
  });

  /** Restore no aplica con PostgreSQL en la nube. */
  ipcMain.handle("db:restore", async (_event) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    return {
      ok: false,
      message: "La restauración local no aplica con la base de datos en la nube (Neon).",
    };
  });
}

module.exports = registerSystemHandlers;
