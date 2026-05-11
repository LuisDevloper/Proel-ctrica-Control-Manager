const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const { registerIpcHandlers } = require("./ipc");
const { initializeDatabase } = require("../database/db");
const { startBackupScheduler, stopBackupScheduler } = require("../services/backup");
const { logInfo, logError } = require("../services/logger");
const { autoUpdater } = require("electron-updater");

const VITE_DEV_PORT = 5173;
const isDev = !app.isPackaged;

// Estado persistente de la ventana (sin dependencias externas)
const Store = require("electron-store").default ?? require("electron-store");
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
    if (state.maximized) {
      mainWindow.maximize();
    } else {
      mainWindow.show();
    }
  });

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

  autoUpdater.autoDownload    = true;   // descarga en segundo plano
  autoUpdater.autoInstallOnAppQuit = true; // instala al cerrar la app

  // Notifica al renderer sobre el estado del update
  function sendStatus(event, data = {}) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("updater:event", { event, ...data });
  }

  autoUpdater.on("checking-for-update",  ()      => sendStatus("checking"));
  autoUpdater.on("update-not-available", ()      => sendStatus("up-to-date"));
  autoUpdater.on("update-available",     (info)  => sendStatus("available",    { version: info.version }));
  autoUpdater.on("download-progress",    (prog)  => sendStatus("downloading",  { percent: Math.round(prog.percent) }));
  autoUpdater.on("update-downloaded",    (info)  => sendStatus("downloaded",   { version: info.version }));
  autoUpdater.on("error",                (err)   => {
    logError("updater.error", err);
    sendStatus("error", { message: err.message });
  });

  // IPC: el renderer puede pedir instalar ahora
  ipcMain.on("updater:install-now", () => autoUpdater.quitAndInstall(false, true));

  // Verificar 5 segundos después del arranque (no bloquear el inicio)
  setTimeout(() => autoUpdater.checkForUpdates(), 5000);

  // Verificar cada 2 horas mientras la app está abierta
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    registerIpcHandlers();
    startBackupScheduler();
    createMainWindow();
    setupAutoUpdater();
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
