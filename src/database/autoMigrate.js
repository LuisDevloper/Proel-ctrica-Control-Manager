/**
 * Migración automática de SQLite local → Neon PostgreSQL.
 *
 * Se ejecuta UNA sola vez por PC al iniciar la app si existe proelectrica.db.
 * Al terminar marca el flag "sqlite_migrated_to_neon" en electron-store
 * para no volver a ejecutarse nunca más.
 */

const path = require("path");
const fs   = require("fs");
const { logInfo, logError } = require("../services/logger");

const MIGRATION_FLAG = "sqlite_migrated_to_neon";

/**
 * @param {Electron.App}  app   - instancia de app de Electron
 * @param {ElectronStore} store - cualquier electron-store para persistir el flag
 * @param {PgDb}          pg    - instancia de PgDb (ya inicializada)
 * @returns {Promise<{skipped?:boolean, ok?:boolean, stats?:object, error?:string}>}
 */
async function autoMigrateIfNeeded(app, store, pg) {
  if (store.get(MIGRATION_FLAG)) {
    return { skipped: true };
  }

  const dbPath = path.join(app.getPath("userData"), "proelectrica.db");

  if (!fs.existsSync(dbPath)) {
    store.set(MIGRATION_FLAG, true);
    return { skipped: true };
  }

  logInfo("auto_migrate.start", { dbPath });

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch (e) {
    logError("auto_migrate.better_sqlite3_unavailable", e);
    store.set(MIGRATION_FLAG, true);
    return { skipped: true, reason: "better-sqlite3 no disponible" };
  }

  let sqlite;
  try {
    sqlite = new Database(dbPath, { readonly: true });
  } catch (e) {
    logError("auto_migrate.open_sqlite_failed", e);
    store.set(MIGRATION_FLAG, true);
    return { skipped: true, reason: "no se pudo abrir SQLite" };
  }

  const stats = {};

  /** Lee todos los registros de una tabla SQLite (silencia error si no existe). */
  function getRows(table) {
    try {
      return sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch (_) {
      return [];
    }
  }

  /** Inserta un registro ignorando conflictos por PK. */
  async function tryInsert(sql, params) {
    try {
      await pg.prepare(sql).run(...params);
      return true;
    } catch (_) {
      return false;
    }
  }

  try {
    // ── users ────────────────────────────────────────────────────────────────
    const users = getRows("users");
    let ok = 0;
    for (const r of users) {
      if (await tryInsert(
        `INSERT INTO users (id, username, password_hash, role)
         VALUES (?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id, r.username, r.password_hash, r.role]
      )) ok++;
    }
    stats.users = ok;

    // ── motors ───────────────────────────────────────────────────────────────
    const motors = getRows("motors");
    ok = 0;
    for (const r of motors) {
      if (await tryInsert(
        `INSERT INTO motors
           (id,code,brand,model,serial_number,voltage,power,rpm,
            location,operational_location,status,installed_at,notes,photo,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (code) DO NOTHING`,
        [r.id,r.code,r.brand,r.model,r.serial_number,r.voltage,r.power,r.rpm,
         r.location,r.operational_location,r.status,r.installed_at,r.notes,r.photo,r.created_at]
      )) ok++;
    }
    stats.motors = ok;

    // ── technicians ──────────────────────────────────────────────────────────
    const techs = getRows("technicians");
    ok = 0;
    for (const r of techs) {
      if (await tryInsert(
        `INSERT INTO technicians (id,full_name,phone,email,specialty,created_at)
         VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.full_name,r.phone,r.email,r.specialty,r.created_at]
      )) ok++;
    }
    stats.technicians = ok;

    // ── maintenances ─────────────────────────────────────────────────────────
    const maint = getRows("maintenances");
    ok = 0;
    for (const r of maint) {
      if (await tryInsert(
        `INSERT INTO maintenances
           (id,motor_id,technician_id,maintenance_type,maintenance_date,
            description,parts_used,cost,status,notes,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.motor_id,r.technician_id,r.maintenance_type,r.maintenance_date,
         r.description,r.parts_used,r.cost,r.status,r.notes,r.created_at]
      )) ok++;
    }
    stats.maintenances = ok;

    // ── failures ─────────────────────────────────────────────────────────────
    const failures = getRows("failures");
    ok = 0;
    for (const r of failures) {
      if (await tryInsert(
        `INSERT INTO failures
           (id,motor_id,technician_id,failure_type,priority,status,
            reported_at,solution,notes,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.motor_id,r.technician_id,r.failure_type,r.priority,r.status,
         r.reported_at,r.solution,r.notes,r.created_at]
      )) ok++;
    }
    stats.failures = ok;

    // ── turbinas ─────────────────────────────────────────────────────────────
    const turbinas = getRows("turbinas");
    ok = 0;
    for (const r of turbinas) {
      if (await tryInsert(
        `INSERT INTO turbinas
           (id,code,serial_number,gg,pt,bearing_1,bearing_2,
            runtime_retiro,comentarios_retiro,operational_location,
            status,motor_id,notes,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (code) DO NOTHING`,
        [r.id,r.code,r.serial_number,r.gg,r.pt,r.bearing_1,r.bearing_2,
         r.runtime_retiro,r.comentarios_retiro,r.operational_location,
         r.status,r.motor_id,r.notes,r.created_at]
      )) ok++;
    }
    stats.turbinas = ok;

    // ── inventory_items ──────────────────────────────────────────────────────
    const items = getRows("inventory_items");
    ok = 0;
    for (const r of items) {
      if (await tryInsert(
        `INSERT INTO inventory_items
           (id,part_name,sku,quantity,min_stock,location,created_at)
         VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.part_name,r.sku,r.quantity,r.min_stock,r.location,r.created_at]
      )) ok++;
    }
    stats.inventory_items = ok;

    // ── inventory_movements ──────────────────────────────────────────────────
    const movements = getRows("inventory_movements");
    ok = 0;
    for (const r of movements) {
      if (await tryInsert(
        `INSERT INTO inventory_movements
           (id,inventory_item_id,movement_type,quantity,stock_before,stock_after,
            reference_type,reference_id,reference_label,notes,created_by,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.inventory_item_id,r.movement_type,r.quantity,r.stock_before,r.stock_after,
         r.reference_type,r.reference_id,r.reference_label,r.notes,r.created_by,r.created_at]
      )) ok++;
    }
    stats.inventory_movements = ok;

    // ── external_workshop_shipments ──────────────────────────────────────────
    const shipments = getRows("external_workshop_shipments");
    ok = 0;
    for (const r of shipments) {
      if (await tryInsert(
        `INSERT INTO external_workshop_shipments
           (id,equipment_type,equipment_id,workshop_name,responsible,
            departure_date,expected_return_date,actual_return_date,motive,
            equipment_condition,logistics_status,previous_operational_location,
            notes,created_by,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.equipment_type,r.equipment_id,r.workshop_name,r.responsible,
         r.departure_date,r.expected_return_date,r.actual_return_date,r.motive,
         r.equipment_condition,r.logistics_status,r.previous_operational_location,
         r.notes,r.created_by,r.created_at,r.updated_at]
      )) ok++;
    }
    stats.external_workshop_shipments = ok;

    // ── activity_log ─────────────────────────────────────────────────────────
    const logs = getRows("activity_log");
    ok = 0;
    for (const r of logs) {
      if (await tryInsert(
        `INSERT INTO activity_log
           (id,username,action,entity,entity_id,details,created_at)
         VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
        [r.id,r.username,r.action,r.entity,r.entity_id,r.details,r.created_at]
      )) ok++;
    }
    stats.activity_log = ok;

    // ── sincronizar secuencias SERIAL ─────────────────────────────────────────
    for (const t of [
      "users","motors","technicians","maintenances","failures",
      "turbinas","inventory_items","inventory_movements",
      "external_workshop_shipments","activity_log","documents"
    ]) {
      try {
        await pg.prepare(
          `SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1))`
        ).get();
      } catch (_) {}
    }

    sqlite.close();
    store.set(MIGRATION_FLAG, true);
    logInfo("auto_migrate.complete", stats);

    return { ok: true, stats };

  } catch (err) {
    logError("auto_migrate.failed", err);
    try { sqlite.close(); } catch (_) {}
    store.set(MIGRATION_FLAG, true);
    return { ok: false, error: err.message };
  }
}

module.exports = { autoMigrateIfNeeded };
