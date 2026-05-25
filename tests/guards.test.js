const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/main/ipc/auth");
const guards = require("../src/main/ipc/guards");

describe("guards IPC", () => {
  beforeEach(() => {
    auth.clearAuthSession();
  });

  it("deniega acceso sin sesion", () => {
    const denied = guards.denyIfNotAuthenticated();
    assert.equal(denied.ok, false);
    assert.match(denied.message, /Sesion no iniciada/);
  });

  it("permite acceso con sesion activa", () => {
    auth.setAuthSession({ id: 1, username: "test", role: "OPERADOR" });
    assert.equal(guards.denyIfNotAuthenticated(), null);
  });

  it("deniega escritura a rol VISOR", () => {
    auth.setAuthSession({ id: 2, username: "visor", role: "VISOR" });
    const denied = guards.denyIfVisor();
    assert.equal(denied.ok, false);
    assert.match(denied.message, /solo permite consultar/);
  });

  it("deniega acciones admin a no administradores", () => {
    auth.setAuthSession({ id: 3, username: "op", role: "OPERADOR" });
    const denied = guards.denyIfNotAdmin();
    assert.equal(denied.ok, false);
    assert.match(denied.message, /administrador/);
  });

  it("secureHandler aplica guard antes del handler", () => {
    let called = false;
    const handler = guards.secureHandler(guards.denyIfNotAuthenticated, () => {
      called = true;
      return { ok: true };
    });
    assert.deepEqual(handler(), { ok: false, message: guards.denyIfNotAuthenticated().message });
    assert.equal(called, false);

    auth.setAuthSession({ id: 1, username: "test", role: "OPERADOR" });
    assert.deepEqual(handler(), { ok: true });
    assert.equal(called, true);
  });
});
