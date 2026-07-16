const path = require("path");
const fs   = require("fs");
const { app } = require("electron");

/** Ruta al .ico de la app — funciona en desarrollo y en el instalador empaquetado. */
function getAppIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, "icon.ico"),
        path.join(process.resourcesPath, "build", "icon.ico"),
      ]
    : [path.join(__dirname, "../../build/icon.ico")];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

/** Opciones comunes para Notification de Electron (incluye icono). */
function notificationOptions({ title, body, timeoutType = "default" }) {
  const opts = { title, body, timeoutType };
  const icon = getAppIconPath();
  if (icon && fs.existsSync(icon)) opts.icon = icon;
  return opts;
}

module.exports = { getAppIconPath, notificationOptions };
