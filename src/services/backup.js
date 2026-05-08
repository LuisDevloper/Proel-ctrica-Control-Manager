const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { logInfo, logError } = require("./logger");

let timer = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createBackup() {
  try {
    const userDataPath = app.getPath("userData");
    const dbFile = path.join(userDataPath, "proelectrica.db");
    if (!fs.existsSync(dbFile)) {
      return;
    }

    const backupDir = path.join(userDataPath, "backups");
    ensureDir(backupDir);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `proelectrica-backup-${stamp}.db`);
    fs.copyFileSync(dbFile, backupPath);
    cleanupOldBackups(backupDir, 15);
    logInfo("backup.created", { backupPath });
  } catch (error) {
    logError("backup.create_failed", error);
  }
}

function cleanupOldBackups(backupDir, maxFiles) {
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => ({
      name,
      fullPath: path.join(backupDir, name),
      mtime: fs.statSync(path.join(backupDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(maxFiles).forEach((file) => {
    fs.unlinkSync(file.fullPath);
  });
}

function startBackupScheduler() {
  createBackup();
  timer = setInterval(createBackup, 24 * 60 * 60 * 1000);
  logInfo("backup.scheduler_started");
}

function stopBackupScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startBackupScheduler,
  stopBackupScheduler
};
