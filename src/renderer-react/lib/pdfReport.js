import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  // Marca
  doc.setFontSize(15);
  doc.setTextColor(...HEADER_TEXT);
  doc.setFont("helvetica", "bold");
  doc.text("PROELECTRICA", 12, 13);  // jsPDF no soporta tildes en fuentes base — se muestra sin tilde en PDF
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 200, 230);
  doc.text("Control Manager", 12, 19);
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
    { header: "Codigo",      key: "code",          fmt: m => m.code || "" },
    { header: "Marca",       key: "brand",         fmt: m => m.brand || "" },
    { header: "Modelo",      key: "model",         fmt: m => m.model || "" },
    { header: "N\u00b0 Serie",key: "serial_number",fmt: m => m.serial_number || "" },
    { header: "Potencia",    key: "power",         fmt: m => m.power ? `${m.power} kW` : "" },
    { header: "Voltaje",     key: "voltage",       fmt: m => m.voltage ? `${m.voltage} V` : "" },
    { header: "RPM",         key: "rpm",           fmt: m => m.rpm || "" },
    { header: "Ubicacion",   key: "location",      fmt: m => m.location || "" },
    { header: "Estado",      key: "status",        fmt: m => m.status || "" },
    { header: "Instalacion", key: "installed_at",  fmt: m => m.installed_at || "" },
    { header: "Observaciones",key: "notes",        fmt: m => m.notes || "" },
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
    ["Codigo",       motor.code],
    ["Marca",        motor.brand],
    ["Modelo",       motor.model],
    ["N\u00b0 Serie",motor.serial_number],
    ["Potencia",     motor.power ? `${motor.power} kW` : null],
    ["Voltaje",      motor.voltage ? `${motor.voltage} V` : null],
    ["RPM",          motor.rpm],
    ["Ubicacion",    motor.location],
    ["Estado",       motor.status],
    ["Instalacion",  motor.installed_at],
    ["Observaciones",motor.notes],
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
