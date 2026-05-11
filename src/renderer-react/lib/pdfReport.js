import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DARK  = [7, 11, 16];
const PANEL = [17, 26, 39];
const BLUE  = [47, 141, 255];
const MUTED = [154, 176, 199];
const WHITE = [234, 242, 251];

function addHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, w, 30, "F");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("PROELECTRICA", 14, 13);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Control Manager", 14, 19);
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(title, w / 2, 13, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(subtitle, w / 2, 19, { align: "center" });
  const dateStr = new Date().toLocaleString("es");
  doc.text(dateStr, w - 14, 13, { align: "right" });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(0, 30, w, 30);
}

function addFooter(doc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PANEL);
    doc.setLineWidth(0.3);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Proelectrica Control Manager — Documento confidencial", 14, h - 6);
    doc.text(`Pagina ${i} de ${pages}`, w - 14, h - 6, { align: "right" });
  }
}

const tableStyles = {
  headStyles:  { fillColor: PANEL, textColor: MUTED, fontSize: 8, fontStyle: "bold" },
  bodyStyles:  { fillColor: DARK,  textColor: WHITE, fontSize: 8 },
  alternateRowStyles: { fillColor: [13, 22, 37] },
  styles: { cellPadding: 3, lineColor: PANEL, lineWidth: 0.2 },
  margin: { left: 14, right: 14 }
};

export function exportMaintenancesPDF(maintenances) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REPORTE DE MANTENIMIENTOS", `Total: ${maintenances.length} registros`);

  autoTable(doc, {
    startY: 36,
    head: [["Motor", "Tipo", "Fecha", "Tecnico", "Costo ($)", "Descripcion"]],
    body: maintenances.map(m => [
      m.motor_code || "",
      m.maintenance_type || "",
      m.maintenance_date || "",
      m.technician_name || "No asignado",
      m.cost ? Number(m.cost).toFixed(2) : "0.00",
      (m.description || "").slice(0, 60)
    ]),
    ...tableStyles
  });

  addFooter(doc);
  doc.save(`mantenimientos_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportFailuresPDF(failures) {
  const doc = new jsPDF({ orientation: "landscape" });
  addHeader(doc, "REPORTE DE FALLAS", `Total: ${failures.length} registros`);

  autoTable(doc, {
    startY: 36,
    head: [["Motor", "Tipo de falla", "Prioridad", "Estado", "Fecha", "Tecnico", "Solucion"]],
    body: failures.map(f => [
      f.motor_code || "",
      f.failure_type || "",
      f.priority || "",
      f.status || "",
      f.reported_at || "",
      f.technician_name || "No asignado",
      (f.solution || "Pendiente").slice(0, 50)
    ]),
    ...tableStyles
  });

  addFooter(doc);
  doc.save(`fallas_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportMotorDetailPDF(motor, maintenances, failures) {
  const doc = new jsPDF();
  addHeader(doc, `MOTOR: ${motor.code}`, `${motor.brand} ${motor.model || ""} — ${motor.status}`);

  // Info del motor
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("INFORMACION DEL MOTOR", 14, 40);
  doc.setTextColor(...WHITE);
  const info = [
    ["Codigo", motor.code], ["Marca", motor.brand], ["Modelo", motor.model || "—"],
    ["Ubicacion", motor.location || "—"], ["Estado", motor.status], ["Notas", motor.notes || "—"]
  ];
  let y = 44;
  info.forEach(([label, val]) => {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, 14, y);
    doc.setTextColor(...WHITE);
    doc.text(String(val), 50, y);
    y += 6;
  });

  // Mantenimientos
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`HISTORIAL DE MANTENIMIENTOS (${maintenances.length})`, 14, y + 4);
  autoTable(doc, {
    startY: y + 8,
    head: [["Tipo", "Fecha", "Tecnico", "Costo", "Descripcion"]],
    body: maintenances.map(m => [m.maintenance_type, m.maintenance_date, m.technician_name || "—", `$${m.cost || 0}`, (m.description || "").slice(0,40)]),
    ...tableStyles
  });

  // Fallas
  const y2 = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`HISTORIAL DE FALLAS (${failures.length})`, 14, y2);
  autoTable(doc, {
    startY: y2 + 4,
    head: [["Tipo", "Prioridad", "Estado", "Fecha", "Solucion"]],
    body: failures.map(f => [f.failure_type, f.priority, f.status, f.reported_at, (f.solution || "—").slice(0,40)]),
    ...tableStyles
  });

  addFooter(doc);
  doc.save(`motor_${motor.code}_${new Date().toISOString().slice(0,10)}.pdf`);
}
