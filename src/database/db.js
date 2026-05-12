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

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      created_at TEXT NOT NULL
    );
  `);

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

async function saveDatabase() {
  return;
}

function getDatabase() {
  if (!db) {
    throw new Error("Base de datos no inicializada.");
  }
  return db;
}

module.exports = {
  initializeDatabase,
  saveDatabase,
  getDatabase
};
