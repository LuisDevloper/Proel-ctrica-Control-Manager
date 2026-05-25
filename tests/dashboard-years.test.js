const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseDashboardYear, parseDashboardMonth, formatDashboardPeriod, fillYearMonths } = require("../src/modules/dashboard/years");

describe("dashboard years", () => {
  it("normaliza el ano del filtro", () => {
    const current = new Date().getFullYear();
    assert.equal(parseDashboardYear(current), current);
    assert.equal(parseDashboardYear("2024"), 2024);
    assert.equal(parseDashboardYear("abc"), current);
    assert.equal(parseDashboardYear(1999), current);
  });

  it("normaliza el mes del filtro", () => {
    assert.equal(parseDashboardMonth(null), null);
    assert.equal(parseDashboardMonth(""), null);
    assert.equal(parseDashboardMonth("all"), null);
    assert.equal(parseDashboardMonth(3), 3);
    assert.equal(parseDashboardMonth("12"), 12);
    assert.equal(parseDashboardMonth(0), null);
    assert.equal(parseDashboardMonth(13), null);
  });

  it("formatea el periodo año o mes", () => {
    assert.equal(formatDashboardPeriod(2025, null), "2025");
    assert.equal(formatDashboardPeriod(2025, 3), "Marzo 2025");
  });

  it("completa los 12 meses del ano", () => {
    const rows = fillYearMonths([{ month: "2025-03", count: 2 }, { month: "2025-08", count: 5 }], 2025);
    assert.equal(rows.length, 12);
    assert.equal(rows[2].count, 2);
    assert.equal(rows[7].count, 5);
    assert.equal(rows[0].count, 0);
    assert.equal(rows[0].month, "2025-01");
  });
});
