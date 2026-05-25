/**
 * BD en memoria para tests sin depender de better-sqlite3 (compilado para Electron).
 * Implementa solo el subconjunto de SQL usado por los tests de envios.
 */
function createTestDatabase() {
  const motors = [];
  const turbinas = [];
  const shipments = [];
  let motorId = 0;
  let turbinaId = 0;
  let shipmentId = 0;

  function nextId(counter) {
    return ++counter;
  }

  function prepare(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim();

    return {
      run(...params) {
        if (/^INSERT INTO motors/i.test(normalized)) {
          const id = nextId(motorId);
          motorId = id;
          motors.push({
            id,
            code: params[0],
            brand: params[1],
            operational_location: params[2] ?? "En planta",
          });
          return { changes: 1, lastInsertRowid: id };
        }

        if (/^INSERT INTO external_workshop_shipments/i.test(normalized)) {
          const id = nextId(shipmentId);
          shipmentId = id;
          shipments.push({
            id,
            equipment_type: params[0],
            equipment_id: params[1],
            workshop_name: params[2],
            logistics_status: params[3],
            previous_operational_location: params[4] ?? null,
          });
          return { changes: 1, lastInsertRowid: id };
        }

        const updateMotorFixed = normalized.match(/^UPDATE motors SET operational_location = '(.+)' WHERE id = \?$/i);
        if (updateMotorFixed) {
          const row = motors.find((m) => m.id === Number(params[0]));
          if (row) row.operational_location = updateMotorFixed[1];
          return { changes: row ? 1 : 0 };
        }

        const updateMotorParam = normalized.match(/^UPDATE motors SET operational_location = \? WHERE id = \?$/i);
        if (updateMotorParam) {
          const row = motors.find((m) => m.id === Number(params[1]));
          if (row) row.operational_location = params[0];
          return { changes: row ? 1 : 0 };
        }

        return { changes: 0 };
      },

      get(...params) {
        const selectMotorLoc = normalized.match(/^SELECT operational_location FROM motors WHERE id = \?$/i);
        if (selectMotorLoc) {
          const row = motors.find((m) => m.id === Number(params[0]));
          return row ? { operational_location: row.operational_location } : undefined;
        }

        const selectShipment = normalized.match(/^SELECT \* FROM external_workshop_shipments WHERE id = \?$/i);
        if (selectShipment) {
          return shipments.find((s) => s.id === Number(params[0]));
        }

        if (/SELECT id, logistics_status FROM external_workshop_shipments/i.test(normalized)) {
          const equipmentType = params[0];
          const equipmentId = Number(params[1]);
          const excludeId = params.length > 2 ? Number(params[2]) : null;
          const closed = new Set(["Entrada registrada", "Equipo entregado"]);
          const matches = shipments
            .filter((s) =>
              s.equipment_type === equipmentType &&
              Number(s.equipment_id) === equipmentId &&
              !closed.has(s.logistics_status) &&
              (excludeId == null || s.id !== excludeId)
            )
            .sort((a, b) => b.id - a.id);
          const row = matches[0];
          return row ? { id: row.id, logistics_status: row.logistics_status } : undefined;
        }

        return undefined;
      },

      all() {
        return [];
      },
    };
  }

  return { prepare };
}

module.exports = { createTestDatabase };
