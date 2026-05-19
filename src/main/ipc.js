const { ipcMain, dialog, app, BrowserWindow } = require("electron");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { getDatabase, closeDatabaseForFileReplace, reopenDatabase } = require("../database/db");
const { logInfo, logError } = require("../services/logger");

/** Sesión tras login (main process). Sin esto, las IPC de escritura fallan. */
let authSession = null;

function denyIfNotAuthenticated() {
  if (!authSession) return { ok: false, message: "Sesion no iniciada. Inicia sesion de nuevo." };
  return null;
}

function denyIfVisor() {
  const a = denyIfNotAuthenticated();
  if (a) return a;
  if (authSession.role === "VISOR") return { ok: false, message: "Tu rol solo permite consultar datos." };
  return null;
}

function denyIfNotAdmin() {
  const a = denyIfNotAuthenticated();
  if (a) return a;
  if (authSession.role !== "ADMIN") return { ok: false, message: "Solo un administrador puede realizar esta accion." };
  return null;
}

// Registra una entrada en el log de actividad
function logActivity(db, username, action, entity, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO activity_log (username, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username || "sistema", action, entity, entityId || null, details || null, new Date().toISOString());
  } catch (err) {
    logError("activity_log.insert_failed", err, { action, entity, entityId: entityId ?? null });
  }
}

/** Estados permitidos para motores (misma lista que en la UI React). */
const MOTOR_ALLOWED_STATUSES = ["Operativo", "En mantenimiento", "Fuera de servicio"];

function normMotorStatusStr(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Convierte el texto de Excel/formulario a un estado válido; si no coincide, Operativo y adjusted true (solo si había texto inválido). */
function canonicalMotorStatus(raw) {
  const rawStr = String(raw ?? "").trim();
  if (!rawStr) return { status: "Operativo", adjusted: false };
  const n = normMotorStatusStr(rawStr);
  for (const allowed of MOTOR_ALLOWED_STATUSES) {
    if (normMotorStatusStr(allowed) === n) return { status: allowed, adjusted: false };
  }
  return { status: "Operativo", adjusted: true };
}

/** Día de calendario de una celda con fecha de Excel/ExcelJS → YYYY-MM-DD.
 *  ExcelJS suele devolver medianoche UTC del día guardado en la hoja; si aquí se usan
 *  getDate()/getFullYear() locales, en zonas UTC− se muestra el día anterior (p. ej. 15 → 14). */
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

/** Valor de celda Excel como string. */
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
  "n serie": "N° Serie",
  "n° serie": "N° Serie",
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

function mapImportHeaderCell(entity, headerCell) {
  const n = normImportHeader(headerCell);
  if (!n) return null;
  if (entity === "motors") return MOTOR_IMPORT_HEADER_TO_KEY[n] || null;
  if (entity === "technicians") return TECH_IMPORT_HEADER_TO_KEY[n] || null;
  return null;
}

/** Máximo de filas de datos que se leen por archivo Excel (importación). */
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
  } else {
    const name = normImportHeader(obj.Nombre);
    if (name === "nombre") return null;
    if (!(obj.Nombre || "").trim()) return null;
  }

  return obj;
}

