const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let logDir = "";

function ensureLogDir() {
  if (!logDir) {
    logDir = path.join(app.getPath("userData"), "logs");
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function write(level, event, data = {}) {
  try {
    const dir = ensureLogDir();
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `${day}.log`);
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      data
    });
    fs.appendFileSync(file, `${entry}\n`, "utf8");
  } catch (_error) {
    // Avoid crashing app due to logger failures.
  }
}

function logInfo(event, data = {}) {
  write("info", event, data);
}

function logError(event, error, data = {}) {
  write("error", event, {
    ...data,
    message: error?.message || String(error),
    stack: error?.stack || null
  });
}

module.exports = {
  logInfo,
  logError
};
