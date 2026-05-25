const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createTestDatabase } = require("./helpers/test-db");
const {
  syncEquipmentLocationFromShipment,
  restoreEquipmentLocationAfterShipmentRemoval,
  getEquipmentOperationalLocation,
} = require("../src/modules/shipments");

describe("ubicacion operativa en envios", () => {
  it("mueve equipo a Taller externo al crear envio abierto", () => {
    const db = createTestDatabase();
    db.prepare("INSERT INTO motors (code, brand, operational_location) VALUES (?, ?, ?)").run("M-01", "ABB", "En planta");

    syncEquipmentLocationFromShipment(db, "motor", 1, "Equipo en transito");
    assert.equal(getEquipmentOperationalLocation(db, "motor", 1), "Taller externo");
  });

  it("restaura ubicacion previa al eliminar envio abierto", () => {
    const db = createTestDatabase();
    db.prepare("INSERT INTO motors (code, brand, operational_location) VALUES (?, ?, ?)").run("M-02", "Siemens", "Taller externo");

    const shipment = {
      equipment_type: "motor",
      equipment_id: 1,
      previous_operational_location: "Afuera",
      logistics_status: "Equipo en transito",
    };

    restoreEquipmentLocationAfterShipmentRemoval(db, shipment);
    assert.equal(getEquipmentOperationalLocation(db, "motor", 1), "Afuera");
  });

  it("no restaura si queda otro envio abierto para el mismo equipo", () => {
    const db = createTestDatabase();
    db.prepare("INSERT INTO motors (code, brand, operational_location) VALUES (?, ?, ?)").run("M-03", "WEG", "Taller externo");
    db.prepare(`
      INSERT INTO external_workshop_shipments (
        equipment_type, equipment_id, workshop_name, logistics_status, previous_operational_location
      ) VALUES ('motor', 1, 'Taller A', 'Equipo en transito', 'En planta')
    `).run();
    db.prepare(`
      INSERT INTO external_workshop_shipments (
        equipment_type, equipment_id, workshop_name, logistics_status, previous_operational_location
      ) VALUES ('motor', 1, 'Taller B', 'Permiso de salida aprobado', 'Afuera')
    `).run();

    const closing = db.prepare("SELECT * FROM external_workshop_shipments WHERE id = 2").get();
    restoreEquipmentLocationAfterShipmentRemoval(db, closing, 2);

    assert.equal(getEquipmentOperationalLocation(db, "motor", 1), "Taller externo");
  });
});
