const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { registerIpcHandlers } = require("./ipc");
const { initializeDatabase } = require("../database/db");
const { startBackupScheduler, stopBackupScheduler } = require("../services/backup");
const { logInfo, logError } = require("../services/logger");

const VITE_DEV_PORT = 5173;
const isDev = !app.isPackaged;

/** Referencia al autoUpdater empaquetado (para comprobación manual desde el renderer). */
let packagedAutoUpdater = null;

// Estado persistente de la ventana (sin dependencias externas)
const Store = require("electron-store");
const windowStore = new Store({ name: "window-state" });

function getWindowState() {
  const display = screen.getPrimaryDisplay().workAreaSize;
  return {
    width:      windowStore.get("width",      1280),
    height:     windowStore.get("height",     800),
    x:          windowStore.get("x",          undefined),
    y:          windowStore.get("y",          undefined),
    maximized:  windowStore.get("maximized",  false)
  };
}

function saveWindowState(win) {
  if (win.isMaximized()) {
    windowStore.set("maximized", true);
  } else {
    const bounds = win.getBounds();
    windowStore.set("width",     bounds.width);
    windowStore.set("height",    bounds.height);
    windowStore.set("x",         bounds.x);
    windowStore.set("y",         bounds.y);
    windowStore.set("maximized", false);
  }
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "../../build/icon.ico");
  const state    = getWindowState();

  const mainWindow = new BrowserWindow({
    width:     state.width,
    height:    state.height,
    x:         state.x,
    y:         state.y,
    minWidth:  1080,
    minHeight: 680,
    backgroundColor: "#070b10",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Mostrar la ventana al terminar de cargar (evita parpadeo blanco)
  mainWindow.once("ready-to-show", () => {
    // Siempre show() antes de maximize(); en algunos entornos solo maximize()
    // deja el área de contenido sin pintar correctamente.
    mainWindow.show();
    if (state.maximized) {
      mainWindow.maximize();
    }
  });

  if (isDev && process.env.PCM_DEVTOOLS === "1") {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    });
  }

  // Guardar estado al cerrar
  mainWindow.on("close", () => saveWindowState(mainWindow));

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_DEV_PORT}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../renderer-dist/index.html"));
  }
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  // En desarrollo no verificamos actualizaciones
  if (isDev) return;

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (err) {
    logError("updater.load_failed", err);
    return;
  }

  autoUpdater.autoDownload         = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease      = false;
  packagedAutoUpdater              = autoUpdater;

  const updateMetaPath = path.join(process.resourcesPath, "app-update.yml");
  try {
    logInfo("updater.start", {
      version: app.getVersion(),
      appUpdateYml: fs.existsSync(updateMetaPath),
      resourcesPath: process.resourcesPath,
    });
  } catch (e) {
    logError("updater.meta_log", e);
  }

  function sendStatus(event, data = {}) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("updater:event", { event, ...data });
  }

  autoUpdater.on("checking-for-update",  ()     => sendStatus("checking"));
  autoUpdater.on("update-not-available", ()     => sendStatus("up-to-date"));
  autoUpdater.on("update-available",     (info) => sendStatus("available",   { version: info.version }));
  autoUpdater.on("download-progress",    (prog) => sendStatus("downloading", { percent: Math.round(prog.percent) }));
  autoUpdater.on("update-downloaded",    (info) => sendStatus("downloaded",  { version: info.version }));
  autoUpdater.on("error",                (err)  => {
    logError("updater.error", err);
    sendStatus("error", { message: err.message });
  });

  ipcMain.on("updater:install-now", () => autoUpdater.quitAndInstall(false, true));

  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch(e) { logError("updater.check", e); } }, 5000);
  setInterval(() => { try { autoUpdater.checkForUpdates(); } catch(e) { logError("updater.check", e); } }, 2 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    registerIpcHandlers();
    startBackupScheduler();
    createMainWindow();
    setupAutoUpdater();

    ipcMain.handle("updater:check", async () => {
      if (isDev) return { ok: false, reason: "dev" };
      if (!packagedAutoUpdater) return { ok: false, reason: "no_updater" };
      try {
        const result = await packagedAutoUpdater.checkForUpdates();
        const updateAvailable =
          result != null &&
          Object.prototype.hasOwnProperty.call(result, "downloadPromise") &&
          result.downloadPromise != null;
        return { ok: true, updateAvailable };
      } catch (e) {
        logError("updater.check_manual", e);
        return { ok: false, message: e?.message || String(e) };
      }
    });

    logInfo("app.ready");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  } catch (error) {
    logError("app.init_failed", error);
    throw error;
  }
});

app.on("window-all-closed", () => {
  stopBackupScheduler();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
