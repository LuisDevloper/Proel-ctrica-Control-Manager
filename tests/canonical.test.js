const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  canonicalMotorStatus,
  canonicalOperationalLocation,
  canonicalFromList,
  calendarMonthIsoRange,
} = require("../src/modules/equipment/canonical");

describe("canonical de equipos", () => {
  it("normaliza estado de motor con acentos", () => {
    const result = canonicalMotorStatus("en mantenimiento");
    assert.equal(result.status, "En mantenimiento");
    assert.equal(result.adjusted, true);
  });

  it("usa valor por defecto para estado vacio", () => {
    const result = canonicalMotorStatus("");
    assert.equal(result.status, "Operativo");
    assert.equal(result.adjusted, false);
  });

  it("canonicaliza ubicacion operativa", () => {
    assert.equal(canonicalOperationalLocation("taller externo"), "Taller externo");
    assert.equal(canonicalOperationalLocation("desconocido"), "En planta");
  });

  it("canonicalFromList respeta lista permitida", () => {
    assert.equal(canonicalFromList("Almacen", ["En planta", "Almacen"], "En planta"), "Almacen");
  });
});

describe("calendarMonthIsoRange", () => {
  it("devuelve rango ISO del mes", () => {
    assert.deepEqual(calendarMonthIsoRange(2026, 2), { from: "2026-02-01", to: "2026-02-28" });
  });

  it("usa mes actual si los parametros son invalidos", () => {
    const now = new Date();
    const { from, to } = calendarMonthIsoRange(null, null);
    assert.match(from, /^\d{4}-\d{2}-01$/);
    assert.match(to, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(from.slice(0, 4), String(now.getFullYear()));
  });
});
