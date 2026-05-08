const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerIpcHandlers } = require("./ipc");
const { initializeDatabase } = require("../database/db");
const { startBackupScheduler, stopBackupScheduler } = require("../services/backup");
const { logInfo, logError } = require("../services/logger");

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#0f1419",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    registerIpcHandlers();
    startBackupScheduler();
    createMainWindow();
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
