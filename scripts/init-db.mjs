/**
 * Script para inicializar las tablas en Neon (PostgreSQL).
 * Ejecutar una vez antes de usar la app: node scripts/init-db.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { PgDb, Pool } = require('../src/database/pgAdapter.js');
const { DATABASE_URL } = require('../src/database/config.js');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const db = new PgDb(pool);

console.log('Inicializando tablas en Neon...');

try {
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
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
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
  console.log('✓ Tablas creadas (o ya existian)');

  // Seed admin user
  const result = await db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (Number(result.total) === 0) {
    const hash = await bcrypt.hash('Pro.2026', 10);
    await db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run('Proelectrica', hash, 'ADMIN');
    console.log('✓ Usuario admin creado (Proelectrica / Pro.2026)');
  } else {
    console.log(`✓ Usuarios existentes: ${result.total}`);
  }

  // Mostrar resumen de tablas
  const tables = await db.prepare(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `).all();
  console.log('\nTablas en la base de datos:');
  for (const t of tables) console.log(' -', t.table_name);

  console.log('\n✓ Base de datos lista para usar!');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
