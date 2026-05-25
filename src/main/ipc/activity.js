const { logError } = require("../../services/logger");

function resolveActivityActor(auth) {
  if (!auth || typeof auth.getAuthSession !== "function") return "sistema";
  return auth.getAuthSession()?.username || "sistema";
}

function logActivity(db, username, action, entity, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO activity_log (username, action, entity, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username || "sistema", action, entity, entityId || null, details || null, new Date().toISOString());
  } catch (err) {
    logError("activity_log.insert_failed", err, { action, entity, entityId: entityId ?? null });
  }
}

/** Ignora username del cliente; usa siempre la sesion activa en main. */
function createSecureLogActivity(auth) {
  return function secureLogActivity(db, _ignoredUsername, action, entity, entityId, details) {
    logActivity(db, resolveActivityActor(auth), action, entity, entityId, details);
  };
}

module.exports = { logActivity, resolveActivityActor, createSecureLogActivity };