/**
 * Lee la primera hoja: localiza la fila cuya primera columna es Codigo/Nombre (plantilla con título arriba).
 * Devuelve headers para vista previa y filas con claves canónicas (Codigo, Marca, …).
 */
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
    if (entity === "motors" && c0 === "codigo") {
      headerIdx = i;
      break;
    }
    if (entity === "technicians" && c0 === "nombre") {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    return {
      ok: false,
      message:
        entity === "motors"
          ? "No se encontro la fila de encabezados (primera columna debe ser «Codigo»). Descargue la plantilla desde la app: los titulos van en las filas superiores, los encabezados en la fila correcta."
          : "No se encontro la fila de encabezados (primera columna debe ser «Nombre»). Use la plantilla descargada desde la app.",
    };
  }

  const hdrVals = raw[headerIdx];
  const canon = hdrVals.map((h) => mapImportHeaderCell(entity, h));

  if (entity === "motors") {
    if (!canon.includes("Codigo") || !canon.includes("Marca")) {
      return { ok: false, message: "Faltan columnas obligatorias Codigo y Marca en la fila de encabezados." };
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

/** Primer y último día del mes (month 1–12) en ISO YYYY-MM-DD para filtros SQLite. */
function calendarMonthIsoRange(year, month) {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  const now = new Date();
  const yy = Number.isFinite(y) && y > 0 ? y : now.getFullYear();
  const mm = Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const to = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function registerIpcHandlers() {
  // Notificaciones de alertas
  ipcMain.handle("notifications:list", () => {
    const db = getDatabase();
    const upcoming = db.prepare(`
      SELECT 'maintenance' as type, 'Mantenimiento proximo' as title,
        mo.code || ' — ' || m.maintenance_type as body,
        m.maintenance_date as date, m.id
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      WHERE m.maintenance_date BETWEEN date('now') AND date('now', '+7 day')
        AND m.status != 'Completado'
      ORDER BY m.maintenance_date
    `).all();
    const failures = db.prepare(`
      SELECT 'failure' as type, 'Falla pendiente' as title,
        mo.code || ' — ' || f.failure_type as body,
        f.reported_at as date, f.id
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      WHERE f.status != 'Resuelta'
      ORDER BY CASE f.priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END
    `).all();
    const lowStock = db.prepare(`
      SELECT 'stock' as type, 'Stock minimo' as title,
        part_name || ' (' || quantity || ' uds)' as body,
        created_at as date, id
      FROM inventory_items WHERE quantity <= min_stock
    `).all();
    return [...upcoming, ...failures, ...lowStock];
  });

  // Datos para graficas del dashboard
  ipcMain.handle("dashboard:charts", () => {
    const db = getDatabase();

    const motorsByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM motors GROUP BY status
    `).all();

    const maintenancesByMonth = db.prepare(`
      SELECT strftime('%Y-%m', maintenance_date) as month, COUNT(*) as count
      FROM maintenances
      WHERE maintenance_date >= date('now', '-12 months')
      GROUP BY month ORDER BY month
    `).all();

    const failuresByMonth = db.prepare(`
      SELECT strftime('%Y-%m', reported_at) as month, COUNT(*) as count
      FROM failures
      WHERE reported_at >= date('now', '-12 months')
      GROUP BY month ORDER BY month
    `).all();

    const costByMotor = db.prepare(`
      SELECT mo.code AS motor, SUM(m.cost) AS total
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      GROUP BY mo.id
      ORDER BY total DESC
      LIMIT 10
    `).all();

    return { motorsByStatus, maintenancesByMonth, failuresByMonth, costByMotor };
  });

  // Detalle completo de un motor
  ipcMain.handle("motors:detail", (_event, id) => {
    const db = getDatabase();
    const motor = db.prepare("SELECT * FROM motors WHERE id = ?").get(Number(id));
    const maintenances = db.prepare(`
      SELECT m.*, t.full_name as technician_name
      FROM maintenances m
      LEFT JOIN technicians t ON t.id = m.technician_id
      WHERE m.motor_id = ? ORDER BY m.maintenance_date DESC
    `).all(Number(id));
    const failures = db.prepare(`
      SELECT f.*, t.full_name as technician_name
      FROM failures f
      LEFT JOIN technicians t ON t.id = f.technician_id
      WHERE f.motor_id = ? ORDER BY f.reported_at DESC
    `).all(Number(id));
    return { motor, maintenances, failures };
  });

  // Mantenimientos del mes para el calendario
  ipcMain.handle("maintenances:calendar", (_event, { year, month }) => {
    const db = getDatabase();
    const { from, to } = calendarMonthIsoRange(year, month);
    return db.prepare(`
      SELECT m.*, mo.code as motor_code, t.full_name as technician_name
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      LEFT JOIN technicians t ON t.id = m.technician_id
      WHERE m.maintenance_date BETWEEN ? AND ?
      ORDER BY m.maintenance_date
    `).all(from, to);
  });

  ipcMain.handle("window:toggleFullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return { ok: true, fullScreen: next };
  });

  ipcMain.handle("window:isFullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return { ok: !!win, fullScreen: win ? win.isFullScreen() : false };
  });

  // Ping de base de datos
  ipcMain.handle("db:ping", () => {
    try {
      const db = getDatabase();
      db.prepare("SELECT 1").get();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Info de la app (datos utiles para el usuario final, sin versiones de motor Electron/Node)
  ipcMain.handle("app:info", () => {
    let productName = app.getName();
    try {
      const pkgPath = path.join(__dirname, "../../package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.build && typeof pkg.build.productName === "string" && pkg.build.productName.trim()) {
        productName = pkg.build.productName.trim();
      }
    } catch (_) {
      /* nombre por defecto de app.getName() */
    }

    const plat = process.platform;
    const osName =
      plat === "win32" ? "Windows" :
      plat === "darwin" ? "macOS" :
      plat === "linux" ? "Linux" :
      plat;

    let archLabel = process.arch;
    if (process.arch === "x64") archLabel = "64 bits (x64)";
    else if (process.arch === "arm64") archLabel = "64 bits (ARM)";

    return {
      productName,
      version: app.getVersion(),
      osName,
      arch: archLabel,
      packaged: app.isPackaged,
      userDataPath: app.getPath("userData"),
    };
  });

  // Cambiar contrasena
  ipcMain.handle("auth:changePassword", async (_event, { userId, currentPassword, newPassword }) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    if (Number(userId) !== Number(authSession.id)) {
      return { ok: false, message: "No puedes cambiar la contrasena de otro usuario desde aqui." };
    }
    const db = getDatabase();
    const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
    if (!user) return { ok: false, message: "Usuario no encontrado." };
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return { ok: false, message: "La contrasena actual es incorrecta." };
    const newHash = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, userId);
    return { ok: true };
  });

  ipcMain.handle("auth:logout", () => {
    authSession = null;
    return { ok: true };
  });

  ipcMain.handle("auth:login", async (_event, credentials) => {
    const db = getDatabase();
    const user = db.prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?").get(credentials.username);

    if (!user) {
      return { ok: false, message: "Usuario no encontrado." };
    }

    const validPassword = await bcrypt.compare(credentials.password, user.password_hash);
    if (!validPassword) {
      return { ok: false, message: "Credenciales inválidas." };
    }

    authSession = { id: user.id, username: user.username, role: user.role };

    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  });

  ipcMain.handle("dashboard:stats", () => {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM motors) AS totalMotors,
        (SELECT COUNT(*) FROM motors WHERE status = 'En mantenimiento') AS inMaintenance,
        (SELECT COUNT(*) FROM motors WHERE status = 'Fuera de servicio') AS outOfService,
        (SELECT COUNT(*) FROM maintenances) AS totalMaintenances,
        (SELECT COUNT(*) FROM failures WHERE status <> 'Resuelta') AS pendingFailures,
        (SELECT COUNT(*) FROM technicians) AS totalTechnicians,
        (SELECT COUNT(*) FROM inventory_items WHERE quantity <= min_stock) AS lowStockItems,
        (SELECT COUNT(*) FROM maintenances WHERE maintenance_date >= date('now') AND maintenance_date <= date('now', '+7 day') AND status != 'Completado') AS upcomingMaintenances
    `).get();
  });

  ipcMain.handle("motors:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM motors ORDER BY id DESC").all();
  });

  ipcMain.handle("motors:create", async (_event, motor) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO motors (
        code, brand, model, serial_number, voltage, power, rpm, location, status, installed_at, notes, photo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      motor.code,
      motor.brand,
      motor.model || "",
      motor.serial_number || "",
      motor.voltage || null,
      motor.power || null,
      motor.rpm || null,
      motor.location || "",
      canonicalMotorStatus(motor.status).status,
      motor.installed_at || null,
      motor.notes || "",
      motor.photo || null,
      new Date().toISOString()
    );
    logInfo("motors.create", { code: motor.code });
    const newRow = db.prepare("SELECT id FROM motors WHERE code = ? ORDER BY id DESC LIMIT 1").get(motor.code);
    logActivity(db, motor._username, "CREATE", "motors", newRow?.id, `Motor ${motor.code} — ${motor.brand}`);
    return { ok: true };
  });

  ipcMain.handle("motors:update", async (_event, motor) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      UPDATE motors
      SET code = ?, brand = ?, model = ?, serial_number = ?, power = ?, voltage = ?, rpm = ?,
          location = ?, status = ?, installed_at = ?, notes = ?, photo = ?
      WHERE id = ?
    `).run(
      motor.code,
      motor.brand,
      motor.model || "",
      motor.serial_number || "",
      motor.power || null,
      motor.voltage || null,
      motor.rpm || null,
      motor.location || "",
      canonicalMotorStatus(motor.status).status,
      motor.installed_at || null,
      motor.notes || "",
      motor.photo !== undefined ? motor.photo : null,
      Number(motor.id)
    );
    logActivity(db, motor._username, "UPDATE", "motors", motor.id, `Motor ${motor.code} — ${motor.brand}`);
    return { ok: true };
  });

  ipcMain.handle("motors:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT code, brand FROM motors WHERE id = ?").get(Number(id));
    db.prepare("DELETE FROM motors WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "motors", id, row ? `Motor ${row.code} — ${row.brand}` : "");
    return { ok: true };
  });

  ipcMain.handle("technicians:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM technicians ORDER BY id DESC").all();
  });

  ipcMain.handle("technicians:create", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO technicians (full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", new Date().toISOString());
    const newTech = db.prepare("SELECT id FROM technicians WHERE full_name = ? ORDER BY id DESC LIMIT 1").get(technician.fullName);
    logActivity(db, technician._username, "CREATE", "technicians", newTech?.id, technician.fullName);
    return { ok: true };
  });

  ipcMain.handle("technicians:update", async (_event, technician) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      UPDATE technicians
      SET full_name = ?, phone = ?, email = ?, specialty = ?
      WHERE id = ?
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", Number(technician.id));
    logActivity(db, technician._username, "UPDATE", "technicians", technician.id, technician.fullName);
    return { ok: true };
  });

  ipcMain.handle("technicians:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT full_name FROM technicians WHERE id = ?").get(Number(id));
    db.prepare("DELETE FROM technicians WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "technicians", id, row?.full_name || "");
    return { ok: true };
  });

  ipcMain.handle("maintenances:list", () => {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        m.id,
        m.maintenance_type,
        m.maintenance_date,
        m.description,
        m.cost,
        m.status,
        mo.code AS motor_code,
        t.full_name AS technician_name
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      LEFT JOIN technicians t ON t.id = m.technician_id
      ORDER BY m.id DESC
    `).all();
  });

  ipcMain.handle("maintenances:create", async (_event, maintenance) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO maintenances (
        motor_id, technician_id, maintenance_type, maintenance_date, description, parts_used, cost, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(maintenance.motorId),
      maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance.maintenanceType,
      maintenance.maintenanceDate,
      maintenance.description || "",
      maintenance.partsUsed || "",
      Number(maintenance.cost || 0),
      maintenance.status || "Pendiente",
      maintenance.notes || "",
      new Date().toISOString()
    );
    const newMtn = db.prepare("SELECT id FROM maintenances ORDER BY id DESC LIMIT 1").get();
    logActivity(db, maintenance._username, "CREATE", "maintenances", newMtn?.id, `${maintenance.maintenanceType} — Motor #${maintenance.motorId}`);
    return { ok: true };
  });

  ipcMain.handle("maintenances:update", async (_event, maintenance) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      UPDATE maintenances
      SET motor_id = ?, technician_id = ?, maintenance_type = ?, maintenance_date = ?, description = ?, cost = ?, status = ?
      WHERE id = ?
    `).run(
      Number(maintenance.motorId),
      maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance.maintenanceType,
      maintenance.maintenanceDate,
      maintenance.description || "",
      Number(maintenance.cost || 0),
      maintenance.status || "Pendiente",
      Number(maintenance.id)
    );
    logActivity(db, maintenance._username, "UPDATE", "maintenances", maintenance.id, `${maintenance.maintenanceType} — estado: ${maintenance.status}`);
    return { ok: true };
  });

  ipcMain.handle("maintenances:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare("DELETE FROM maintenances WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "maintenances", id, "");
    return { ok: true };
  });

  ipcMain.handle("failures:list", () => {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        f.id,
        f.failure_type,
        f.priority,
        f.status,
        f.reported_at,
        f.solution,
        f.notes,
        mo.code AS motor_code,
        t.full_name AS technician_name
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      LEFT JOIN technicians t ON t.id = f.technician_id
      ORDER BY f.id DESC
    `).all();
  });

  ipcMain.handle("failures:create", async (_event, failure) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO failures (
        motor_id, technician_id, failure_type, priority, status, reported_at, solution, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(failure.motorId),
      failure.technicianId ? Number(failure.technicianId) : null,
      failure.failureType,
      failure.priority,
      failure.status,
      failure.reportedAt,
      failure.solution || "",
      failure.notes || "",
      new Date().toISOString()
    );
    const newFail = db.prepare("SELECT id FROM failures ORDER BY id DESC LIMIT 1").get();
    logActivity(db, failure._username, "CREATE", "failures", newFail?.id, `${failure.failureType} — Motor #${failure.motorId}`);
    return { ok: true };
  });

  ipcMain.handle("failures:update", async (_event, failure) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      UPDATE failures
      SET motor_id = ?, technician_id = ?, failure_type = ?, priority = ?, status = ?, reported_at = ?, solution = ?
      WHERE id = ?
    `).run(
      Number(failure.motorId),
      failure.technicianId ? Number(failure.technicianId) : null,
      failure.failureType,
      failure.priority,
      failure.status,
      failure.reportedAt,
      failure.solution || "",
      Number(failure.id)
    );
    logActivity(db, failure._username, "UPDATE", "failures", failure.id, `${failure.failureType} — estado: ${failure.status}`);
    return { ok: true };
  });

  ipcMain.handle("failures:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare("DELETE FROM failures WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "failures", id, "");
    return { ok: true };
  });

  ipcMain.handle("inventory:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM inventory_items ORDER BY id DESC").all();
  });

  ipcMain.handle("inventory:create", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      INSERT INTO inventory_items (part_name, sku, quantity, min_stock, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.partName, item.sku || "", Number(item.quantity || 0), Number(item.minStock || 0), item.location || "", new Date().toISOString());
    return { ok: true };
  });

  ipcMain.handle("inventory:update", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare(`
      UPDATE inventory_items
      SET part_name = ?, sku = ?, quantity = ?, min_stock = ?, location = ?
      WHERE id = ?
    `).run(item.partName, item.sku || "", Number(item.quantity || 0), Number(item.minStock || 0), item.location || "", Number(item.id));
    return { ok: true };
  });

  ipcMain.handle("inventory:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare("DELETE FROM inventory_items WHERE id = ?").run(Number(id));
    return { ok: true };
  });

  // ── Importar desde Excel ──────────────────────────────────────
  ipcMain.handle("import:parse-excel", async (_event, { entity }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: `Seleccionar archivo Excel de ${entity}`,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
      properties: ["openFile"]
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

  ipcMain.handle("import:save-motors", async (_event, { rows, username }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    let inserted = 0, skipped = 0, statusAdjusted = 0;
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO motors
        (code, brand, model, serial_number, power, voltage, rpm, location, status, installed_at, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((items) => {
      for (const r of items) {
        const code = r["Codigo"] || r["codigo"] || r["CODIGO"] || r["Code"] || "";
        const brand = r["Marca"] || r["marca"] || r["MARCA"] || r["Brand"] || "";
        if (!code || !brand) { skipped++; continue; }
        const estadoRaw = r["Estado"] || r["estado"] || r["ESTADO"] || "";
        const { status: statusVal, adjusted } = canonicalMotorStatus(estadoRaw);
        if (adjusted) statusAdjusted++;
        const info = stmt.run(
          code, brand,
          r["Modelo"] || r["modelo"] || "",
          r["N° Serie"] || r["Serie"] || r["serie"] || "",
          r["Potencia (kW)"] || r["Potencia"] || r["potencia"] || "",
          r["Voltaje (V)"] || r["Voltaje"] || r["voltaje"] || "",
          r["RPM"] || r["rpm"] || "",
          r["Ubicacion"] || r["ubicacion"] || "",
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
  });

  ipcMain.handle("import:save-technicians", async (_event, { rows, username }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    let inserted = 0, skipped = 0;
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO technicians (full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((items) => {
      for (const r of items) {
        const name = r["Nombre"] || r["nombre"] || r["NOMBRE"] || r["full_name"] || "";
        if (!name) { skipped++; continue; }
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
  });

  // ── Registro de actividad ─────────────────────────────────────
  ipcMain.handle("activity:list", (_event, { limit = 100 } = {}) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  });

  ipcMain.handle("activity:log", (_event, { username, action, entity, entityId, details }) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    logActivity(db, username, action, entity, entityId, details);
    return { ok: true };
  });

  // ── Backup / Restore ──────────────────────────────────────────
  ipcMain.handle("db:backup", async (_event) => {
    const denied = denyIfNotAuthenticated();
    if (denied) return denied;
    const dbPath = path.join(app.getPath("userData"), "proelectrica.db");
    const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar copia de seguridad",
      defaultPath: `proelectrica-backup-${now}.db`,
      filters: [{ name: "Base de datos SQLite", extensions: ["db"] }]
    });
    if (canceled || !filePath) return { ok: false, message: "Cancelado" };
    fs.copyFileSync(dbPath, filePath);
    logInfo("db.backup", { dest: filePath });
    return { ok: true };
  });

  ipcMain.handle("db:restore", async (_event) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const dbPath = path.join(app.getPath("userData"), "proelectrica.db");
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: "Seleccionar copia de seguridad",
      filters: [{ name: "Base de datos SQLite", extensions: ["db"] }],
      properties: ["openFile"]
    });
    if (canceled || !filePaths?.length) return { ok: false, message: "Cancelado" };

    const autoBackup = dbPath + ".before-restore";
    closeDatabaseForFileReplace();
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, autoBackup);
      }
      fs.copyFileSync(filePaths[0], dbPath);
      logInfo("db.restore", { src: filePaths[0] });
      return { ok: true, message: "Base de datos restaurada. Reinicia la aplicacion si ves comportamientos extranos." };
    } catch (err) {
      logError("db.restore_failed", err);
      return { ok: false, message: err?.message || "No se pudo restaurar la base de datos." };
    } finally {
      try {
        reopenDatabase();
      } catch (err) {
        logError("db.reopen_after_restore_failed", err);
      }
    }
  });

  // ── Gestión de usuarios ───────────────────────────────────────
  ipcMain.handle("users:list", () => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    return db.prepare("SELECT id, username, role FROM users ORDER BY id ASC").all();
  });

  ipcMain.handle("users:create", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(data.username);
    if (exists) return { ok: false, message: "El nombre de usuario ya existe." };
    const hash = await bcrypt.hash(data.password, 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(data.username, hash, data.role || "OPERADOR");
    logInfo("users.create", { username: data.username });
    return { ok: true };
  });

  ipcMain.handle("users:update-role", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(data.role, Number(data.id));
    return { ok: true };
  });

  ipcMain.handle("users:reset-password", async (_event, data) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    const hash = await bcrypt.hash(data.password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, Number(data.id));
    return { ok: true };
  });

  ipcMain.handle("users:delete", async (_event, id) => {
    const denied = denyIfNotAdmin();
    if (denied) return denied;
    const db = getDatabase();
    const admins = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'ADMIN'").get();
    const target = db.prepare("SELECT role FROM users WHERE id = ?").get(Number(id));
    if (target?.role === "ADMIN" && admins.c <= 1) return { ok: false, message: "No puedes eliminar el ultimo administrador." };
    db.prepare("DELETE FROM users WHERE id = ?").run(Number(id));
    return { ok: true };
  });
}

module.exports = {
  registerIpcHandlers
};
