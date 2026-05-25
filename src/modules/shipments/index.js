const {
  LOGISTICS_STATUS_OPTIONS,
  SHIPMENT_EQUIPMENT_TYPES,
} = require("../equipment/constants");
const { canonicalFromList, canonicalOperationalLocation } = require("../equipment/canonical");

function canonicalLogisticsStatus(raw) {
  return canonicalFromList(raw, LOGISTICS_STATUS_OPTIONS, "Permiso de salida aprobado");
}

function syncEquipmentLocationFromShipment(db, equipmentType, equipmentId, logisticsStatus) {
  if (!SHIPMENT_EQUIPMENT_TYPES.includes(equipmentType)) return;
  const table = equipmentType === "motor" ? "motors" : "turbinas";
  if (["Permiso de salida aprobado", "Equipo en transito"].includes(logisticsStatus)) {
    db.prepare(`UPDATE ${table} SET operational_location = 'Taller externo' WHERE id = ?`).run(Number(equipmentId));
  } else if (["Entrada registrada", "Equipo entregado"].includes(logisticsStatus)) {
    db.prepare(`UPDATE ${table} SET operational_location = 'En planta' WHERE id = ?`).run(Number(equipmentId));
  }
}

function getEquipmentOperationalLocation(db, equipmentType, equipmentId) {
  if (!SHIPMENT_EQUIPMENT_TYPES.includes(equipmentType)) return "En planta";
  const table = equipmentType === "motor" ? "motors" : "turbinas";
  const row = db.prepare(`SELECT operational_location FROM ${table} WHERE id = ?`).get(Number(equipmentId));
  return canonicalOperationalLocation(row?.operational_location || "En planta");
}

function getOpenShipmentForEquipment(db, equipmentType, equipmentId, excludeId = null) {
  let sql = `
    SELECT id, logistics_status FROM external_workshop_shipments
    WHERE equipment_type = ? AND equipment_id = ?
      AND logistics_status NOT IN ('Entrada registrada', 'Equipo entregado')
  `;
  const params = [equipmentType, Number(equipmentId)];
  if (excludeId != null) {
    sql += " AND id != ?";
    params.push(Number(excludeId));
  }
  sql += " ORDER BY id DESC LIMIT 1";
  return db.prepare(sql).get(...params);
}

function restoreEquipmentLocationAfterShipmentRemoval(db, shipmentRow, excludeShipmentId = null) {
  if (!shipmentRow) return;
  const {
    equipment_type: equipmentType,
    equipment_id: equipmentId,
    previous_operational_location: previousLoc,
    logistics_status: logisticsStatus,
  } = shipmentRow;
  if (!SHIPMENT_EQUIPMENT_TYPES.includes(equipmentType)) return;

  const otherOpen = getOpenShipmentForEquipment(db, equipmentType, equipmentId, excludeShipmentId);
  if (otherOpen) {
    syncEquipmentLocationFromShipment(db, equipmentType, equipmentId, otherOpen.logistics_status);
    return;
  }

  const current = getEquipmentOperationalLocation(db, equipmentType, equipmentId);
  const shipmentWasOpen = !["Entrada registrada", "Equipo entregado"].includes(logisticsStatus);
  if (!shipmentWasOpen && current !== "Taller externo") return;

  const table = equipmentType === "motor" ? "motors" : "turbinas";
  const restore = canonicalOperationalLocation(previousLoc || "En planta");
  db.prepare(`UPDATE ${table} SET operational_location = ? WHERE id = ?`).run(restore, Number(equipmentId));
}

function shipmentListSelect() {
  return `
    SELECT
      s.*,
      CASE WHEN s.equipment_type = 'motor' THEN m.code ELSE t.code END AS equipment_code,
      CASE WHEN s.equipment_type = 'motor' THEN m.brand ELSE NULL END AS equipment_brand,
      CASE WHEN s.equipment_type = 'turbine' THEN t.gg ELSE NULL END AS equipment_gg,
      (
        SELECT d.id FROM documents d
        WHERE d.entity_type = 'external_shipment' AND d.entity_id = s.id AND d.doc_type = 'permiso_firmado'
        ORDER BY d.id DESC LIMIT 1
      ) AS signed_permit_doc_id
    FROM external_workshop_shipments s
    LEFT JOIN motors m ON s.equipment_type = 'motor' AND m.id = s.equipment_id
    LEFT JOIN turbinas t ON s.equipment_type = 'turbine' AND t.id = s.equipment_id
  `;
}

function mapShipmentRow(row) {
  return {
    id: row.id,
    equipmentType: row.equipment_type,
    equipmentId: row.equipment_id,
    equipmentCode: row.equipment_code,
    equipmentBrand: row.equipment_brand,
    equipmentGg: row.equipment_gg,
    workshopName: row.workshop_name,
    responsible: row.responsible,
    departureDate: row.departure_date,
    expectedReturnDate: row.expected_return_date,
    actualReturnDate: row.actual_return_date,
    motive: row.motive,
    equipmentCondition: row.equipment_condition,
    logisticsStatus: row.logistics_status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedPermitDocId: row.signed_permit_doc_id || null,
  };
}

function validateShipmentEquipment(db, equipmentType, equipmentId) {
  if (!SHIPMENT_EQUIPMENT_TYPES.includes(equipmentType)) {
    return { ok: false, message: "Tipo de equipo no valido." };
  }
  const table = equipmentType === "motor" ? "motors" : "turbinas";
  const row = db.prepare(`SELECT id, code FROM ${table} WHERE id = ?`).get(Number(equipmentId));
  if (!row) return { ok: false, message: "Equipo no encontrado." };
  return { ok: true, row };
}

module.exports = {
  canonicalLogisticsStatus,
  syncEquipmentLocationFromShipment,
  getEquipmentOperationalLocation,
  getOpenShipmentForEquipment,
  restoreEquipmentLocationAfterShipmentRemoval,
  shipmentListSelect,
  mapShipmentRow,
  validateShipmentEquipment,
};
