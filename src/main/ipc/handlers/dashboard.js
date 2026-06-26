function registerDashboardHandlers({ ipcMain, getDatabase, guards, equipment }) {
  const { denyIfNotAuthenticated, secureHandler } = guards;
  const { countEquipmentByEffectiveStatus, countInMaintenance } = require("../../../modules/equipment/status");
  const { parseDashboardYear, parseDashboardMonth, buildYearMonthKey, formatDashboardPeriod, getAvailableYears, fillYearMonths } = require("../../../modules/dashboard/years");

  async function equipmentStatusRows(db, table) {
    if (table === "motors") {
      const rows = await db.prepare(`
        SELECT
          m.status,
          m.operational_location AS operationalLocation,
          EXISTS(
            SELECT 1 FROM maintenances mt
            WHERE mt.motor_id = m.id AND mt.status != 'Completado'
          ) AS hasOpenMaintenance
        FROM motors m
      `).all();
      return rows.map((row) => ({
        status: row.status,
        operationalLocation: row.operationallocation ?? row.operationalLocation,
        hasOpenMaintenance: Boolean(row.hasopenmaintenance ?? row.hasOpenMaintenance),
      }));
    }
    const rows = await db.prepare(`
      SELECT status, operational_location AS operationallocation
      FROM turbinas
    `).all();
    return rows.map((row) => ({
      status: row.status,
      operationalLocation: row.operationallocation,
    }));
  }

  async function equipmentStatusCounts(db, table) {
    return countEquipmentByEffectiveStatus(await equipmentStatusRows(db, table));
  }

  ipcMain.handle(
    "notifications:list",
    secureHandler(denyIfNotAuthenticated, async () => {
      const db = getDatabase();
      const upcoming = await db.prepare(`
      SELECT 'maintenance' as type, 'Mantenimiento proximo' as title,
        mo.code || ' — ' || m.maintenance_type as body,
        m.maintenance_date as date, m.id
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      WHERE m.maintenance_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND m.status != 'Completado'
      ORDER BY m.maintenance_date
    `).all();
      const failures = await db.prepare(`
      SELECT 'failure' as type, 'Falla pendiente' as title,
        mo.code || ' — ' || f.failure_type as body,
        f.reported_at as date, f.id
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      WHERE f.status != 'Resuelta'
      ORDER BY CASE f.priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END
    `).all();
      const lowStock = await db.prepare(`
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
    secureHandler(denyIfNotAuthenticated, async (_event, opts = {}) => {
      const db = getDatabase();
      const year = parseDashboardYear(opts.year);
      const month = parseDashboardMonth(opts.month);
      const yearKey = String(year);
      const yearMonthKey = month ? buildYearMonthKey(year, month) : null;
      const availableYears = await getAvailableYears(db);
      const periodLabel = formatDashboardPeriod(year, month);

      const motorsByStatus = await equipmentStatusCounts(db, "motors");
      const turbinasByStatus = await equipmentStatusCounts(db, "turbinas");

      const maintenanceRows = await db.prepare(`
        SELECT TO_CHAR(maintenance_date::date, 'YYYY-MM') as month, COUNT(*) as count
        FROM maintenances
        WHERE TO_CHAR(maintenance_date::date, 'YYYY') = ?
        GROUP BY month
        ORDER BY month
      `).all(yearKey);

      const failureRows = await db.prepare(`
        SELECT TO_CHAR(reported_at::date, 'YYYY-MM') as month, COUNT(*) as count
        FROM failures
        WHERE TO_CHAR(reported_at::date, 'YYYY') = ?
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
        ? await db.prepare(`
            SELECT mo.code AS motor, SUM(m.cost) AS total
            FROM maintenances m
            JOIN motors mo ON mo.id = m.motor_id
            WHERE TO_CHAR(m.maintenance_date::date, 'YYYY-MM') = ?
            GROUP BY mo.id, mo.code
            ORDER BY total DESC
            LIMIT 10
          `).all(yearMonthKey)
        : await db.prepare(`
            SELECT mo.code AS motor, SUM(m.cost) AS total
            FROM maintenances m
            JOIN motors mo ON mo.id = m.motor_id
            WHERE TO_CHAR(m.maintenance_date::date, 'YYYY') = ?
            GROUP BY mo.id, mo.code
            ORDER BY total DESC
            LIMIT 10
          `).all(yearKey);

      const yearTotals = month
        ? await db.prepare(`
            SELECT
              (SELECT COUNT(*) FROM maintenances WHERE TO_CHAR(maintenance_date::date, 'YYYY-MM') = $1) AS "maintenancesInYear",
              (SELECT COUNT(*) FROM failures WHERE TO_CHAR(reported_at::date, 'YYYY-MM') = $1) AS "failuresInYear",
              (SELECT COALESCE(SUM(cost), 0) FROM maintenances WHERE TO_CHAR(maintenance_date::date, 'YYYY-MM') = $1) AS "maintenanceCostInYear"
          `).get(yearMonthKey)
        : await db.prepare(`
            SELECT
              (SELECT COUNT(*) FROM maintenances WHERE TO_CHAR(maintenance_date::date, 'YYYY') = $1) AS "maintenancesInYear",
              (SELECT COUNT(*) FROM failures WHERE TO_CHAR(reported_at::date, 'YYYY') = $1) AS "failuresInYear",
              (SELECT COALESCE(SUM(cost), 0) FROM maintenances WHERE TO_CHAR(maintenance_date::date, 'YYYY') = $1) AS "maintenanceCostInYear"
          `).get(yearKey);

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
    secureHandler(denyIfNotAuthenticated, async () => {
      const db = getDatabase();
      const motorRows = await equipmentStatusRows(db, "motors");
      const turbinaRows = await equipmentStatusRows(db, "turbinas");
      const inMaintenance = countInMaintenance(motorRows) + countInMaintenance(turbinaRows);

      const [tm, tt, oos1, oos2, tmaint, pf, tt2, ls, um, ps] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS c FROM motors").get(),
        db.prepare("SELECT COUNT(*) AS c FROM turbinas").get(),
        db.prepare("SELECT COUNT(*) AS c FROM motors WHERE status = 'Fuera de servicio'").get(),
        db.prepare("SELECT COUNT(*) AS c FROM turbinas WHERE status = 'Fuera de servicio'").get(),
        db.prepare("SELECT COUNT(*) AS c FROM maintenances").get(),
        db.prepare("SELECT COUNT(*) AS c FROM failures WHERE status <> 'Resuelta'").get(),
        db.prepare("SELECT COUNT(*) AS c FROM technicians").get(),
        db.prepare("SELECT COUNT(*) AS c FROM inventory_items WHERE quantity <= min_stock").get(),
        db.prepare(`
          SELECT COUNT(*) AS c FROM maintenances
          WHERE maintenance_date::date >= CURRENT_DATE
            AND maintenance_date::date <= CURRENT_DATE + INTERVAL '7 days'
            AND status != 'Completado'
        `).get(),
        db.prepare(`
          SELECT COUNT(*) AS c FROM external_workshop_shipments
          WHERE logistics_status NOT IN ('Entrada registrada', 'Equipo entregado')
        `).get(),
      ]);

      return {
        totalMotors: Number(tm.c),
        totalTurbinas: Number(tt.c),
        inMaintenance,
        outOfService: Number(oos1.c) + Number(oos2.c),
        totalMaintenances: Number(tmaint.c),
        pendingFailures: Number(pf.c),
        totalTechnicians: Number(tt2.c),
        lowStockItems: Number(ls.c),
        upcomingMaintenances: Number(um.c),
        pendingShipments: Number(ps.c),
      };
    })
  );
}

module.exports = registerDashboardHandlers;
