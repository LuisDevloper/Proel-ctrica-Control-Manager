const { ipcMain } = require("electron");
const bcrypt = require("bcryptjs");
const { getDatabase } = require("../database/db");
const { logInfo } = require("../services/logger");

function registerIpcHandlers() {
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
        (SELECT COUNT(*) FROM maintenances WHERE maintenance_date >= date('now') AND maintenance_date <= date('now', '+7 day')) AS upcomingMaintenances
    `).get();
  });

  ipcMain.handle("motors:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM motors ORDER BY id DESC").all();
  });

  ipcMain.handle("motors:create", async (_event, motor) => {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO motors (
        code, brand, model, serial_number, voltage, power, rpm, location, status, installed_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      motor.code,
      motor.brand,
      motor.model || "",
      motor.serialNumber || "",
      motor.voltage || "",
      motor.power || "",
      motor.rpm || "",
      motor.location || "",
      motor.status || "Operativo",
      motor.installedAt || "",
      motor.notes || "",
      new Date().toISOString()
    );
    logInfo("motors.create", { code: motor.code });
    return { ok: true };
  });

  ipcMain.handle("motors:update", async (_event, motor) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE motors
      SET code = ?, brand = ?, model = ?, location = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(motor.code, motor.brand, motor.model || "", motor.location || "", motor.status || "Operativo", motor.notes || "", Number(motor.id));
    return { ok: true };
  });

  ipcMain.handle("motors:delete", async (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM motors WHERE id = ?").run(Number(id));
    return { ok: true };
  });

  ipcMain.handle("technicians:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM technicians ORDER BY id DESC").all();
  });

  ipcMain.handle("technicians:create", async (_event, technician) => {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO technicians (full_name, phone, email, specialty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", new Date().toISOString());
    return { ok: true };
  });

  ipcMain.handle("technicians:update", async (_event, technician) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE technicians
      SET full_name = ?, phone = ?, email = ?, specialty = ?
      WHERE id = ?
    `).run(technician.fullName, technician.phone || "", technician.email || "", technician.specialty || "", Number(technician.id));
    return { ok: true };
  });

  ipcMain.handle("technicians:delete", async (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM technicians WHERE id = ?").run(Number(id));
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
        mo.code AS motor_code,
        t.full_name AS technician_name
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      LEFT JOIN technicians t ON t.id = m.technician_id
      ORDER BY m.id DESC
    `).all();
  });

  ipcMain.handle("maintenances:create", async (_event, maintenance) => {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO maintenances (
        motor_id, technician_id, maintenance_type, maintenance_date, description, parts_used, cost, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(maintenance.motorId),
      maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance.maintenanceType,
      maintenance.maintenanceDate,
      maintenance.description || "",
      maintenance.partsUsed || "",
      Number(maintenance.cost || 0),
      maintenance.notes || "",
      new Date().toISOString()
    );
    return { ok: true };
  });

  ipcMain.handle("maintenances:update", async (_event, maintenance) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE maintenances
      SET motor_id = ?, technician_id = ?, maintenance_type = ?, maintenance_date = ?, description = ?, cost = ?
      WHERE id = ?
    `).run(
      Number(maintenance.motorId),
      maintenance.technicianId ? Number(maintenance.technicianId) : null,
      maintenance.maintenanceType,
      maintenance.maintenanceDate,
      maintenance.description || "",
      Number(maintenance.cost || 0),
      Number(maintenance.id)
    );
    return { ok: true };
  });

  ipcMain.handle("maintenances:delete", async (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM maintenances WHERE id = ?").run(Number(id));
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
        mo.code AS motor_code,
        t.full_name AS technician_name
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      LEFT JOIN technicians t ON t.id = f.technician_id
      ORDER BY f.id DESC
    `).all();
  });

  ipcMain.handle("failures:create", async (_event, failure) => {
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
    return { ok: true };
  });

  ipcMain.handle("failures:update", async (_event, failure) => {
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
    return { ok: true };
  });

  ipcMain.handle("failures:delete", async (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM failures WHERE id = ?").run(Number(id));
    return { ok: true };
  });

  ipcMain.handle("inventory:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM inventory_items ORDER BY id DESC").all();
  });

  ipcMain.handle("inventory:create", async (_event, item) => {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO inventory_items (part_name, sku, quantity, min_stock, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item.partName, item.sku || "", Number(item.quantity || 0), Number(item.minStock || 0), item.location || "", new Date().toISOString());
    return { ok: true };
  });

  ipcMain.handle("inventory:update", async (_event, item) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE inventory_items
      SET part_name = ?, sku = ?, quantity = ?, min_stock = ?, location = ?
      WHERE id = ?
    `).run(item.partName, item.sku || "", Number(item.quantity || 0), Number(item.minStock || 0), item.location || "", Number(item.id));
    return { ok: true };
  });

  ipcMain.handle("inventory:delete", async (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM inventory_items WHERE id = ?").run(Number(id));
    return { ok: true };
  });
}

module.exports = {
  registerIpcHandlers
};
