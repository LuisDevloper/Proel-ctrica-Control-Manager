const { Menu, app, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const MENU_CHANNEL = "app:menu-action";

const NAV_MENU = [
  { label: "Dashboard", view: "dashboard", accelerator: "Alt+1" },
  { label: "Motores", view: "motores", accelerator: "Alt+2" },
  { label: "Mantenimientos", view: "mantenimientos", accelerator: "Alt+3" },
  { label: "Fallas", view: "fallas", accelerator: "Alt+4" },
  { label: "Tecnicos", view: "tecnicos", accelerator: "Alt+5" },
  { label: "Inventario", view: "inventario", accelerator: "Alt+6" },
  { label: "Calendario", view: "calendario", accelerator: "Alt+7" },
  { label: "Configuracion", view: "configuracion", accelerator: "Alt+8" },
  { label: "Usuarios", view: "usuarios", accelerator: "Alt+9", adminOnly: true },
  { label: "Registro de actividad", view: "actividad", adminOnly: true },
];

function getProductName() {
  try {
    const pkgPath = path.join(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.build?.productName?.trim()) return pkg.build.productName.trim();
  } catch (_) {
    /* fallback */
  }
  return app.getName();
}

/**
 * @param {{ getMainWindow: () => import('electron').BrowserWindow | undefined, isDev: boolean }} opts
 */
function buildApplicationMenu({ getMainWindow, isDev }) {
  function send(action, payload = {}) {
    const win = getMainWindow();
    if (!win?.webContents || win.isDestroyed()) return;
    win.webContents.send(MENU_CHANNEL, { action, ...payload });
  }

  function getWin() {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win : null;
  }

  async function showAbout() {
    const win = getWin();
    const productName = getProductName();
    const version = app.getVersion();
    const plat = process.platform;
    const osName =
      plat === "win32" ? "Windows" :
      plat === "darwin" ? "macOS" :
      plat === "linux" ? "Linux" : plat;
    let archLabel = process.arch;
    if (process.arch === "x64") archLabel = "64 bits (x64)";
    else if (process.arch === "arm64") archLabel = "64 bits (ARM)";

    await dialog.showMessageBox(win ?? undefined, {
      type: "info",
      title: "Acerca de",
      message: productName,
      detail: [
        `Version ${version}`,
        `${osName}, ${archLabel}`,
        isDev ? "Modo desarrollo" : "Aplicacion instalada",
        "",
        "Sistema de control de motores y mantenimientos industriales.",
        "Proelectrica",
      ].join("\n"),
      buttons: ["Aceptar"],
      noLink: true,
    });
  }

  const verSubmenu = [
    ...NAV_MENU.map((item) => ({
      label: item.label,
      accelerator: item.accelerator,
      click: () => send("navigate", { view: item.view, adminOnly: !!item.adminOnly }),
    })),
    { type: "separator" },
    {
      label: "Pantalla completa",
      accelerator: "F11",
      click: () => {
        const win = getWin();
        if (win) win.setFullScreen(!win.isFullScreen());
      },
    },
    {
      label: "Alternar tema claro/oscuro",
      accelerator: "CmdOrCtrl+Shift+L",
      click: () => send("theme-toggle"),
    },
    { type: "separator" },
    {
      label: "Aumentar zoom",
      accelerator: "CmdOrCtrl+=",
      click: () => {
        const win = getWin();
        if (win) win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5);
      },
    },
    {
      label: "Reducir zoom",
      accelerator: "CmdOrCtrl+-",
      click: () => {
        const win = getWin();
        if (win) win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5);
      },
    },
    {
      label: "Restablecer zoom",
      accelerator: "CmdOrCtrl+0",
      click: () => {
        const win = getWin();
        if (win) win.webContents.setZoomLevel(0);
      },
    },
  ];

  if (isDev) {
    verSubmenu.push(
      { type: "separator" },
      {
        label: "Recargar",
        accelerator: "CmdOrCtrl+R",
        click: () => getWin()?.webContents.reload(),
      },
      {
        label: "Herramientas de desarrollo",
        accelerator: "F12",
        click: () => getWin()?.webContents.toggleDevTools(),
      }
    );
  }

  const template = [
    {
      label: "Archivo",
      submenu: [
        {
          label: "Cerrar sesion",
          accelerator: "CmdOrCtrl+Shift+Q",
          click: () => send("logout"),
        },
        { type: "separator" },
        {
          label: "Salir",
          role: "quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
        },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { label: "Deshacer", role: "undo" },
        { label: "Rehacer", role: "redo" },
        { type: "separator" },
        { label: "Cortar", role: "cut" },
        { label: "Copiar", role: "copy" },
        { label: "Pegar", role: "paste" },
        { type: "separator" },
        { label: "Seleccionar todo", role: "selectAll" },
      ],
    },
    {
      label: "Ver",
      submenu: verSubmenu,
    },
    {
      label: "Datos",
      submenu: [
        {
          label: "Copia de seguridad...",
          accelerator: "CmdOrCtrl+B",
          click: () => send("backup"),
        },
        {
          label: "Restaurar base de datos...",
          click: () => send("restore"),
        },
      ],
    },
    {
      label: "Herramientas",
      submenu: [
        {
          label: "Buscar actualizaciones",
          click: () => send("check-updates"),
        },
        {
          label: "Repositorio en GitHub",
          click: () => {
            shell.openExternal("https://github.com/LuisDevloper/Proel-ctrica-Control-Manager").catch(() => {});
          },
        },
      ],
    },
    {
      label: "Ventana",
      submenu: [
        { label: "Minimizar", role: "minimize" },
        { label: "Maximizar", role: "maximize" },
        { type: "separator" },
        {
          label: "Pantalla completa",
          accelerator: "F11",
          click: () => {
            const win = getWin();
            if (win) win.setFullScreen(!win.isFullScreen());
          },
        },
        { type: "separator" },
        { label: "Cerrar ventana", role: "close" },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: `Acerca de ${getProductName()}`,
          click: () => { showAbout().catch(() => {}); },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { buildApplicationMenu, MENU_CHANNEL };
