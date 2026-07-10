import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEquipmentCondition } from "./equipment";
import logoUrl from "/logo-excel.png";

// Paleta para impresión (fondo blanco)
const HEADER_BG   = [15,  40,  80];   // azul oscuro — cabecera
const HEADER_TEXT = [255, 255, 255];  // blanco
const TABLE_HEAD  = [30,  60, 110];   // azul medio — cabecera de tabla
const TABLE_ALT   = [240, 245, 252];  // azul muy claro — filas alternas
const TEXT_DARK   = [20,  30,  45];   // casi negro — texto principal
const TEXT_MUTED  = [90, 110, 140];   // gris azulado — subtítulos
const ACCENT      = [47, 141, 255];   // azul acento

const tableStyles = {
  headStyles: {
    fillColor: TABLE_HEAD,
    textColor: HEADER_TEXT,
    fontSize: 8,
    fontStyle: "bold",
    cellPadding: 4,
  },
  bodyStyles: {
    fillColor: [255, 255, 255],
    textColor: TEXT_DARK,
    fontSize: 8,
    cellPadding: 3.5,
  },
  alternateRowStyles: { fillColor: TABLE_ALT },
  styles: { lineColor: [210, 220, 235], lineWidth: 0.2 },
  margin: { left: 14, right: 14 },
};

function addHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  // Fondo cabecera
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, w, 32, "F");
  // Acento lateral
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 4, 32, "F");
  // Logo
  try {
    doc.addImage(logoUrl, "PNG", 7, 4, 22, 22);
  } catch (_) {
    // Si falla la carga del logo, continúa sin él
  }
  // Título centrado
  doc.setFontSize(13);
  doc.setTextColor(...HEADER_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text(title, w / 2, 13, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 200, 230);
  doc.text(subtitle, w / 2, 20, { align: "center" });
  // Fecha
  const dateStr = new Date().toLocaleString("es-CO");
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 230);
  doc.text(dateStr, w - 12, 14, { align: "right" });
}

function addFooter(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 245, 252);
    doc.rect(0, h - 14, w, 14, "F");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Proelectrica Control Manager \u2014 Documento confidencial", 14, h - 5);
    doc.text(`Pagina ${i} de ${pages}`, w - 14, h - 5, { align: "right" });
  }
}

function infoGrid(doc, pairs, startY) {
  let y = startY;
  const colW = 85;
  pairs.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 14 + col * colW;
    const cy = y + row * 10;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label.toUpperCase(), x, cy);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(String(value || "—"), x, cy + 5);
  });
  const rows = Math.ceil(pairs.length / 2);
  return y + rows * 10 + 4;
}

