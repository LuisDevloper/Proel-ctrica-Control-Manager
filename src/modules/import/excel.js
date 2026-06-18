const { canonicalMotorStatus, canonicalOperationalLocation } = require("../equipment/canonical");

/** Día de calendario de una celda con fecha de Excel/ExcelJS → YYYY-MM-DD. */
function excelDateToIsoDay(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** dd/mm/aaaa o dd-mm-aaaa (calendario típico es-*) → YYYY-MM-DD; null si no aplica. */
function parseLocaleDayMonthYearToIso(s) {
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function excelCellStr(v) {
  if (v === null || v === undefined) return "";
  const core = v?.result ?? v?.text ?? v;
  if (core instanceof Date && !Number.isNaN(core.getTime())) {
    return excelDateToIsoDay(core);
  }
  const str = String(core).trim();
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const locale = parseLocaleDayMonthYearToIso(str);
  if (locale) return locale;
  return str;
}

function normImportHeader(s) {
  return excelCellStr(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MOTOR_IMPORT_HEADER_TO_KEY = {
  codigo: "Codigo",
  marca: "Marca",
  modelo: "Modelo",
  "potencia (kw)": "Potencia (kW)",
  potencia: "Potencia (kW)",
  "voltaje (v)": "Voltaje (V)",
  voltaje: "Voltaje (V)",
  rpm: "RPM",
  ubicacion: "Ubicacion",
  "fecha instalacion": "Fecha instalacion",
  estado: "Estado",
  observaciones: "Observaciones",
};

const TECH_IMPORT_HEADER_TO_KEY = {
  nombre: "Nombre",
  telefono: "Telefono",
  email: "Email",
  correo: "Email",
  especialidad: "Especialidad",
};

const TURBINA_IMPORT_HEADER_TO_KEY = {
  codigo: "Codigo",
  "numero de serie": "Numero de serie",
  "no. serie": "Numero de serie",
  serie: "Numero de serie",
  gg: "GG",
  pt: "PT",
  "rodamiento 1": "Rodamiento 1",
  "rodamiento 2": "Rodamiento 2",
  "ubicacion operativa": "Ubicacion operativa",
  ubicacion: "Ubicacion operativa",
  estado: "Estado",
  "motor vinculado": "Motor vinculado",
  motor: "Motor vinculado",
  "runtime retiro": "Runtime retiro",
  notas: "Notas",
};

function mapImportHeaderCell(entity, headerCell) {
  const n = normImportHeader(headerCell);
  if (!n) return null;
  if (entity === "motors") return MOTOR_IMPORT_HEADER_TO_KEY[n] || null;
  if (entity === "technicians") return TECH_IMPORT_HEADER_TO_KEY[n] || null;
  if (entity === "turbinas") return TURBINA_IMPORT_HEADER_TO_KEY[n] || null;
  return null;
}

const IMPORT_MAX_ROWS = 200;

function buildImportRowFromVals(vals, canon, entity) {
  if (!vals.length || vals.every((c) => !c)) return null;

  const obj = {};
  canon.forEach((key, j) => {
    if (!key) return;
    obj[key] = vals[j] || "";
  });

  if (entity === "motors") {
    const code = normImportHeader(obj.Codigo);
    if (code === "codigo") return null;
    if (!(obj.Codigo || "").trim() && !(obj.Marca || "").trim()) return null;
  } else if (entity === "turbinas") {
    const code = normImportHeader(obj.Codigo);
    if (code === "codigo") return null;
    if (!(obj.Codigo || "").trim()) return null;
  } else {
    const name = normImportHeader(obj.Nombre);
    if (name === "nombre") return null;
    if (!(obj.Nombre || "").trim()) return null;
  }

  return obj;
}

function parseExcelSheetForImport(ws, entity) {
  const raw = [];
  ws.eachRow((row) => {
    raw.push(row.values.slice(1).map(excelCellStr));
  });

  let headerIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    const vals = raw[i];
    if (!vals.length || vals.every((c) => !c)) continue;
    const c0 = normImportHeader(vals[0]);
    if (entity === "motors" && c0 === "codigo") { headerIdx = i; break; }
    if (entity === "technicians" && c0 === "nombre") { headerIdx = i; break; }
    if (entity === "turbinas" && c0 === "codigo") { headerIdx = i; break; }
  }

  if (headerIdx < 0) {
    return {
      ok: false,
      message:
        entity === "technicians"
          ? "No se encontro la fila de encabezados (primera columna debe ser «Nombre»). Use la plantilla descargada desde la app."
          : "No se encontro la fila de encabezados (primera columna debe ser «Codigo»). Descargue la plantilla desde la app.",
    };
  }

  const hdrVals = raw[headerIdx];
  const canon = hdrVals.map((h) => mapImportHeaderCell(entity, h));

  if (entity === "motors") {
    if (!canon.includes("Codigo") || !canon.includes("Marca")) {
      return { ok: false, message: "Faltan columnas obligatorias Codigo y Marca en la fila de encabezados." };
    }
  } else if (entity === "turbinas") {
    if (!canon.includes("Codigo")) {
      return { ok: false, message: "Falta la columna obligatoria Codigo en la fila de encabezados." };
    }
  } else if (!canon.includes("Nombre")) {
    return { ok: false, message: "Falta la columna obligatoria Nombre en la fila de encabezados." };
  }

  const displayHeaders = canon.map((c, i) => c || hdrVals[i] || `Col${i + 1}`);
  const rows = [];
  let extraRowsInFile = 0;

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = buildImportRowFromVals(raw[i], canon, entity);
    if (!row) continue;
    if (rows.length < IMPORT_MAX_ROWS) {
      rows.push(row);
    } else {
      extraRowsInFile++;
    }
  }

  const rowLimitReached = extraRowsInFile > 0;
  return {
    ok: true,
    headers: displayHeaders,
    rows,
    rowLimitReached,
    extraRowsInFile,
    importMaxRows: IMPORT_MAX_ROWS,
  };
}

function importMotorsFromRows(db, rows, username, logActivity) {
  let inserted = 0;
  let skipped = 0;
  let statusAdjusted = 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO motors
      (code, brand, model, serial_number, power, voltage, rpm, location, operational_location, status, installed_at, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      const code = r["Codigo"] || r["codigo"] || r["CODIGO"] || r["Code"] || "";
      const brand = r["Marca"] || r["marca"] || r["MARCA"] || r["Brand"] || "";
      if (!code || !brand) {
        skipped++;
        continue;
      }
      const estadoRaw = r["Estado"] || r["estado"] || r["ESTADO"] || "";
      const { status: statusVal, adjusted } = canonicalMotorStatus(estadoRaw);
      if (adjusted) statusAdjusted++;
      const ubicRaw = r["Ubicacion operativa"] || r["Ubicacion"] || r["ubicacion"] || "";
      const info = stmt.run(
        code,
        brand,
        r["Modelo"] || r["modelo"] || "",
        "",
        r["Potencia (kW)"] || r["Potencia"] || r["potencia"] || "",
        r["Voltaje (V)"] || r["Voltaje"] || r["voltaje"] || "",
        r["RPM"] || r["rpm"] || "",
        r["Detalle ubicacion"] || r["Ubicacion detalle"] || "",
        canonicalOperationalLocation(ubicRaw),
        statusVal,
        r["Fecha instalacion"] || r["Fecha instalación"] || r["installed_at"] || null,
        r["Observaciones"] || r["notas"] || "",
        new Date().toISOString()
      );
      if (info.changes > 0) inserted++;
      else skipped++;
    }
  });
  insertMany(rows);
  logActivity(db, username, "IMPORT", "motors", null, `${inserted} motores importados, ${skipped} omitidos`);
  return { ok: true, inserted, skipped, statusAdjusted };
}

