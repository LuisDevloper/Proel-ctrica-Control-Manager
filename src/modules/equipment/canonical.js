const { MOTOR_ALLOWED_STATUSES, OPERATIONAL_LOCATIONS } = require("./constants");

function normStr(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function canonicalFromList(raw, allowed, fallback) {
  const rawStr = String(raw ?? "").trim();
  if (!rawStr) return fallback;
  const n = normStr(rawStr);
  for (const item of allowed) {
    if (normStr(item) === n) return item;
  }
  return fallback;
}

function canonicalMotorStatus(raw) {
  const rawStr = String(raw ?? "").trim();
  if (!rawStr) return { status: "Operativo", adjusted: false };
  const status = canonicalFromList(raw, MOTOR_ALLOWED_STATUSES, "Operativo");
  return { status, adjusted: status !== rawStr && rawStr.length > 0 };
}

function canonicalOperationalLocation(raw) {
  return canonicalFromList(raw, OPERATIONAL_LOCATIONS, "En planta");
}

/** Primer y último día del mes (month 1–12) en ISO YYYY-MM-DD para filtros SQLite. */
function calendarMonthIsoRange(year, month) {
  const y = Math.trunc(Number(year));
  const m = Math.trunc(Number(month));
  const now = new Date();
  const yy = Number.isFinite(y) && y > 0 ? y : now.getFullYear();
  const mm = Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastDay = new Date(yy, mm, 0).getDate();
  const to = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

module.exports = {
  normStr,
  canonicalFromList,
  canonicalMotorStatus,
  canonicalOperationalLocation,
  calendarMonthIsoRange,
};
