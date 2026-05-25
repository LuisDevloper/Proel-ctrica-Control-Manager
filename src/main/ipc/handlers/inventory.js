function registerInventoryHandlers({ ipcMain, getDatabase, guards, inventory, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { mapInventoryMovementRow, applyInventoryMovement } = inventory;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNum } = require("../../../modules/activity/unchanged");

  const INVENTORY_UPDATE_FIELDS = [
    ["part_name", "Repuesto"],
    ["sku", "SKU"],
    ["min_stock", "Stock minimo"],
    ["location", "Ubicacion"],
  ];

  ipcMain.handle(
    "inventory:list",
    secureHandler(denyIfNotAuthenticated, () => {
      const db = getDatabase();
      return db.prepare(`
      SELECT i.*,
        (SELECT COUNT(*) FROM inventory_movements m WHERE m.inventory_item_id = i.id) AS movement_count
      FROM inventory_items i
      ORDER BY i.id DESC
    `).all();
    })
  );

  ipcMain.handle(
    "inventory:movements:list",
    secureHandler(denyIfNotAuthenticated, (_event, { itemId, limit = 200 } = {}) => {
      const db = getDatabase();
      let sql = `
      SELECT m.*, i.part_name, i.sku
      FROM inventory_movements m
      JOIN inventory_items i ON i.id = m.inventory_item_id
    `;
      const params = [];
      if (itemId) {
        sql += " WHERE m.inventory_item_id = ?";
        params.push(Number(itemId));
      }
      sql += " ORDER BY m.id DESC LIMIT ?";
      params.push(Math.min(Number(limit) || 200, 500));
      return db.prepare(sql).all(...params).map(mapInventoryMovementRow);
    })
  );

  ipcMain.handle("inventory:movements:create", async (_event, payload) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const tx = db.transaction(() => applyInventoryMovement(db, payload, logActivity));
    return tx();
  });

  ipcMain.handle("inventory:create", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const initialQty = Math.max(0, Number(item.quantity || 0));
    const result = db.prepare(`
      INSERT INTO inventory_items (part_name, sku, quantity, min_stock, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      item.partName,
      item.sku || "",
      0,
      Number(item.minStock || 0),
      item.location || "",
      new Date().toISOString()
    );
    const newId = result.lastInsertRowid;
    if (initialQty > 0) {
      applyInventoryMovement(db, {
        inventoryItemId: newId,
        movementType: "entrada",
        quantity: initialQty,
        referenceType: "manual",
        referenceLabel: "Stock inicial",
        notes: item.notes || "",
        _username: item._username,
      }, logActivity);
    }
    logActivity(db, item._username, "CREATE", "inventory_items", newId, item.partName);
    return { ok: true, id: newId };
  });

  ipcMain.handle("inventory:update", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const before = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(Number(item.id));
    if (!before) return { ok: false, message: "Repuesto no encontrado." };

    const after = {
      part_name: item.partName,
      sku: item.sku || "",
      min_stock: Number(item.minStock || 0),
      location: item.location || "",
    };

    if (isRowUnchanged(before, after, [
      { beforeKey: "part_name", normalize: normStr },
      { beforeKey: "sku", normalize: normStr },
      { beforeKey: "min_stock", normalize: normNum },
      { beforeKey: "location", normalize: normStr },
    ])) {
      return { ok: true, unchanged: true };
    }

    db.prepare(`
      UPDATE inventory_items
      SET part_name = ?, sku = ?, min_stock = ?, location = ?
      WHERE id = ?
    `).run(after.part_name, after.sku, after.min_stock, after.location, Number(item.id));

    logActivity(
      db,
      item._username,
      "UPDATE",
      "inventory_items",
      item.id,
      buildUpdateDetails({
        summary: before.part_name,
        fields: INVENTORY_UPDATE_FIELDS,
        before,
        after,
      })
    );
    return { ok: true };
  });

  ipcMain.handle("inventory:delete", async (_event, id) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const db = getDatabase();
    const row = db.prepare("SELECT part_name FROM inventory_items WHERE id = ?").get(Number(id));
    db.prepare("DELETE FROM inventory_movements WHERE inventory_item_id = ?").run(Number(id));
    db.prepare("DELETE FROM inventory_items WHERE id = ?").run(Number(id));
    logActivity(db, null, "DELETE", "inventory_items", id, row?.part_name || "");
    return { ok: true };
  });
}

module.exports = registerInventoryHandlers;
