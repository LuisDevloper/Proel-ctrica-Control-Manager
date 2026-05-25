const { getAuthSession } = require("./auth");

function denyIfNotAuthenticated() {
  if (!getAuthSession()) {
    return { ok: false, message: "Sesion no iniciada. Inicia sesion de nuevo." };
  }
  return null;
}

function denyIfVisor() {
  const authDenied = denyIfNotAuthenticated();
  if (authDenied) return authDenied;
  if (getAuthSession().role === "VISOR") {
    return { ok: false, message: "Tu rol solo permite consultar datos." };
  }
  return null;
}

function denyIfNotAdmin() {
  const authDenied = denyIfNotAuthenticated();
  if (authDenied) return authDenied;
  if (getAuthSession().role !== "ADMIN") {
    return { ok: false, message: "Solo un administrador puede realizar esta accion." };
  }
  return null;
}

/** Envuelve un handler IPC aplicando un guard antes de ejecutarlo. */
function secureHandler(guardFn, handler) {
  return (...args) => {
    const denied = guardFn();
    if (denied) return denied;
    return handler(...args);
  };
}

module.exports = {
  denyIfNotAuthenticated,
  denyIfVisor,
  denyIfNotAdmin,
  secureHandler,
};
