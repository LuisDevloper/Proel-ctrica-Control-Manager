function registerImportHandlers({ ipcMain, dialog, getDatabase, guards, excelImport, logActivity, auth }) {
  const { denyIfVisor } = guards;
  const { resolveActivityActor } = require("../activity");
  const {
    IMPORT_MAX_ROWS,
    parseExcelSheetForImport,
    importMotorsFromRows,
    importTechniciansFromRows,
    importTurbinasFromRows,
  } = excelImport;

  ipcMain.handle("import:parse-excel", async (_event, { entity }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: `Seleccionar archivo Excel de ${entity}`,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
      properties: ["openFile"],
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };

    try {
      const ExcelJS = require("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePaths[0]);
      const ws = wb.worksheets[0];
      if (!ws) return { ok: false, message: "El archivo no tiene hojas." };

      const parsed = parseExcelSheetForImport(ws, entity);
      if (!parsed.ok) return parsed;
      if (!parsed.rows.length) {
        return { ok: false, message: "No hay filas de datos debajo de los encabezados." };
      }
      return {
        ok: true,
        headers: parsed.headers,
        rows: parsed.rows,
        rowLimitReached: parsed.rowLimitReached === true,
        extraRowsInFile: parsed.extraRowsInFile || 0,
        importMaxRows: parsed.importMaxRows || IMPORT_MAX_ROWS,
      };
    } catch (e) {
      return { ok: false, message: "No se pudo leer el archivo: " + e.message };
    }
  });

  ipcMain.handle("import:save-motors", async (_event, { rows }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    return importMotorsFromRows(db, rows, resolveActivityActor(auth), logActivity);
  });

  ipcMain.handle("import:save-technicians", async (_event, { rows }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    return importTechniciansFromRows(db, rows, resolveActivityActor(auth), logActivity);
  });

  ipcMain.handle("import:save-turbinas", async (_event, { rows }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    return importTurbinasFromRows(db, rows, resolveActivityActor(auth), logActivity);
  });
}

module.exports = registerImportHandlers;
