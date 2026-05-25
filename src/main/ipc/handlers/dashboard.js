function registerDashboardHandlers({ ipcMain, getDatabase, guards, equipment }) {
  const { denyIfNotAuthenticated, secureHandler } = guards;
  const { canonicalMotorStatus } = equipment;
  const { MOTOR_ALLOWED_STATUSES } = require("../../../modules/equipment/constants");
  const { parseDashboardYear, parseDashboardMonth, buildYearMonthKey, formatDashboardPeriod, getAvailableYears, fillYearMonths } = require("../../../modules/dashboard/years");

  function equipmentStatusCounts(db, table) {
    const rows = db.prepare(`SELECT status FROM ${table}`).all();
    const map = Object.fromEntries(MOTOR_ALLOWED_STATUSES.map((status) => [status, 0]));
    for (const row of rows) {
      const { status } = canonicalMotorStatus(row.status);
      map[status] = (map[status] || 0) + 1;
    }
    return MOTOR_ALLOWED_STATUSES.map((status) => ({ status, count: map[status] }));
  }

  ipcMain.handle(
    "notifications:list",
    secureHandler(denyIfNotAuthenticated, () => {
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
    })
  );

  ipcMain.handle(
    "dashboard:charts",
    secureHandler(denyIfNotAuthenticated, (_event, opts = {}) => {
      const db = getDatabase();
      const year = parseDashboardYear(opts.year);
      const month = parseDashboardMonth(opts.month);
      const yearKey = String(year);
      const yearMonthKey = month ? buildYearMonthKey(year, month) : null;
      const availableYears = getAvailableYears(db);
      const periodLabel = formatDashboardPeriod(year, month);

      const motorsByStatus = equipmentStatusCounts(db, "motors");
      const turbinasByStatus = equipmentStatusCounts(db, "turbinas");

      const maintenanceRows = db.prepare(`
        SELECT strftime('%Y-%m', maintenance_date) as month, COUNT(*) as count
        FROM maintenances
        WHERE strftime('%Y', maintenance_date) = ?
        GROUP BY month
        ORDER BY month
      `).all(yearKey);

      const failureRows = db.prepare(`
        SELECT strftime('%Y-%m', reported_at) as month, COUNT(*) as count
        FROM failures
        WHERE strftime('%Y', reported_at) = ?
        GROUP BY month
        ORDER BY month
      `).all(yearKey);

      let maintenancesByMonth = fillYearMonths(maintenanceRows, year);
      let failuresByMonth = fillYearMonths(failureRows, year);

      if (month) {
        maintenancesByMonth = maintenancesByMonth.filter((row) => row.month === yearMonthKey);
        failuresByMonth = failuresByMonth.filter((row) => row.month === yearMonthKey);
      }

      const costByMotor = month
        ? db.prepare(`
            SELECT mo.code AS motor, SUM(m.cost) AS total
            FROM maintenances m
            JOIN motors mo ON mo.id = m.motor_id
            WHERE strftime('%Y-%m', m.maintenance_date) = ?
            GROUP BY mo.id
            ORDER BY total DESC
            LIMIT 10
          `).all(yearMonthKey)
        : db.prepare(`
            SELECT mo.code AS motor, SUM(m.cost) AS total
            FROM maintenances m
            JOIN motors mo ON mo.id = m.motor_id
            WHERE strftime('%Y', m.maintenance_date) = ?
            GROUP BY mo.id
            ORDER BY total DESC
            LIMIT 10
          `).all(yearKey);

      const yearTotals = month
        ? db.prepare(`
            SELECT
              (SELECT COUNT(*) FROM maintenances WHERE strftime('%Y-%m', maintenance_date) = ?) AS maintenancesInYear,
              (SELECT COUNT(*) FROM failures WHERE strftime('%Y-%m', reported_at) = ?) AS failuresInYear,
              (SELECT COALESCE(SUM(cost), 0) FROM maintenances WHERE strftime('%Y-%m', maintenance_date) = ?) AS maintenanceCostInYear
          `).get(yearMonthKey, yearMonthKey, yearMonthKey)
        : db.prepare(`
            SELECT
              (SELECT COUNT(*) FROM maintenances WHERE strftime('%Y', maintenance_date) = ?) AS maintenancesInYear,
              (SELECT COUNT(*) FROM failures WHERE strftime('%Y', reported_at) = ?) AS failuresInYear,
              (SELECT COALESCE(SUM(cost), 0) FROM maintenances WHERE strftime('%Y', maintenance_date) = ?) AS maintenanceCostInYear
          `).get(yearKey, yearKey, yearKey);

      return {
        year,
        month,
        periodLabel,
        availableYears,
        motorsByStatus,
        turbinasByStatus,
        maintenancesByMonth,
        failuresByMonth,
        costByMotor,
        yearTotals,
      };
    })
  );

  ipcMain.handle(
    "dashboard:stats",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM motors) AS totalMotors,
        (SELECT COUNT(*) FROM turbinas) AS totalTurbinas,
        (SELECT COUNT(*) FROM motors WHERE status = 'En mantenimiento') +
        (SELECT COUNT(*) FROM turbinas WHERE status = 'En mantenimiento') AS inMaintenance,
        (SELECT COUNT(*) FROM motors WHERE status = 'Fuera de servicio') +
        (SELECT COUNT(*) FROM turbinas WHERE status = 'Fuera de servicio') AS outOfService,
        (SELECT COUNT(*) FROM maintenances) AS totalMaintenances,
        (SELECT COUNT(*) FROM failures WHERE status <> 'Resuelta') AS pendingFailures,
        (SELECT COUNT(*) FROM technicians) AS totalTechnicians,
        (SELECT COUNT(*) FROM inventory_items WHERE quantity <= min_stock) AS lowStockItems,
        (SELECT COUNT(*) FROM maintenances WHERE maintenance_date >= date('now') AND maintenance_date <= date('now', '+7 day') AND status != 'Completado') AS upcomingMaintenances,
        (SELECT COUNT(*) FROM external_workshop_shipments WHERE logistics_status NOT IN ('Entrada registrada', 'Equipo entregado')) AS pendingShipments
    `).get();
    })
  );
}

module.exports = registerDashboardHandlers;
