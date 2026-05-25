function registerShipmentsHandlers({ ipcMain, getDatabase, guards, shipments, logActivity, deleteDocumentsForEntity, auth }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const {
    canonicalLogisticsStatus,
    syncEquipmentLocationFromShipment,
    getEquipmentOperationalLocation,
    restoreEquipmentLocationAfterShipmentRemoval,
    shipmentListSelect,
    mapShipmentRow,
    validateShipmentEquipment,
  } = shipments;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNullableId } = require("../../../modules/activity/unchanged");

  const SHIPMENT_UPDATE_FIELDS = [
    ["equipment_type", "Tipo equipo"],
    ["equipment_id", "Equipo"],
    ["workshop_name", "Taller"],
    ["responsible", "Responsable"],
    ["departure_date", "Salida"],
    ["expected_return_date", "Retorno estimado"],
    ["actual_return_date", "Retorno real"],
    ["motive", "Motivo"],
    ["equipment_condition", "Condicion"],
    ["logistics_status", "Estado logistica"],
    ["notes", "Notas"],
  ];

  ipcMain.handle(
    "external-shipments:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      const rows = db.prepare(`${shipmentListSelect()} ORDER BY s.id DESC`).all();
      return rows.map(mapShipmentRow);
    })
  );

  ipcMain.handle("external-shipments:create", async (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const equipmentType = payload.equipmentType || payload.equipment_type;
    const equipmentId = payload.equipmentId || payload.equipment_id;
    const check = validateShipmentEquipment(db, equipmentType, equipmentId);
    if (!check.ok) return check;
    if (!payload.workshopName && !payload.workshop_name) {
      return { ok: false, message: "El nombre del taller es obligatorio." };
    }
    if (!payload.departureDate && !payload.departure_date) {
      return { ok: false, message: "La fecha de salida es obligatoria." };
    }

    const now = new Date().toISOString();
    const logisticsStatus = canonicalLogisticsStatus(payload.logisticsStatus || payload.logistics_status);
    const previousLocation = getEquipmentOperationalLocation(db, equipmentType, equipmentId);
    const result = db.prepare(`
      INSERT INTO external_workshop_shipments (
        equipment_type, equipment_id, workshop_name, responsible,
        departure_date, expected_return_date, actual_return_date,
        motive, equipment_condition, logistics_status, previous_operational_location, notes,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      equipmentType,
      Number(equipmentId),
      payload.workshopName || payload.workshop_name,
      payload.responsible || "",
      payload.departureDate || payload.departure_date,
      payload.expectedReturnDate || payload.expected_return_date || null,
      payload.actualReturnDate || payload.actual_return_date || null,
      payload.motive || "",
      payload.equipmentCondition || payload.equipment_condition || "",
      logisticsStatus,
      previousLocation,
      payload.notes || "",
      auth.getAuthSession()?.username || null,
      now,
      now
    );

    syncEquipmentLocationFromShipment(db, equipmentType, equipmentId, logisticsStatus);
    logActivity(
      db,
      payload._username,
      "CREATE",
      "external_shipments",
      result.lastInsertRowid,
      `${equipmentType} #${equipmentId} → ${payload.workshopName || payload.workshop_name}`
    );
    return { ok: true, id: result.lastInsertRowid };
  });

  ipcMain.handle("external-shipments:update", async (_event, payload = {}) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM external_workshop_shipments WHERE id = ?").get(Number(payload.id));
    if (!existing) return { ok: false, message: "Envio no encontrado." };

    const equipmentType = payload.equipmentType || payload.equipment_type || existing.equipment_type;
    const equipmentId = payload.equipmentId || payload.equipment_id || existing.equipment_id;
    const check = validateShipmentEquipment(db, equipmentType, equipmentId);
    if (!check.ok) return check;

    const logisticsStatus = canonicalLogisticsStatus(
      payload.logisticsStatus || payload.logistics_status || existing.logistics_status
    );
    let actualReturn = payload.actualReturnDate || payload.actual_return_date || existing.actual_return_date;
    if (["Entrada registrada", "Equipo entregado"].includes(logisticsStatus) && !actualReturn) {
      actualReturn = new Date().toISOString().slice(0, 10);
    }

    const after = {
      equipment_type: equipmentType,
      equipment_id: Number(equipmentId),
      workshop_name: payload.workshopName || payload.workshop_name || existing.workshop_name,
      responsible: payload.responsible ?? existing.responsible ?? "",
      departure_date: payload.departureDate || payload.departure_date || existing.departure_date,
      expected_return_date: payload.expectedReturnDate || payload.expected_return_date || existing.expected_return_date || null,
      actual_return_date: actualReturn || null,
      motive: payload.motive ?? existing.motive ?? "",
      equipment_condition: payload.equipmentCondition || payload.equipment_condition || existing.equipment_condition || "",
      logistics_status: logisticsStatus,
      notes: payload.notes ?? existing.notes ?? "",
    };

    if (isRowUnchanged(existing, after, [
      { beforeKey: "equipment_type", normalize: normStr },
      { beforeKey: "equipment_id", normalize: normNullableId },
      { beforeKey: "workshop_name", normalize: normStr },
      { beforeKey: "responsible", normalize: normStr },
      { beforeKey: "departure_date", normalize: normStr },
      { beforeKey: "expected_return_date", normalize: normStr },
      { beforeKey: "actual_return_date", normalize: normStr },
      { beforeKey: "motive", normalize: normStr },
      { beforeKey: "equipment_condition", normalize: normStr },
      { beforeKey: "logistics_status", normalize: normStr },
      { beforeKey: "notes", normalize: normStr },
    ])) {
      return { ok: true, unchanged: true };
    }

    const equipmentChanged =
      equipmentType !== existing.equipment_type || Number(equipmentId) !== Number(existing.equipment_id);
    if (equipmentChanged) {
      restoreEquipmentLocationAfterShipmentRemoval(db, existing, existing.id);
    }

    let previousLocation = existing.previous_operational_location || getEquipmentOperationalLocation(db, existing.equipment_type, existing.equipment_id);
    if (equipmentChanged) {
      previousLocation = getEquipmentOperationalLocation(db, equipmentType, equipmentId);
    }

    db.prepare(`
      UPDATE external_workshop_shipments
      SET equipment_type = ?, equipment_id = ?, workshop_name = ?, responsible = ?,
          departure_date = ?, expected_return_date = ?, actual_return_date = ?,
          motive = ?, equipment_condition = ?, logistics_status = ?, previous_operational_location = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      after.equipment_type,
      after.equipment_id,
      after.workshop_name,
      after.responsible,
      after.departure_date,
      after.expected_return_date,
      after.actual_return_date,
      after.motive,
      after.equipment_condition,
      after.logistics_status,
      previousLocation,
      after.notes,
      new Date().toISOString(),
      Number(payload.id)
    );

    syncEquipmentLocationFromShipment(db, equipmentType, equipmentId, logisticsStatus);
    logActivity(
      db,
      payload._username,
      "UPDATE",
      "external_shipments",
      payload.id,
      buildUpdateDetails({
        summary: `Envio #${payload.id}`,
        fields: SHIPMENT_UPDATE_FIELDS,
        before: existing,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("external-shipments:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM external_workshop_shipments WHERE id = ?").get(Number(id));
    if (!row) return { ok: false, message: "Envio no encontrado." };
    restoreEquipmentLocationAfterShipmentRemoval(db, row);
    deleteDocumentsForEntity(db, "external_shipment", Number(id));
    db.prepare("DELETE FROM external_workshop_shipments WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "external_shipments", id, row.workshop_name);
    return { ok: true };
  });
}

module.exports = registerShipmentsHandlers;
