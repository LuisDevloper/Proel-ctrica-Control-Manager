const { app, BrowserWindow, screen, ipcMain } = require("electron");
const { buildApplicationMenu } = require("./menu");
const path = require("path");
const fs = require("fs");
const { registerIpcHandlers } = require("./ipc");
const { initializeDatabase, getDatabase } = require("../database/db");
const { autoMigrateIfNeeded } = require("../database/autoMigrate");
const { startBackupScheduler, stopBackupScheduler } = require("../services/backup");
const { startNativeNotifications } = require("../services/nativeNotifications");
const { logInfo, logError } = require("../services/logger");
const { getAppIconPath, notificationOptions } = require("../services/appIcon");
const semver = require("semver");

const VITE_DEV_PORT = 5173;
const isDev = !app.isPackaged;

// Nombre correcto en notificaciones de Windows y en la barra de tareas
app.setAppUserModelId("Proeléctrica Control Manager");

// Una sola instancia: si el usuario abre de nuevo el acceso directo, se enfoca la ventana ya abierta.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

/** Referencia al autoUpdater empaquetado (para comprobación manual desde el renderer). */
let packagedAutoUpdater = null;

// Estado persistente de la ventana (sin dependencias externas)
const Store = require("electron-store");
const windowStore    = new Store({ name: "window-state" });
const migrationStore = new Store({ name: "migration-state" });
/** Actualizacion descargada pendiente de instalar (recordatorio al reiniciar). */
const updaterStateStore = new Store({ name: "updater-state" });

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
  const iconPath = getAppIconPath();
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

  // Bloquear zoom — resetear a 0 cada vez que el usuario intente cambiarlo
  mainWindow.webContents.setZoomLevel(0);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.on("zoom-changed", () => {
    mainWindow.webContents.setZoomLevel(0);
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
/** Convierte releaseNotes de electron-updater a lista de lineas. */
function parseUpdaterReleaseNotes(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item : item?.note))
      .map((line) => String(line || "").trim())
      .filter(Boolean);
  }
  return [];
}

function storePendingRelease(version, releaseNotes) {
  if (!version) return;
  const highlights = parseUpdaterReleaseNotes(releaseNotes);
  updaterStateStore.set("pendingRelease", {
    version: String(version),
    title: highlights.length ? null : `Version ${version}`,
    highlights,
  });
}

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
  autoUpdater.on("update-available",     (info) => {
    storePendingRelease(info.version, info.releaseNotes);
    sendStatus("available", { version: info.version });
    // Notificación nativa de Windows al detectar actualización
    try {
      const { Notification } = require("electron");
      if (Notification.isSupported()) {
        const n = new Notification(notificationOptions({
          title: "Proeléctrica — Actualización disponible",
          body: `La versión ${info.version} está descargándose en segundo plano.`,
        }));
        n.on("click", () => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
        });
        n.show();
      }
    } catch (_) {}
  });
  autoUpdater.on("download-progress",    (prog) => sendStatus("downloading", { percent: Math.round(prog.percent) }));
  autoUpdater.on("update-downloaded",    (info) => {
    try {
      storePendingRelease(info.version, info.releaseNotes);
      updaterStateStore.set("pendingVersion", info.version);
    } catch (e) {
      logError("updater.pending_store", e);
    }
    sendStatus("downloaded", { version: info.version });
    // Notificación nativa de Windows al terminar la descarga
    try {
      const { Notification } = require("electron");
      if (Notification.isSupported()) {
        const n = new Notification(notificationOptions({
          title: "Proeléctrica — Lista para instalar",
          body: `La versión ${info.version} está lista. Reinicia la app para aplicar la actualización.`,
        }));
        n.on("click", () => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
        });
        n.show();
      }
    } catch (_) {}
  });
  autoUpdater.on("error",                (err)  => {
    logError("updater.error", err);
    sendStatus("error", { message: err.message });
  });

  ipcMain.on("updater:install-now", () => {
    try {
      updaterStateStore.delete("pendingVersion");
    } catch (e) {
      logError("updater.pending_clear", e);
    }
    autoUpdater.quitAndInstall(false, true);
  });

  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch(e) { logError("updater.check", e); } }, 5000);
  setInterval(() => { try { autoUpdater.checkForUpdates(); } catch(e) { logError("updater.check", e); } }, 2 * 60 * 60 * 1000);
}

if (gotTheLock) {
  app.whenReady().then(async () => {
    try {
      buildApplicationMenu({
        getMainWindow: () => BrowserWindow.getAllWindows()[0],
        isDev,
      });

      await initializeDatabase();

      // Migrar datos locales de SQLite → Neon (solo la primera vez por PC)
      const migrationResult = await autoMigrateIfNeeded(app, migrationStore, getDatabase());
      if (migrationResult.ok) {
        logInfo("auto_migrate.done", migrationResult.stats);
        migrationStore.set("lastMigrationStats", migrationResult.stats);
      }

      registerIpcHandlers();
      startBackupScheduler();
      startNativeNotifications(getDatabase);
      createMainWindow();
      setupAutoUpdater();

      ipcMain.handle("updater:check", async () => {
        if (isDev) return { ok: false, reason: "dev" };
        if (!packagedAutoUpdater) return { ok: false, reason: "no_updater" };
        try {
          const result = await packagedAutoUpdater.checkForUpdates();
          const updateAvailable =
            result != null &&
            (result.isUpdateAvailable === true ||
              (Object.prototype.hasOwnProperty.call(result, "downloadPromise") &&
                result.downloadPromise != null));
          return { ok: true, updateAvailable };
        } catch (e) {
          logError("updater.check_manual", e);
          return { ok: false, message: e?.message || String(e) };
        }
      });

      ipcMain.handle("updater:getPendingInstall", () => {
        if (isDev || !app.isPackaged) return null;
        const pending = updaterStateStore.get("pendingVersion");
        if (!pending || typeof pending !== "string") return null;
        const cur = app.getVersion();
        try {
          if (!semver.valid(pending) || !semver.gt(pending, cur)) {
            updaterStateStore.delete("pendingVersion");
            return null;
          }
        } catch (e) {
          logError("updater.pending_semver", e);
          updaterStateStore.delete("pendingVersion");
          return null;
        }
        return { version: pending };
      });

      ipcMain.handle("migration:getStatus", () => {
        const stats = migrationStore.get("lastMigrationStats");
        if (!stats) return null;
        migrationStore.delete("lastMigrationStats");
        return stats;
      });

      ipcMain.handle("updater:getReleaseNotes", (_event, version) => {
        if (isDev || !app.isPackaged) return null;
        const normalized = String(version || "").replace(/^v/i, "").trim();
        const stored = updaterStateStore.get("pendingRelease");
        if (!stored || String(stored.version).replace(/^v/i, "") !== normalized) return null;
        return stored;
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
}
