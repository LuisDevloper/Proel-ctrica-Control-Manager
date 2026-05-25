const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/main/ipc/auth");
const { resolveActivityActor, createSecureLogActivity } = require("../src/main/ipc/activity");

describe("resolveActivityActor", () => {
  beforeEach(() => {
    auth.clearAuthSession();
  });

  it("devuelve sistema sin sesion", () => {
    assert.equal(resolveActivityActor(auth), "sistema");
  });

  it("usa el usuario de la sesion activa", () => {
    auth.setAuthSession({ id: 1, username: "operador1", role: "OPERADOR" });
    assert.equal(resolveActivityActor(auth), "operador1");
  });
});

describe("createSecureLogActivity", () => {
  beforeEach(() => {
    auth.clearAuthSession();
  });

  it("ignora username enviado por el cliente", () => {
    auth.setAuthSession({ id: 2, username: "admin_real", role: "ADMIN" });

    const inserts = [];
    const fakeDb = {
      prepare() {
        return {
          run(username, action) {
            inserts.push({ username, action });
          },
        };
      },
    };

    const logActivity = createSecureLogActivity(auth);
    logActivity(fakeDb, "usuario_falsificado", "UPDATE", "motors", 1, "detalle");

    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].username, "admin_real");
    assert.equal(inserts[0].action, "UPDATE");
  });
});
