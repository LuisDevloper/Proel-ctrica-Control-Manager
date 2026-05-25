const { getAuthSession } = require("../../main/ipc/auth");

const INVENTORY_MOVEMENT_TYPES = ["entrada", "salida", "ajuste"];

function mapInventoryMovementRow(row) {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    partName: row.part_name,
    sku: row.sku,
    movementType: row.movement_type,
    quantity: row.quantity,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceLabel: row.reference_label,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function resolveMovementReference(db, referenceType, referenceId) {
  if (!referenceType || referenceType === "manual" || !referenceId) {
    return { referenceType: "manual", referenceId: null, referenceLabel: null };
  }
  if (referenceType === "maintenance") {
    const row = db.prepare(`
      SELECT m.id, mo.code AS motor_code, m.maintenance_type
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      WHERE m.id = ?
    `).get(Number(referenceId));
    if (!row) return { ok: false, message: "Mantenimiento no encontrado." };
    return {
      referenceType,
      referenceId: row.id,
      referenceLabel: `${row.maintenance_type} — ${row.motor_code}`,
    };
  }
  if (referenceType === "external_shipment") {
    const row = db.prepare(`
      SELECT s.id, s.workshop_name,
        CASE WHEN s.equipment_type = 'motor' THEN m.code ELSE t.code END AS equipment_code
      FROM external_workshop_shipments s
      LEFT JOIN motors m ON s.equipment_type = 'motor' AND m.id = s.equipment_id
      LEFT JOIN turbinas t ON s.equipment_type = 'turbine' AND t.id = s.equipment_id
      WHERE s.id = ?
    `).get(Number(referenceId));
    if (!row) return { ok: false, message: "Envio a taller no encontrado." };
    return {
      referenceType,
      referenceId: row.id,
      referenceLabel: `${row.workshop_name} (${row.equipment_code || "equipo"})`,
    };
  }
  return { referenceType: "manual", referenceId: null, referenceLabel: null };
}

function applyInventoryMovement(db, payload, logActivity) {
  const itemId = Number(payload.inventoryItemId || payload.inventory_item_id);
  const movementType = String(payload.movementType || payload.movement_type || "entrada").toLowerCase();
  const qty = Math.abs(Number(payload.quantity));
  if (!INVENTORY_MOVEMENT_TYPES.includes(movementType)) {
    return { ok: false, message: "Tipo de movimiento no valido." };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, message: "La cantidad debe ser mayor a cero." };
  }

  const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(itemId);
  if (!item) return { ok: false, message: "Repuesto no encontrado." };

  const refRaw = payload.referenceType || payload.reference_type || "manual";
  const refId = payload.referenceId || payload.reference_id || null;
  const refResolved = resolveMovementReference(db, refRaw, refId);
  if (refResolved.ok === false) return refResolved;

  let referenceType = refResolved.referenceType || "manual";
  let referenceId = refResolved.referenceId;
  let referenceLabel = refResolved.referenceLabel;
  if (payload.referenceLabel || payload.reference_label) {
    referenceLabel = payload.referenceLabel || payload.reference_label;
  }

  const stockBefore = Number(item.quantity || 0);
  let stockAfter = stockBefore;
  if (movementType === "entrada") stockAfter = stockBefore + qty;
  else if (movementType === "salida") stockAfter = stockBefore - qty;
  else if (movementType === "ajuste") stockAfter = qty;

  if (movementType === "salida" && stockAfter < 0) {
    return { ok: false, message: `Stock insuficiente. Disponible: ${stockBefore}.` };
  }
  if (movementType === "ajuste" && stockAfter < 0) {
    return { ok: false, message: "El ajuste no puede dejar stock negativo." };
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE inventory_items SET quantity = ? WHERE id = ?").run(stockAfter, itemId);
  const result = db.prepare(`
    INSERT INTO inventory_movements (
      inventory_item_id, movement_type, quantity, stock_before, stock_after,
      reference_type, reference_id, reference_label, notes, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    movementType,
    qty,
    stockBefore,
    stockAfter,
    referenceType,
    referenceId,
    referenceLabel,
    payload.notes || "",
    payload.notes || "",
    getAuthSession()?.username || null,
    now
  );

  logActivity(
    db,
    null,
    movementType.toUpperCase(),
    "inventory_movements",
    result.lastInsertRowid,
    `${item.part_name} (${movementType} ${qty})`
  );

  return { ok: true, id: result.lastInsertRowid, stockAfter };
}

module.exports = {
  mapInventoryMovementRow,
  applyInventoryMovement,
};
