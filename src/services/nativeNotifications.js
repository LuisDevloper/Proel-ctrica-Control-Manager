/**
 * Notificaciones nativas de Windows.
 *
 * Comprueba alertas críticas cada 15 minutos y muestra una notificación
 * de sistema (toast de Windows) cuando hay mantenimientos vencidos,
 * fallas estancadas o repuestos en stock mínimo.
 *
 * Anti-spam: cada alerta se notifica solo UNA VEZ por día.
 * Al día siguiente se vuelve a notificar si sigue sin resolverse.
 */

const { Notification, BrowserWindow } = require("electron");
const Store = require("electron-store");

const notifStore = new Store({ name: "notifications-state" });

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // cada 15 minutos
const FIRST_CHECK_MS    = 45 * 1000;      // 45 s tras arrancar (BD necesita tiempo)

// ── Helpers ───────────────────────────────────────────────────────────────────

function focusMainWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

function todayKey() {
  return `notified_${new Date().toISOString().slice(0, 10)}`;
}

function getNotifiedToday() {
  return new Set(notifStore.get(todayKey(), []));
}

function markNotified(keys) {
  const k    = todayKey();
  const seen = getNotifiedToday();
  keys.forEach((id) => seen.add(id));
  notifStore.set(k, [...seen]);

  // Limpiar entradas de días anteriores
  for (const stored of Object.keys(notifStore.store)) {
    if (stored.startsWith("notified_") && stored !== k) {
      notifStore.delete(stored);
    }
  }
}

// ── Lógica de alertas ─────────────────────────────────────────────────────────

async function checkAndNotify(getDatabase) {
  let db;
  try {
    db = getDatabase();
  } catch {
    return; // BD todavía no inicializada
  }

  const notified = getNotifiedToday();

  const [overdue, stalled, lowStock] = await Promise.all([
    // Mantenimientos vencidos (fecha pasada, no completados)
    db.prepare(`
      SELECT 'overdue_' || m.id AS key,
             mo.code || ' — ' || m.maintenance_type AS label
      FROM maintenances m
      JOIN motors mo ON mo.id = m.motor_id
      WHERE m.maintenance_date::date < CURRENT_DATE
        AND m.status NOT IN ('Completado', 'Cancelado')
      ORDER BY m.maintenance_date
      LIMIT 20
    `).all(),

    // Fallas estancadas > 5 días sin resolver
    db.prepare(`
      SELECT 'stalled_' || f.id AS key,
             mo.code || ' — ' || f.failure_type AS label
      FROM failures f
      JOIN motors mo ON mo.id = f.motor_id
      WHERE f.status != 'Resuelta'
        AND f.reported_at::date < CURRENT_DATE - INTERVAL '5 days'
      ORDER BY f.reported_at
      LIMIT 20
    `).all(),

    // Repuestos en stock mínimo
    db.prepare(`
      SELECT 'stock_' || id AS key,
             part_name || ' (' || quantity || ' uds)' AS label
      FROM inventory_items
      WHERE quantity <= min_stock
      LIMIT 20
    `).all(),
  ]);

  const newOverdue  = overdue.filter((r)  => !notified.has(r.key));
  const newStalled  = stalled.filter((r)  => !notified.has(r.key));
  const newLowStock = lowStock.filter((r) => !notified.has(r.key));

  if (!newOverdue.length && !newStalled.length && !newLowStock.length) return;

  showGroup("Mantenimiento vencido",    newOverdue,  "Proeléctrica");
  showGroup("Falla sin resolver",       newStalled,  "Proeléctrica");
  showGroup("Repuesto en stock mínimo", newLowStock, "Proeléctrica");
}

function showGroup(title, items, appName) {
  if (!items.length) return;

  const body =
    items.length === 1
      ? items[0].label
      : `${items[0].label} y ${items.length - 1} más`;

  try {
    const notif = new Notification({
      title: `${appName} — ${title}`,
      body,
      timeoutType: "default",
    });

    notif.on("click", focusMainWindow);
    notif.show();

    markNotified(items.map((i) => i.key));
  } catch (err) {
    console.warn("[nativeNotifications] Error al mostrar notificación:", err?.message);
  }
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

function startNativeNotifications(getDatabase) {
  if (!Notification.isSupported()) {
    console.info("[nativeNotifications] No soportado en este sistema.");
    return;
  }

  setTimeout(() => {
    checkAndNotify(getDatabase).catch(() => {});
  }, FIRST_CHECK_MS);

  setInterval(() => {
    checkAndNotify(getDatabase).catch(() => {});
  }, CHECK_INTERVAL_MS);
}

module.exports = { startNativeNotifications };