export function exportMotoresPDF(motors) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REGISTRO DE MOTORES", `Total: ${motors.length} motores — ${new Date().toLocaleDateString("es-CO")}`);

  // Definir todas las columnas posibles
  const ALL_COLS = [
    { header: "Codigo",          key: "code",          fmt: m => m.code || "" },
    { header: "Marca",           key: "brand",         fmt: m => m.brand || "" },
    { header: "Modelo",          key: "model",         fmt: m => m.model || "" },
    { header: "No. Serie",       key: "serial_number", fmt: m => m.serial_number || "" },
    { header: "Potencia",        key: "power",         fmt: m => m.power ? `${m.power} kW` : "" },
    { header: "Voltaje",         key: "voltage",       fmt: m => m.voltage ? `${m.voltage} V` : "" },
    { header: "RPM",             key: "rpm",           fmt: m => m.rpm || "" },
    { header: "Ubicacion",       key: "location",      fmt: m => m.location || "" },
    { header: "Estado",          key: "status",        fmt: m => m.status || "" },
    { header: "Instalacion",     key: "installed_at",  fmt: m => m.installed_at || "" },
    { header: "Observaciones",   key: "notes",         fmt: m => m.notes || "" },
  ];

  // Solo columnas que tengan al menos un valor no vacío
  const cols = ALL_COLS.filter(c => motors.some(m => !!c.fmt(m)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: motors.map(m => cols.map(c => c.fmt(m))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`motores_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportTurbinasPDF(turbinas) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REGISTRO DE TURBINAS", `Total: ${turbinas.length} turbinas — ${new Date().toLocaleDateString("es-CO")}`);

  const ALL_COLS = [
    { header: "Codigo",       fmt: t => t.code || "" },
    { header: "No. Serie",    fmt: t => t.serial_number || "" },
    { header: "GG",           fmt: t => t.gg || "" },
    { header: "PT",           fmt: t => t.pt || "" },
    { header: "Rodamiento 1", fmt: t => t.bearing_1 || "" },
    { header: "Rodamiento 2", fmt: t => t.bearing_2 || "" },
    { header: "Ubicacion",    fmt: t => t.operational_location || "" },
    { header: "Estado",       fmt: t => t.status || "" },
    { header: "Motor vinc.",  fmt: t => t.motor_code || "" },
    { header: "Runtime retiro", fmt: t => t.runtime_retiro || "" },
    { header: "Notas",        fmt: t => (t.notes || "").slice(0, 40) },
  ];

  const cols = ALL_COLS.filter(c => turbinas.some(t => !!c.fmt(t)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: turbinas.map(t => cols.map(c => c.fmt(t))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`turbinas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportMaintenancesPDF(maintenances) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REPORTE DE MANTENIMIENTOS", `Total: ${maintenances.length} registros — ${new Date().toLocaleDateString("es-CO")}`);

  const ALL_COLS = [
    { header: "Motor",       fmt: m => m.motor_code || "" },
    { header: "Tipo",        fmt: m => m.maintenance_type || "" },
    { header: "Fecha",       fmt: m => m.maintenance_date || "" },
    { header: "Estado",      fmt: m => m.status || "Pendiente" },
    { header: "Tecnico",     fmt: m => m.technician_name || "" },
    { header: "Costo",       fmt: m => m.cost ? "$" + Number(m.cost).toLocaleString("es-CO") : "" },
    { header: "Descripcion", fmt: m => (m.description || "").slice(0, 55) },
  ];
  const cols = ALL_COLS.filter(c => maintenances.some(m => !!c.fmt(m)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: maintenances.map(m => cols.map(c => c.fmt(m))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`mantenimientos_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportTechniciansPDF(technicians) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REGISTRO DE TECNICOS", `Total: ${technicians.length} tecnicos — ${new Date().toLocaleDateString("es-CO")}`);

  const ALL_COLS = [
    { header: "Nombre",       fmt: t => t.full_name || "" },
    { header: "Especialidad", fmt: t => t.specialty || "" },
    { header: "Telefono",     fmt: t => t.phone || "" },
    { header: "Correo",       fmt: t => t.email || "" },
    { header: "Registrado",   fmt: t => (t.created_at ? String(t.created_at).slice(0, 10) : "") },
  ];
  const cols = ALL_COLS.filter(c => technicians.some(t => !!c.fmt(t)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: technicians.map(t => cols.map(c => c.fmt(t))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`tecnicos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportInventoryPDF(items) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "INVENTARIO DE REPUESTOS", `Total: ${items.length} articulos — ${new Date().toLocaleDateString("es-CO")}`);

  const ALL_COLS = [
    { header: "Repuesto",     fmt: i => i.part_name || "" },
    { header: "SKU / Codigo", fmt: i => i.sku || "" },
    { header: "Cantidad",     fmt: i => (i.quantity != null ? String(i.quantity) : "") },
    { header: "Stock min.",   fmt: i => (i.min_stock != null ? String(i.min_stock) : "") },
    { header: "Estado stock", fmt: i => (Number(i.quantity) <= Number(i.min_stock) ? "Bajo" : "OK") },
    { header: "Ubicacion",    fmt: i => i.location || "" },
    { header: "Registrado",   fmt: i => (i.created_at ? String(i.created_at).slice(0, 10) : "") },
  ];
  const cols = ALL_COLS.filter(c => items.some(i => !!c.fmt(i)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: items.map(i => cols.map(c => c.fmt(i))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportFailuresPDF(failures) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REPORTE DE FALLAS", `Total: ${failures.length} registros — ${new Date().toLocaleDateString("es-CO")}`);

  const ALL_COLS = [
    { header: "Motor",        fmt: f => f.motor_code || "" },
    { header: "Tipo de falla",fmt: f => f.failure_type || "" },
    { header: "Prioridad",    fmt: f => f.priority || "" },
    { header: "Estado",       fmt: f => f.status || "" },
    { header: "Fecha",        fmt: f => f.reported_at || "" },
    { header: "Tecnico",      fmt: f => f.technician_name || "" },
    { header: "Solucion",     fmt: f => (f.solution || "").slice(0, 50) },
  ];
  const cols = ALL_COLS.filter(c => failures.some(f => !!c.fmt(f)));

  autoTable(doc, {
    startY: 38,
    head: [cols.map(c => c.header)],
    body: failures.map(f => cols.map(c => c.fmt(f))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`fallas_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportMotorDetailPDF(motor, maintenances, failures) {
  const doc = new jsPDF();
  addHeader(doc, `MOTOR: ${motor.code}`, `${motor.brand} ${motor.model || ""} — ${motor.status}`);

  // Sección info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text("INFORMACION DEL MOTOR", 14, 40);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(14, 42, 196, 42);

  const infoEnd = infoGrid(doc, [
    ["Codigo",          motor.code],
    ["Marca",           motor.brand],
    ["Modelo",          motor.model],
    ["Numero de serie", motor.serial_number],
    ["Potencia",        motor.power ? `${motor.power} kW` : null],
    ["Voltaje",         motor.voltage ? `${motor.voltage} V` : null],
    ["RPM",             motor.rpm],
    ["Ubicacion",       motor.location],
    ["Estado",          motor.status],
    ["Instalacion",     motor.installed_at],
    ["Observaciones",   motor.notes],
  ].filter(([, v]) => v), 46);

  // Mantenimientos
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(`HISTORIAL DE MANTENIMIENTOS (${maintenances.length})`, 14, infoEnd + 2);
  doc.line(14, infoEnd + 4, 196, infoEnd + 4);

  const mtnCols = [
    { header: "Tipo",        fmt: m => m.maintenance_type || "" },
    { header: "Fecha",       fmt: m => m.maintenance_date || "" },
    { header: "Estado",      fmt: m => m.status || "Pendiente" },
    { header: "Tecnico",     fmt: m => m.technician_name || "" },
    { header: "Costo",       fmt: m => m.cost ? "$" + Number(m.cost).toLocaleString("es-CO") : "" },
    { header: "Descripcion", fmt: m => (m.description || "").slice(0, 45) },
  ].filter(c => maintenances.some(m => !!c.fmt(m)));

  autoTable(doc, {
    startY: infoEnd + 6,
    head: [mtnCols.map(c => c.header)],
    body: maintenances.map(m => mtnCols.map(c => c.fmt(m))),
    ...tableStyles,
  });

  // Fallas
  const y2 = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(`HISTORIAL DE FALLAS (${failures.length})`, 14, y2);
  doc.setDrawColor(...ACCENT);
  doc.line(14, y2 + 2, 196, y2 + 2);

  const failCols = [
    { header: "Tipo",      fmt: f => f.failure_type || "" },
    { header: "Prioridad", fmt: f => f.priority || "" },
    { header: "Estado",    fmt: f => f.status || "" },
    { header: "Fecha",     fmt: f => f.reported_at || "" },
    { header: "Tecnico",   fmt: f => f.technician_name || "" },
    { header: "Solucion",  fmt: f => (f.solution || "").slice(0, 45) },
  ].filter(c => failures.some(f => !!c.fmt(f)));

  autoTable(doc, {
    startY: y2 + 4,
    head: [failCols.map(c => c.header)],
    body: failures.map(f => failCols.map(c => c.fmt(f))),
    ...tableStyles,
  });

  addFooter(doc);
  doc.save(`motor_${motor.code}_${new Date().toISOString().slice(0,10)}.pdf`);
}

function fmtPdfDate(value) {
  if (!value) return "—";
  const s = String(value).slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function shipmentEquipmentLabel(shipment) {
  const type = shipment.equipmentType === "turbine" ? "Turbina" : "Motor";
  const code = shipment.equipmentCode || "—";
  if (shipment.equipmentType === "motor" && shipment.equipmentBrand) {
    return `${type} ${code} — ${shipment.equipmentBrand}`;
  }
  if (shipment.equipmentType === "turbine" && shipment.equipmentGg) {
    return `${type} ${code} — GG ${shipment.equipmentGg}`;
  }
  return `${type} ${code}`;
}

function addSectionHeader(doc, title, y) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(title, 14, y);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(14, y + 2, 196, y + 2);
  return y + 8;
}

function addLabeledBlock(doc, label, text, x, y, maxWidth = 182) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  const lines = doc.splitTextToSize(String(text || "—"), maxWidth);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4.5 + 5;
}

function addSignatureBlock(doc, label, x, y, width = 80) {
  doc.setDrawColor(...TEXT_MUTED);
  doc.setLineWidth(0.35);
  doc.line(x, y, x + width, y);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(label, x, y + 4);
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Nombre:", x, y + 10);
  doc.text("Fecha:", x, y + 16);
}

function fmtMonthLabel(ym, short = false) {
  if (!ym) return "";
  const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const MONTHS_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${(short ? MONTHS_SHORT : MONTHS_FULL)[idx]} ${y}`;
}

const DASHBOARD_EQUIPMENT_STATUSES = ["Operativo", "En mantenimiento", "En almacen", "Fuera de servicio"];

function countStatusRows(raw) {
  return (raw || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

function reconcileTurbinasStatusForReport(raw, totalFromStats) {
  const rows = [...(raw || [])];
  const listed = countStatusRows(rows);
  const expected = Number(totalFromStats);
  if (!Number.isFinite(expected) || expected <= listed) return rows;
  const extra = expected - listed;
  const operativo = rows.find((r) => r.status === "Operativo");
  if (operativo) operativo.count = Number(operativo.count) + extra;
  else rows.push({ status: "Operativo", count: extra });
  return rows;
}

function mergeEquipmentStatusForReport(motorsRaw, turbinasRaw) {
  const map = Object.fromEntries(DASHBOARD_EQUIPMENT_STATUSES.map((status) => [status, 0]));
  for (const row of [...(motorsRaw || []), ...(turbinasRaw || [])]) {
    const status = row.status;
    if (status in map) map[status] += Number(row.count) || 0;
    else map[status] = (map[status] || 0) + (Number(row.count) || 0);
  }
  return DASHBOARD_EQUIPMENT_STATUSES.map((status) => ({ status, count: map[status] || 0 }));
}

function buildDashboardAlerts(stats) {
  return [
    stats?.upcomingMaintenances > 0 && `${stats.upcomingMaintenances} mantenimientos en los proximos 7 dias.`,
    stats?.pendingFailures > 0 && `${stats.pendingFailures} fallas pendientes por resolver.`,
    stats?.lowStockItems > 0 && `${stats.lowStockItems} repuestos en stock minimo.`,
    stats?.pendingShipments > 0 && `${stats.pendingShipments} equipos en taller externo (envio abierto).`,
  ].filter(Boolean);
}

function addBulletList(doc, items, startY) {
  let y = startY;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  for (const item of items) {
    const lines = doc.splitTextToSize(`• ${item}`, 178);
    doc.text(lines, 16, y);
    y += lines.length * 4.8 + 2;
  }
  return y + 2;
}

/** Reporte ejecutivo del dashboard para gerencia. */
export function exportDashboardPDF(stats, charts, year, month) {
  if (!stats) return;

  const reportYear = year || charts?.year || new Date().getFullYear();
  const periodLabel = charts?.periodLabel || (month
    ? `${String(month).padStart(2, "0")}/${reportYear}`
    : String(reportYear));
  const doc = new jsPDF();
  const reportDate = new Date().toLocaleDateString("es-CO");
  addHeader(doc, "REPORTE EJECUTIVO", `Dashboard operativo — ${periodLabel} — ${reportDate}`);

  let y = addSectionHeader(doc, "INDICADORES CLAVE (estado actual)", 38);
  y = infoGrid(doc, [
    ["Motores registrados", stats.totalMotors ?? 0],
    ["Turbinas registradas", stats.totalTurbinas ?? 0],
    ["En mantenimiento", stats.inMaintenance ?? 0],
    ["Fuera de servicio", stats.outOfService ?? 0],
    ["Mantenimientos totales (historico)", stats.totalMaintenances ?? 0],
    ["Fallas pendientes", stats.pendingFailures ?? 0],
    ["Tecnicos activos", stats.totalTechnicians ?? 0],
    ["Repuestos en stock minimo", stats.lowStockItems ?? 0],
    ["Mantenimientos proximos (7 dias)", stats.upcomingMaintenances ?? 0],
    ["Equipos en taller externo", stats.pendingShipments ?? 0],
  ], y);

  if (charts?.yearTotals) {
    y = addSectionHeader(doc, `RESUMEN DEL PERIODO (${periodLabel})`, y + 4);
    y = infoGrid(doc, [
      ["Mantenimientos en el periodo", charts.yearTotals.maintenancesInYear ?? 0],
      ["Fallas en el periodo", charts.yearTotals.failuresInYear ?? 0],
      ["Costo de mantenimiento", "$" + Number(charts.yearTotals.maintenanceCostInYear || 0).toLocaleString("es-CO")],
    ], y);
  }

  const alerts = buildDashboardAlerts(stats);
  y = addSectionHeader(doc, alerts.length ? "ALERTAS ACTIVAS" : "ALERTAS ACTIVAS — Sin alertas", y + 4);
  if (alerts.length) {
    y = addBulletList(doc, alerts, y);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("No hay alertas operativas en este momento.", 14, y);
    y += 8;
  }

  const equipmentMerged = mergeEquipmentStatusForReport(
    charts?.motorsByStatus,
    reconcileTurbinasStatusForReport(charts?.turbinasByStatus, stats.totalTurbinas)
  );
  const equipmentTotal = equipmentMerged.reduce((s, r) => s + r.count, 0);
  const motorTotal = Number(stats.totalMotors) || countStatusRows(charts?.motorsByStatus);
  const turbinaTotal = Number(stats.totalTurbinas) || countStatusRows(charts?.turbinasByStatus);

  y = addSectionHeader(
    doc,
    `ESTADO DE EQUIPOS (${equipmentTotal} total — Motores: ${motorTotal}, Turbinas: ${turbinaTotal})`,
    y + 4
  );

  autoTable(doc, {
    startY: y,
    head: [["Estado", "Cantidad", "% del total"]],
    body: equipmentMerged.map((row) => [
      row.status,
      String(row.count),
      equipmentTotal > 0 ? `${Math.round((row.count / equipmentTotal) * 100)}%` : "0%",
    ]),
    ...tableStyles,
  });

  y = doc.lastAutoTable.finalY + 8;

  const maintenancesByMonth = charts?.maintenancesByMonth || [];
  y = addSectionHeader(doc, `MANTENIMIENTOS POR MES (${periodLabel})`, y);
  if (maintenancesByMonth.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Sin registros en el periodo.", 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Mes", "Mantenimientos"]],
      body: maintenancesByMonth.map((row) => [
        fmtMonthLabel(row.month, false),
        String(row.count),
      ]),
      ...tableStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  const failuresByMonth = charts?.failuresByMonth || [];
  y = addSectionHeader(doc, `FALLAS POR MES (${periodLabel})`, y);
  if (failuresByMonth.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Sin registros en el periodo.", 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Mes", "Fallas reportadas"]],
      body: failuresByMonth.map((row) => [
        fmtMonthLabel(row.month, false),
        String(row.count),
      ]),
      ...tableStyles,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  const costByMotor = charts?.costByMotor || [];
  if (costByMotor.length > 0) {
    y = addSectionHeader(doc, `COSTO ACUMULADO DE MANTENIMIENTO POR MOTOR (${periodLabel}, Top 10)`, y);
    autoTable(doc, {
      startY: y,
      head: [["Motor", "Costo acumulado"]],
      body: costByMotor.map((row) => [
        row.motor || "—",
        row.total != null ? "$" + Number(row.total).toLocaleString("es-CO") : "—",
      ]),
      ...tableStyles,
    });
  }

  addFooter(doc);
  doc.save(`reporte_dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Permiso formal de salida y registro de entrada — taller externo. */
export function exportShipmentPermitPDF(shipment) {
  if (!shipment) return;
  const doc = new jsPDF();
  const folio = `ENV-${String(shipment.id).padStart(4, "0")}`;
  const entryDone = ["Entrada registrada", "Equipo entregado"].includes(shipment.logisticsStatus);

  addHeader(
    doc,
    "PERMISO DE SALIDA Y ENTRADA",
    `${shipmentEquipmentLabel(shipment)} — Folio ${folio}`
  );

  let y = 38;
  doc.setFillColor(...TABLE_ALT);
  doc.roundedRect(14, y - 4, 182, 10, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`Estado logistica actual: ${shipment.logisticsStatus || "—"}`, 18, y + 2);
  y += 14;

  y = addSectionHeader(doc, "DATOS DEL EQUIPO", y);
  y = infoGrid(doc, [
    ["Folio", folio],
    ["Equipo", shipmentEquipmentLabel(shipment)],
    ["Tipo", shipment.equipmentType === "turbine" ? "Turbina" : "Motor"],
    ["Codigo", shipment.equipmentCode || "—"],
    ["Estado del equipo", formatEquipmentCondition(shipment.equipmentCondition)],
    ["Registrado por", shipment.createdBy || "—"],
  ], y);

  y = addSectionHeader(doc, "PERMISO DE SALIDA", y + 4);
  y = infoGrid(doc, [
    ["Taller externo", shipment.workshopName || "—"],
    ["Responsable", shipment.responsible || "—"],
    ["Fecha de salida", fmtPdfDate(shipment.departureDate)],
    ["Retorno estimado", fmtPdfDate(shipment.expectedReturnDate)],
  ], y);
  y = addLabeledBlock(doc, "Motivo del envio", shipment.motive, 14, y + 2);

  y = addSectionHeader(doc, "REGISTRO DE ENTRADA", y + 2);
  y = infoGrid(doc, [
    ["Fecha de entrada", fmtPdfDate(shipment.actualReturnDate)],
    ["Estado al retorno", entryDone ? formatEquipmentCondition(shipment.equipmentCondition) : "Pendiente de registro"],
    ["Entrega completada", entryDone ? "Si" : "No"],
  ], y);

  if (shipment.notes) {
    y = addLabeledBlock(doc, "Observaciones", shipment.notes, 14, y + 2);
  }

  y += 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    "Documento de control interno para autorizacion de salida de equipo y registro de reingreso a planta.",
    14,
    y
  );

  const signY = Math.max(y + 14, 220);
  addSignatureBlock(doc, "Autoriza salida (planta)", 14, signY, 82);
  addSignatureBlock(doc, "Recibe en taller externo", 108, signY, 82);
  addSignatureBlock(doc, "Registra entrada (planta)", 14, signY + 32, 82);

  addFooter(doc);
  const slug = String(shipment.equipmentCode || "equipo").replace(/[^\w-]+/g, "_");
  doc.save(`permiso_salida_entrada_${slug}_${folio}.pdf`);
}
