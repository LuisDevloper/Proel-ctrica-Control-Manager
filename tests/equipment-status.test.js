const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveEffectiveEquipmentStatus,
  countEquipmentByEffectiveStatus,
  countInMaintenance,
} = require("../src/modules/equipment/status");

describe("estado efectivo de equipos", () => {
  it("respeta estado explicito En mantenimiento", () => {
    assert.equal(
      resolveEffectiveEquipmentStatus({ status: "En mantenimiento", operationalLocation: "En planta" }),
      "En mantenimiento"
    );
  });

  it("cuenta mantenimiento abierto aunque el motor siga Operativo", () => {
    assert.equal(
      resolveEffectiveEquipmentStatus({
        status: "Operativo",
        operationalLocation: "En planta",
        hasOpenMaintenance: true,
      }),
      "En mantenimiento"
    );
  });

  it("usa ubicacion operativa En mantenimiento como respaldo", () => {
    assert.equal(
      resolveEffectiveEquipmentStatus({
        status: "Operativo",
        operationalLocation: "En mantenimiento",
      }),
      "En mantenimiento"
    );
  });

  it("no sobreescribe Fuera de servicio por mantenimiento abierto", () => {
    assert.equal(
      resolveEffectiveEquipmentStatus({
        status: "Fuera de servicio",
        hasOpenMaintenance: true,
      }),
      "Fuera de servicio"
    );
  });

  it("agrega conteos por estado efectivo", () => {
    const rows = [
      { status: "Operativo", operationalLocation: "En planta", hasOpenMaintenance: true },
      { status: "Operativo", operationalLocation: "En planta" },
      { status: "Fuera de servicio", operationalLocation: "En planta" },
    ];
    const counts = countEquipmentByEffectiveStatus(rows);
    assert.deepEqual(
      counts.map((r) => [r.status, r.count]),
      [
        ["Operativo", 1],
        ["En mantenimiento", 1],
        ["En almacen", 0],
        ["Fuera de servicio", 1],
      ]
    );
    assert.equal(countInMaintenance(rows), 1);
  });
});
