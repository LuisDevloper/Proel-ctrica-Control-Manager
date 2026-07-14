const bcrypt = require("bcryptjs");
const { PgDb, Pool } = require("./pgAdapter");
const { DATABASE_URL } = require("./config");
const { logInfo, logError } = require("../services/logger");

let db = null;

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  db = new PgDb(pool);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS motors (
      id SERIAL PRIMARY KEY,
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
      photo TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      specialty TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenances (
      id SERIAL PRIMARY KEY,
      motor_id INTEGER NOT NULL,
      technician_id INTEGER,
      maintenance_type TEXT NOT NULL,
      maintenance_date TEXT NOT NULL,
      description TEXT,
      parts_used TEXT,
      cost NUMERIC DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (motor_id) REFERENCES motors(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS failures (
      id SERIAL PRIMARY KEY,
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
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      action     TEXT NOT NULL,
      entity     TEXT NOT NULL,
      entity_id  INTEGER,
      details    TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      part_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id SERIAL PRIMARY KEY,
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

    CREATE INDEX IF NOT EXISTS idx_failures_reported_at  ON failures(reported_at);
    CREATE INDEX IF NOT EXISTS idx_failures_motor_id     ON failures(motor_id);
    CREATE INDEX IF NOT EXISTS idx_maintenances_date     ON maintenances(maintenance_date);
    CREATE INDEX IF NOT EXISTS idx_maintenances_motor_id ON maintenances(motor_id);

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      serial_number TEXT,
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
      id SERIAL PRIMARY KEY,
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

  // Migración: agregar columna de datos binarios a documentos (idempotente)
  await db.exec(`
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;
  `);

  await seedAdminUser();
  logInfo("database.init", { host: "neon.tech (PostgreSQL)" });
}

async function seedAdminUser() {
  const result = await db.prepare("SELECT COUNT(*) AS total FROM users").get();
  const total = Number(result.total);

  if (total === 0) {
    const defaultPasswordHash = await bcrypt.hash("Pro.2026", 10);
    await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(
      "Proelectrica",
      defaultPasswordHash,
      "ADMIN"
    );
    logInfo("database.seed_admin_created");
  } else {
    const oldAdmin = await db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (oldAdmin) {
      const newHash = await bcrypt.hash("Pro.2026", 10);
      await db.prepare("UPDATE users SET username = 'Proelectrica', password_hash = ? WHERE username = 'admin'").run(newHash);
      logInfo("database.admin_migrated");
    }
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

/** No-op: no aplica con PostgreSQL (sin archivos locales). */
function closeDatabaseForFileReplace() {}

/** No-op: no aplica con PostgreSQL. */
function reopenDatabase() {}

module.exports = {
  initializeDatabase,
  saveDatabase,
  getDatabase,
  closeDatabaseForFileReplace,
  reopenDatabase,
};
