function registerInventoryHandlers({ ipcMain, getDatabase, guards, inventory, logActivity }) {
  const { denyIfNotAuthenticated, denyIfVisor, secureHandler } = guards;
  const { mapInventoryMovementRow, applyInventoryMovement } = inventory;
  const { buildUpdateDetails } = require("../../../modules/activity/changes");
  const { isRowUnchanged, normStr, normNum } = require("../../../modules/activity/unchanged");
  const { validate, validateId, schemas } = require("../schemas");

  const INVENTORY_UPDATE_FIELDS = [
    ["part_name", "Repuesto"],
    ["sku", "SKU"],
    ["min_stock", "Stock minimo"],
    ["location", "Ubicacion"],
  ];

  ipcMain.handle(
    "inventory:list",
    secureHandler(denyIfNotAuthenticated, async () => {
      const db = getDatabase();
      return await db.prepare(`
      SELECT i.*,
        (SELECT COUNT(*) FROM inventory_movements m WHERE m.inventory_item_id = i.id) AS movement_count
      FROM inventory_items i
      ORDER BY i.id DESC
    `).all();
    })
  );

  ipcMain.handle(
    "inventory:movements:list",
    secureHandler(denyIfNotAuthenticated, async (_event, opts) => {
      const invalid = validate(schemas.inventoryMovementsListSchema, opts ?? {});
      if (invalid) return invalid;
      const { itemId, limit = 200 } = opts ?? {};
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
      const rows = await db.prepare(sql).all(...params);
      return rows.map(mapInventoryMovementRow);
    })
  );

  ipcMain.handle("inventory:movements:create", async (_event, payload) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.inventoryMovementCreateSchema, payload);
    if (invalid) return invalid;
    const db = getDatabase();
    return await applyInventoryMovement(db, payload, logActivity);
  });

  ipcMain.handle("inventory:create", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.inventoryCreateSchema, item);
    if (invalid) return invalid;
    const db = getDatabase();
    const initialQty = Math.max(0, Number(item.quantity || 0));
    const result = await db.prepare(`
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
      await applyInventoryMovement(db, {
        inventoryItemId: newId,
        movementType: "entrada",
        quantity: initialQty,
        referenceType: "manual",
        referenceLabel: "Stock inicial",
        notes: item.notes || "",
        _username: item._username,
      }, logActivity);
    }
    await logActivity(db, item._username, "CREATE", "inventory_items", newId, item.partName);
    return { ok: true, id: newId };
  });

  ipcMain.handle("inventory:update", async (_event, item) => {
    const denied = denyIfVisor();
    if (denied) return denied;
    const invalid = validate(schemas.inventoryUpdateSchema, item);
    if (invalid) return invalid;
    const db = getDatabase();
    const before = await db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(Number(item.id));
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

    await db.prepare(`
      UPDATE inventory_items
      SET part_name = ?, sku = ?, min_stock = ?, location = ?
      WHERE id = ?
    `).run(after.part_name, after.sku, after.min_stock, after.location, Number(item.id));

    await logActivity(
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
    const invalid = validateId(id);
    if (invalid) return invalid;
    const db = getDatabase();
    const row = await db.prepare("SELECT part_name FROM inventory_items WHERE id = ?").get(Number(id));
    await db.prepare("DELETE FROM inventory_movements WHERE inventory_item_id = ?").run(Number(id));
    await db.prepare("DELETE FROM inventory_items WHERE id = ?").run(Number(id));
    await logActivity(db, null, "DELETE", "inventory_items", id, row?.part_name || "");
    return { ok: true };
  });
}

module.exports = registerInventoryHandlers;
