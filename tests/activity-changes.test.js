const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildUpdateDetails, valuesEqual } = require("../src/modules/activity/changes");

describe("buildUpdateDetails", () => {
  it("lista cambios campo a campo", () => {
    const details = buildUpdateDetails({
      summary: "Motor MOT-001",
      fields: [
        ["status", "Estado"],
        ["location", "Ubicacion"],
      ],
      before: { status: "Operativo", location: "Planta A" },
      after: { status: "En mantenimiento", location: "Planta A" },
    });
    assert.match(details, /Motor MOT-001/);
    assert.match(details, /Estado: Operativo -> En mantenimiento/);
    assert.doesNotMatch(details, /Ubicacion/);
  });

  it("normaliza vacios y numeros", () => {
    assert.ok(valuesEqual(null, ""));
    assert.ok(valuesEqual(5, "5"));
  });
});
