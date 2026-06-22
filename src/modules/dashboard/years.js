const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseDashboardYear(value) {
  const current = new Date().getFullYear();
  const y = Number(value);
  if (!Number.isInteger(y) || y < 2000 || y > current + 1) return current;
  return y;
}

function parseDashboardMonth(value) {
  if (value === null || value === undefined || value === "" || value === "all") return null;
  const m = Number(value);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return m;
}

function buildYearMonthKey(year, month) {
  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

function formatDashboardPeriod(year, month) {
  if (!month) return String(year);
  const name = MONTH_NAMES[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

async function getAvailableYears(db) {
  const rows = await db.prepare(`
    SELECT year FROM (
      SELECT DISTINCT TO_CHAR(maintenance_date::date, 'YYYY') AS year
      FROM maintenances
      WHERE maintenance_date IS NOT NULL AND trim(maintenance_date) != ''
      UNION
      SELECT DISTINCT TO_CHAR(reported_at::date, 'YYYY') AS year
      FROM failures
      WHERE reported_at IS NOT NULL AND trim(reported_at) != ''
    ) sub
    WHERE year IS NOT NULL
    ORDER BY year DESC
  `).all();

  const years = rows.map((row) => String(row.year));
  const current = String(new Date().getFullYear());
  if (!years.includes(current)) years.unshift(current);
  return [...new Set(years)].sort((a, b) => Number(b) - Number(a));
}

function fillYearMonths(rows, year) {
  const map = Object.fromEntries((rows || []).map((row) => [row.month, Number(row.count) || 0]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { month, count: map[month] || 0 };
  });
}

module.exports = {
  parseDashboardYear,
  parseDashboardMonth,
  buildYearMonthKey,
  formatDashboardPeriod,
  getAvailableYears,
  fillYearMonths,
  MONTH_NAMES,
};
