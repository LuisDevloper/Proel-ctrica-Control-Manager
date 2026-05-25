const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { app } = require("electron");
const Database = require("better-sqlite3");
const { logInfo, logError } = require("../services/logger");

let db = null;
let dbPath = "";

async function initializeDatabase() {
  const dataDir = app.getPath("userData");
  dbPath = path.join(dataDir, "proelectrica.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS motors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      voltage TEXT,
      power TEXT,
      rpm TEXT,
      location TEXT,
      operational_location TEXT NOT NULL DEFAULT 'En planta',
      status TEXT,
      installed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      specialty TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      motor_id INTEGER NOT NULL,
      technician_id INTEGER,
      maintenance_type TEXT NOT NULL,
      maintenance_date TEXT NOT NULL,
      description TEXT,
      parts_used TEXT,
      cost REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (motor_id) REFERENCES motors(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      motor_id INTEGER NOT NULL,
      technician_id INTEGER,
      failure_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      reported_at TEXT NOT NULL,
      solution TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (motor_id) REFERENCES motors(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL,
      action     TEXT NOT NULL,
      entity     TEXT NOT NULL,
      entity_id  INTEGER,
      details    TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      stock_before INTEGER NOT NULL,
      stock_after INTEGER NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      reference_label TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_movements(inventory_item_id);
    CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(created_at);

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS turbinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      gg TEXT,
      pt TEXT,
      bearing_1 TEXT,
      bearing_2 TEXT,
      runtime_retiro TEXT,
      comentarios_retiro TEXT,
      operational_location TEXT NOT NULL DEFAULT 'En planta',
      status TEXT NOT NULL DEFAULT 'Operativo',
      motor_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (motor_id) REFERENCES motors(id)
    );

    CREATE TABLE IF NOT EXISTS external_workshop_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_type TEXT NOT NULL,
      equipment_id INTEGER NOT NULL,
      workshop_name TEXT NOT NULL,
      responsible TEXT,
      departure_date TEXT NOT NULL,
      expected_return_date TEXT,
      actual_return_date TEXT,
      motive TEXT,
      equipment_condition TEXT,
      logistics_status TEXT NOT NULL DEFAULT 'Permiso de salida aprobado',
      previous_operational_location TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shipments_equipment ON external_workshop_shipments(equipment_type, equipment_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON external_workshop_shipments(logistics_status);
  `);

  runMigrations();
  await seedAdminUser();
  logInfo("database.init", { dbPath });
}

async function seedAdminUser() {
  const result = db.prepare("SELECT COUNT(*) AS total FROM users").get();
  const total = result.total;

  if (total === 0) {
    // Nueva instalación — crear usuario con las credenciales actuales
    const defaultPasswordHash = await bcrypt.hash("Pro.2026", 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(
      "Proelectrica",
      defaultPasswordHash,
      "ADMIN"
    );
    logInfo("database.seed_admin_created");
  } else {
    // Migración: si aún existe el usuario "admin" con credenciales antiguas, actualizarlo
    const oldAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (oldAdmin) {
      const newHash = await bcrypt.hash("Pro.2026", 10);
      db.prepare("UPDATE users SET username = 'Proelectrica', password_hash = ? WHERE username = 'admin'").run(newHash);
      logInfo("database.admin_migrated");
    }
  }
}

function runMigrations() {
  const mtnCols = db.prepare("PRAGMA table_info(maintenances)").all().map(c => c.name);
  if (!mtnCols.includes("status")) {
    db.exec("ALTER TABLE maintenances ADD COLUMN status TEXT NOT NULL DEFAULT 'Pendiente'");
    logInfo("database.migration_maintenances_status");
  }
  const motorCols = db.prepare("PRAGMA table_info(motors)").all().map(c => c.name);
  if (!motorCols.includes("photo")) {
    db.exec("ALTER TABLE motors ADD COLUMN photo TEXT");
    logInfo("database.migration_motors_photo");
  }
  if (!motorCols.includes("operational_location")) {
    db.exec("ALTER TABLE motors ADD COLUMN operational_location TEXT NOT NULL DEFAULT 'En planta'");
    db.exec("UPDATE motors SET operational_location = 'En planta' WHERE operational_location IS NULL OR operational_location = ''");
    logInfo("database.migration_motors_operational_location");
  }
  const shipmentCols = db.prepare("PRAGMA table_info(external_workshop_shipments)").all().map(c => c.name);
  if (!shipmentCols.includes("previous_operational_location")) {
    db.exec("ALTER TABLE external_workshop_shipments ADD COLUMN previous_operational_location TEXT");
    logInfo("database.migration_shipments_previous_location");
  }
}

async function saveDatabase() {
  return;
}

function getDatabase() {
  if (!db) {
    throw new Error("Base de datos no inicializada.");
  }
  return db;
}

/** Elimina -wal / -shm junto al .db para evitar estado incoherente tras reemplazar el archivo. */
function removeDatabaseSidecars(filePath) {
  for (const ext of ["-wal", "-shm"]) {
    const p = filePath + ext;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      logError("database.sidecar_remove_failed", err, { path: p });
    }
  }
}

/** Cierra la conexión y limpia sidecars antes de sobrescribir el archivo de BD. */
function closeDatabaseForFileReplace() {
  if (db) {
    try {
      db.close();
    } catch (err) {
      logError("database.close_failed", err);
      throw err;
    }
    db = null;
  }
  if (dbPath) removeDatabaseSidecars(dbPath);
}

function reopenDatabase() {
  if (db) return;
  if (!dbPath) throw new Error("Base de datos no inicializada.");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  logInfo("database.reopened", { dbPath });
}

module.exports = {
  initializeDatabase,
  saveDatabase,
  getDatabase,
  closeDatabaseForFileReplace,
  reopenDatabase
};
