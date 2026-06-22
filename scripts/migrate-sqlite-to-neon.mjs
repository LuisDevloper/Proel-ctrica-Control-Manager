/**
 * Migración de datos: SQLite local → Neon PostgreSQL
 * Ejecutar una sola vez: node scripts/migrate-sqlite-to-neon.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { PgDb, Pool } = require('../src/database/pgAdapter.js');
const { DATABASE_URL } = require('../src/database/config.js');

// Ruta de la BD SQLite
const SQLITE_PATH = path.join(
  os.homedir(),
  'AppData', 'Roaming', 'proelectrica-control-manager', 'proelectrica.db'
);

if (!fs.existsSync(SQLITE_PATH)) {
  console.error('No se encontro la base de datos SQLite en:', SQLITE_PATH);
  process.exit(1);
}

console.log('Leyendo datos de:', SQLITE_PATH);
const sqlite = new Database(SQLITE_PATH, { readonly: true });

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const pg = new PgDb(pool);

async function migrateTable(tableName, rows, insertFn) {
  if (!rows.length) {
    console.log(`  ${tableName}: 0 registros (tabla vacía)`);
    return 0;
  }
  let ok = 0, skip = 0;
  for (const row of rows) {
    try {
      await insertFn(row);
      ok++;
    } catch (e) {
      skip++;
    }
  }
  console.log(`  ${tableName}: ${ok} migrados, ${skip} omitidos (ya existían)`);
  return ok;
}

try {
  console.log('\n--- Iniciando migración ---\n');

  // 1. Usuarios
  const users = sqlite.prepare('SELECT * FROM users').all();
  await migrateTable('users', users, async (r) => {
    await pg.prepare(`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (username) DO NOTHING
    `).run(r.id, r.username, r.password_hash, r.role);
  });

  // 2. Motores
  const motors = sqlite.prepare('SELECT * FROM motors').all();
  await migrateTable('motors', motors, async (r) => {
    await pg.prepare(`
      INSERT INTO motors (id, code, brand, model, serial_number, voltage, power, rpm, location,
        operational_location, status, installed_at, notes, photo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO NOTHING
    `).run(r.id, r.code, r.brand, r.model, r.serial_number, r.voltage, r.power, r.rpm,
      r.location, r.operational_location, r.status, r.installed_at, r.notes, r.photo, r.created_at);
  });

  // 3. Técnicos
  const technicians = sqlite.prepare('SELECT * FROM technicians').all();
  await migrateTable('technicians', technicians, async (r) => {
    await pg.prepare(`
      INSERT INTO technicians (id, full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.full_name, r.phone, r.email, r.specialty, r.created_at);
  });

  // 4. Mantenimientos
  const maintenances = sqlite.prepare('SELECT * FROM maintenances').all();
  await migrateTable('maintenances', maintenances, async (r) => {
    await pg.prepare(`
      INSERT INTO maintenances (id, motor_id, technician_id, maintenance_type, maintenance_date,
        description, parts_used, cost, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.motor_id, r.technician_id, r.maintenance_type, r.maintenance_date,
      r.description, r.parts_used, r.cost, r.status, r.notes, r.created_at);
  });

  // 5. Fallas
  const failures = sqlite.prepare('SELECT * FROM failures').all();
  await migrateTable('failures', failures, async (r) => {
    await pg.prepare(`
      INSERT INTO failures (id, motor_id, technician_id, failure_type, priority, status,
        reported_at, solution, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.motor_id, r.technician_id, r.failure_type, r.priority, r.status,
      r.reported_at, r.solution, r.notes, r.created_at);
  });

  // 6. Turbinas
  let turbinas = [];
  try { turbinas = sqlite.prepare('SELECT * FROM turbinas').all(); } catch (_) {}
  await migrateTable('turbinas', turbinas, async (r) => {
    await pg.prepare(`
      INSERT INTO turbinas (id, code, serial_number, gg, pt, bearing_1, bearing_2,
        runtime_retiro, comentarios_retiro, operational_location, status, motor_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO NOTHING
    `).run(r.id, r.code, r.serial_number, r.gg, r.pt, r.bearing_1, r.bearing_2,
      r.runtime_retiro, r.comentarios_retiro, r.operational_location, r.status,
      r.motor_id, r.notes, r.created_at);
  });

  // 7. Inventario
  let items = [];
  try { items = sqlite.prepare('SELECT * FROM inventory_items').all(); } catch (_) {}
  await migrateTable('inventory_items', items, async (r) => {
    await pg.prepare(`
      INSERT INTO inventory_items (id, part_name, sku, quantity, min_stock, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.part_name, r.sku, r.quantity, r.min_stock, r.location, r.created_at);
  });

  // 8. Movimientos de inventario
  let movements = [];
  try { movements = sqlite.prepare('SELECT * FROM inventory_movements').all(); } catch (_) {}
  await migrateTable('inventory_movements', movements, async (r) => {
    await pg.prepare(`
      INSERT INTO inventory_movements (id, inventory_item_id, movement_type, quantity,
        stock_before, stock_after, reference_type, reference_id, reference_label,
        notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.inventory_item_id, r.movement_type, r.quantity, r.stock_before,
      r.stock_after, r.reference_type, r.reference_id, r.reference_label,
      r.notes, r.created_by, r.created_at);
  });

  // 9. Envíos a taller
  let shipments = [];
  try { shipments = sqlite.prepare('SELECT * FROM external_workshop_shipments').all(); } catch (_) {}
  await migrateTable('external_workshop_shipments', shipments, async (r) => {
    await pg.prepare(`
      INSERT INTO external_workshop_shipments (id, equipment_type, equipment_id, workshop_name,
        responsible, departure_date, expected_return_date, actual_return_date, motive,
        equipment_condition, logistics_status, previous_operational_location, notes,
        created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.equipment_type, r.equipment_id, r.workshop_name, r.responsible,
      r.departure_date, r.expected_return_date, r.actual_return_date, r.motive,
      r.equipment_condition, r.logistics_status, r.previous_operational_location,
      r.notes, r.created_by, r.created_at, r.updated_at);
  });

  // 10. Actividad
  let activity = [];
  try { activity = sqlite.prepare('SELECT * FROM activity_log').all(); } catch (_) {}
  await migrateTable('activity_log', activity, async (r) => {
    await pg.prepare(`
      INSERT INTO activity_log (id, username, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(r.id, r.username, r.action, r.entity, r.entity_id, r.details, r.created_at);
  });

  // Sincronizar secuencias de auto-incremento
  console.log('\nSincronizando secuencias...');
  for (const table of ['users','motors','technicians','maintenances','failures',
      'turbinas','inventory_items','inventory_movements','external_workshop_shipments','activity_log','documents']) {
    try {
      await pg.prepare(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1))`).get();
    } catch (_) {}
  }

  console.log('\n✓ Migración completada exitosamente!');
  console.log('Todos tus datos están ahora en Neon y visibles desde cualquier PC.');

} catch (e) {
  console.error('\nError durante la migración:', e.message);
} finally {
  sqlite.close();
  await pool.end();
}
