import ExcelJS from "exceljs";

/**
 * Convierte valores de fecha guardados como "YYYY-MM-DD" (o prefijo ISO) a un Date
 * en calendario local. Evita el desfase de un día que produce parsear "YYYY-MM-DD"
 * como UTC medianoche y dejar que Excel/ExcelJS derive el día en la zona horaria del usuario.
 */
function toExcelCalendarDate(raw) {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      return new Date(y, mo - 1, d);
    }
  }
  return null;
}

// Paleta corporativa Proéléctrica
const COLORS = {
  headerBg:    "0D1825",   // Azul oscuro
  headerText:  "EAF2FB",   // Blanco azulado
  titleBg:     "1A4A8A",   // Azul medio
  titleText:   "FFFFFF",
  altRow:      "F0F5FA",   // Gris muy claro para filas alternas
  border:      "C5D5E8",
  accent:      "2F8DFF",
};

async function loadLogoBuffer() {
  try {
    const res = await fetch("./logo.png");
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

let logoBufferPromise = null;

function getLogoBuffer() {
  if (!logoBufferPromise) logoBufferPromise = loadLogoBuffer();
  return logoBufferPromise;
}

function addSheetLogo(wb, ws, logoBuffer) {
  if (!logoBuffer) return;
  const imageId = wb.addImage({
    buffer: logoBuffer,
    extension: "png",
  });
  ws.addImage(imageId, {
    tl: { col: 0.2, row: 0.05 },
    ext: { width: 96, height: 46 },
  });
}

/**
 * Exporta datos a un archivo .xlsx con formato profesional
 * @param {string} fileName - nombre del archivo sin extensión
 * @param {string} sheetTitle - título visible en la primera fila
 * @param {Array<{key, header, width?}>} columns - definición de columnas
 * @param {Array<Object>} rows - datos a exportar
 */
export async function xlsxExport(fileName, sheetTitle, columns, rows) {
  const logoBuffer = await getLogoBuffer();
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Proélectrica Control Manager";
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet(sheetTitle, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    views: [{ state: "frozen", ySplit: 3 }],  // Congelar las 3 primeras filas
  });

  const colCount = columns.length;

  // ── Fila 1: Título principal ──────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell("A1");
  titleCell.value = `PROELECTRICA — ${sheetTitle.toUpperCase()}`;
  titleCell.font  = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.titleText } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.titleBg } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;
  addSheetLogo(wb, ws, logoBuffer);

  // ── Fila 2: Fecha de exportación ─────────────────────────────────────────
  ws.mergeCells(2, 1, 2, colCount);
  const dateCell = ws.getCell("A2");
  const now = new Date();
  dateCell.value = `Exportado el ${now.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })} a las ${now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}   •   Total de registros: ${rows.length}`;
  dateCell.font  = { name: "Calibri", size: 9, italic: true, color: { argb: "7A9BB8" } };
  dateCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF2FB" } };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Fila 3: Encabezados de columnas ──────────────────────────────────────
  columns.forEach((col, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = col.header.toUpperCase();
    cell.font  = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.headerText } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
    cell.border = {
      top:    { style: "thin", color: { argb: COLORS.accent } },
      bottom: { style: "thin", color: { argb: COLORS.accent } },
      left:   { style: "thin", color: { argb: "1A2D47" } },
      right:  { style: "thin", color: { argb: "1A2D47" } },
    };
  });
  ws.getRow(3).height = 22;

  // ── Filas de datos ────────────────────────────────────────────────────────
  rows.forEach((row, rowIdx) => {
    const isAlt = rowIdx % 2 === 1;
    const exRow = ws.addRow(
      columns.map((col) => {
        const raw = row[col.key];
        const dateVal = toExcelCalendarDate(raw);
        if (dateVal) return dateVal;
        return raw ?? "";
      })
    );
    exRow.height = 18;

    exRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10 };
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: isAlt ? COLORS.altRow : "FFFFFF" },
      };
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = {
        top:    { style: "hair", color: { argb: COLORS.border } },
        bottom: { style: "hair", color: { argb: COLORS.border } },
        left:   { style: "hair", color: { argb: COLORS.border } },
        right:  { style: "hair", color: { argb: COLORS.border } },
      };
      const colDef = columns[colNumber - 1];
      const v = colDef ? row[colDef.key] : undefined;
      if (toExcelCalendarDate(v)) {
        cell.numFmt = "dd/mm/yyyy";
        cell.alignment.horizontal = "right";
      } else if (typeof v === "number") cell.alignment.horizontal = "right";
    });
  });

  // ── Anchos de columna ─────────────────────────────────────────────────────
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width || 20;
  });

  // ── Fila de totales al final (si hay filas) ───────────────────────────────
  if (rows.length > 0) {
    ws.addRow([]); // fila vacía separadora
    const summaryRow = ws.addRow(
      columns.map((col, i) => i === 0 ? `Total: ${rows.length} registros` : "")
    );
    summaryRow.getCell(1).font = { name: "Calibri", size: 9, bold: true, italic: true, color: { argb: "4A6A8A" } };
    summaryRow.getCell(1).alignment = { horizontal: "left" };
  }

  // ── Generar y descargar ───────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