function importTechniciansFromRows(db, rows, username, logActivity) {
  let inserted = 0;
  let skipped = 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO technicians (full_name, phone, email, specialty, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      const name = r["Nombre"] || r["nombre"] || r["NOMBRE"] || r["full_name"] || "";
      if (!name) {
        skipped++;
        continue;
      }
      const info = stmt.run(
        name,
        r["Telefono"] || r["telefono"] || r["Phone"] || "",
        r["Email"] || r["email"] || "",
        r["Especialidad"] || r["especialidad"] || r["Specialty"] || "",
        new Date().toISOString()
      );
      if (info.changes > 0) inserted++;
      else skipped++;
    }
  });
  insertMany(rows);
  logActivity(db, username, "IMPORT", "technicians", null, `${inserted} técnicos importados, ${skipped} omitidos`);
  return { ok: true, inserted, skipped };
}

function importTurbinasFromRows(db, rows, username, logActivity) {
  let inserted = 0;
  let skipped = 0;
  let statusAdjusted = 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO turbinas
      (code, serial_number, gg, pt, bearing_1, bearing_2, operational_location, status, runtime_retiro, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items) => {
    for (const r of items) {
      const code = r["Codigo"] || r["codigo"] || r["CODIGO"] || "";
      if (!code) { skipped++; continue; }
      const estadoRaw = r["Estado"] || r["estado"] || "";
      const { status: statusVal, adjusted } = canonicalMotorStatus(estadoRaw);
      if (adjusted) statusAdjusted++;
      const ubicRaw = r["Ubicacion operativa"] || r["Ubicacion"] || r["ubicacion"] || "";
      const info = stmt.run(
        code,
        r["Numero de serie"] || r["No. Serie"] || r["serie"] || "",
        r["GG"] || r["gg"] || "",
        r["PT"] || r["pt"] || "",
        r["Rodamiento 1"] || r["rodamiento_1"] || "",
        r["Rodamiento 2"] || r["rodamiento_2"] || "",
        canonicalOperationalLocation(ubicRaw),
        statusVal,
        r["Runtime retiro"] || r["runtime_retiro"] || "",
        r["Notas"] || r["notas"] || "",
        new Date().toISOString()
      );
      if (info.changes > 0) inserted++;
      else skipped++;
    }
  });
  insertMany(rows);
  logActivity(db, username, "IMPORT", "turbinas", null, `${inserted} turbinas importadas, ${skipped} omitidas`);
  return { ok: true, inserted, skipped, statusAdjusted };
}

module.exports = {
  IMPORT_MAX_ROWS,
  parseExcelSheetForImport,
  importMotorsFromRows,
  importTechniciansFromRows,
  importTurbinasFromRows,
};
