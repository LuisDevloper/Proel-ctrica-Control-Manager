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

      // Mantenimientos vencidos (fecha pasada, no completados) — urgencia ALTA
      const overdue = await db.prepare(`
        SELECT 'overdue_maintenance' AS type, 'Mantenimiento vencido' AS title,
          mo.code || ' — ' || m.maintenance_type AS body,
          m.maintenance_date AS date, m.id,
          'high' AS urgency,
          (CURRENT_DATE - m.maintenance_date::date) AS days_late
        FROM maintenances m
        JOIN motors mo ON mo.id = m.motor_id
        WHERE m.maintenance_date::date < CURRENT_DATE
          AND m.status NOT IN ('Completado', 'Cancelado')
        ORDER BY m.maintenance_date
      `).all();

      // Mantenimientos próximos (7 días) — urgencia MEDIA
      const upcoming = await db.prepare(`
        SELECT 'maintenance' AS type, 'Mantenimiento proximo' AS title,
          mo.code || ' — ' || m.maintenance_type AS body,
          m.maintenance_date AS date, m.id,
          'medium' AS urgency,
          0 AS days_late
        FROM maintenances m
        JOIN motors mo ON mo.id = m.motor_id
        WHERE m.maintenance_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND m.status NOT IN ('Completado', 'Cancelado')
        ORDER BY m.maintenance_date
      `).all();

      // Fallas estancadas > 5 días sin resolver — urgencia ALTA
      const stalledFailures = await db.prepare(`
        SELECT 'stalled_failure' AS type, 'Falla sin resolver' AS title,
          mo.code || ' — ' || f.failure_type AS body,
          f.reported_at AS date, f.id,
          'high' AS urgency,
          (CURRENT_DATE - f.reported_at::date) AS days_late
        FROM failures f
        JOIN motors mo ON mo.id = f.motor_id
        WHERE f.status != 'Resuelta'
          AND f.reported_at::date < CURRENT_DATE - INTERVAL '5 days'
        ORDER BY CASE f.priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END,
                 f.reported_at
      `).all();

      // Fallas recientes pendientes (≤ 5 días) — urgencia MEDIA
      const recentFailures = await db.prepare(`
        SELECT 'failure' AS type, 'Falla pendiente' AS title,
          mo.code || ' — ' || f.failure_type AS body,
          f.reported_at AS date, f.id,
          'medium' AS urgency,
          0 AS days_late
        FROM failures f
        JOIN motors mo ON mo.id = f.motor_id
        WHERE f.status != 'Resuelta'
          AND f.reported_at::date >= CURRENT_DATE - INTERVAL '5 days'
        ORDER BY CASE f.priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END
      `).all();

      // Stock bajo — urgencia MEDIA
      const lowStock = await db.prepare(`
        SELECT 'stock' AS type, 'Stock minimo' AS title,
          part_name || ' (' || quantity || ' uds)' AS body,
          created_at AS date, id,
          'medium' AS urgency,
          0 AS days_late
        FROM inventory_items
        WHERE quantity <= min_stock
      `).all();

      // Orden: alta urgencia primero
      return [...overdue, ...stalledFailures, ...upcoming, ...recentFailures, ...lowStock];
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

  // ── KPIs de confiabilidad ─────────────────────────────────────────────────
  ipcMain.handle(
    "motors:reliability",
    secureHandler(denyIfNotAuthenticated, async (_event, opts = {}) => {
      const db   = getDatabase();
      const days = Math.min(Math.max(Number(opts.days) || 365, 30), 730);
      // Fecha límite calculada una sola vez — permite usar el índice idx_failures_reported_at
      // sin necesidad de castear la columna en cada fila
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

      const rows = await db.prepare(`
        SELECT
          mo.id,
          mo.code,
          mo.brand,
          mo.status,
          mo.operational_location AS operationalLocation,
          COUNT(DISTINCT f.id)              AS failure_count,
          COUNT(DISTINCT m.id)              AS maintenance_count,
          COALESCE(SUM(DISTINCT m.cost), 0) AS total_cost,
          MIN(LEFT(f.reported_at, 10))      AS first_failure,
          MAX(LEFT(f.reported_at, 10))      AS last_failure,
          CASE
            WHEN COUNT(DISTINCT f.id) >= 2 THEN
              ROUND(
                (MAX(LEFT(f.reported_at, 10))::date - MIN(LEFT(f.reported_at, 10))::date)::numeric
                / NULLIF(COUNT(DISTINCT f.id) - 1, 0)
              )
            ELSE NULL
          END AS mtbf_days
        FROM motors mo
        LEFT JOIN failures f
          ON f.motor_id = mo.id
         AND f.reported_at >= ?
        LEFT JOIN maintenances m
          ON m.motor_id = mo.id
         AND m.maintenance_date >= ?
        GROUP BY mo.id, mo.code, mo.brand, mo.status, mo.operational_location
        ORDER BY failure_count DESC, total_cost DESC
        LIMIT 20
      `).all(since, since);

      const summary = await db.prepare(`
        SELECT
          COUNT(DISTINCT f.id) AS total_failures,
          COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN f.motor_id END) AS motors_with_failures,
          COUNT(DISTINCT mo.id) AS total_motors,
          ROUND(AVG(CASE WHEN cnt.c >= 2 THEN cnt.mtbf END)) AS avg_mtbf
        FROM motors mo
        LEFT JOIN failures f
          ON f.motor_id = mo.id
         AND f.reported_at >= ?
        LEFT JOIN (
          SELECT motor_id,
            COUNT(*) AS c,
            CASE WHEN COUNT(*) >= 2 THEN
              ROUND(
                (MAX(LEFT(reported_at, 10))::date - MIN(LEFT(reported_at, 10))::date)::numeric
                / NULLIF(COUNT(*) - 1, 0)
              )
            END AS mtbf
          FROM failures
          WHERE reported_at >= ?
          GROUP BY motor_id
        ) cnt ON cnt.motor_id = mo.id
      `).get(since, since);

      return { rows, summary, days };
    })
  );
}

module.exports = registerDashboardHandlers;
