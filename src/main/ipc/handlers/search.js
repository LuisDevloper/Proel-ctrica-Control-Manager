function registerSearchHandlers({ ipcMain, getDatabase, guards }) {
  const { denyIfNotAuthenticated, secureHandler } = guards;

  ipcMain.handle(
    "search:global",
    secureHandler(denyIfNotAuthenticated, async (_event, { q } = {}) => {
      const query = String(q || "").trim();
      if (query.length < 2) return { motors: [], maintenances: [], failures: [] };

      const db   = getDatabase();
      const term = `%${query}%`;

      const [motors, maintenances, failures] = await Promise.all([
        db.prepare(`
          SELECT id, code, brand, model, status,
                 operational_location AS "operationalLocation"
          FROM motors
          WHERE code ILIKE ?
             OR brand ILIKE ?
             OR model ILIKE ?
             OR operational_location ILIKE ?
             OR serial_number ILIKE ?
          ORDER BY id DESC
          LIMIT 6
        `).all(term, term, term, term, term),

        db.prepare(`
          SELECT m.id,
                 m.motor_id        AS "motorId",
                 m.maintenance_type AS "maintenanceType",
                 m.maintenance_date AS "maintenanceDate",
                 m.status,
                 mo.code           AS "motorCode"
          FROM maintenances m
          JOIN motors mo ON mo.id = m.motor_id
          WHERE mo.code          ILIKE ?
             OR m.maintenance_type ILIKE ?
             OR m.description    ILIKE ?
          ORDER BY m.id DESC
          LIMIT 6
        `).all(term, term, term),

        db.prepare(`
          SELECT f.id,
                 f.motor_id    AS "motorId",
                 f.failure_type AS "failureType",
                 f.status,
                 f.priority,
                 f.reported_at AS "reportedAt",
                 mo.code       AS "motorCode"
          FROM failures f
          JOIN motors mo ON mo.id = f.motor_id
          WHERE mo.code        ILIKE ?
             OR f.failure_type ILIKE ?
             OR f.notes        ILIKE ?
          ORDER BY f.id DESC
          LIMIT 6
        `).all(term, term, term),
      ]);

      return { motors, maintenances, failures };
    })
  );
}

module.exports = registerSearchHandlers;
