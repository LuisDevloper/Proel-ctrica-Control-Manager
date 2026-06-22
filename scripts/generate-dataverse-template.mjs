/**
 * Genera plantilla Excel para crear tablas Dataverse desde Power Apps.
 * Salida: docs/power-apps/Proelectrica-Dataverse-Plantilla.xlsx
 */
import ExcelJS from "exceljs";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const OUT_DIR = resolve("docs/power-apps");
const OUT_XLSX = resolve(OUT_DIR, "Proelectrica-Dataverse-Plantilla.xlsx");
const OUT_XLSX_ALT = resolve(OUT_DIR, "Proelectrica-Dataverse-Plantilla-sin-repuestos.xlsx");
const OUT_JSON = resolve(OUT_DIR, "dataverse-schema.json");

mkdirSync(OUT_DIR, { recursive: true });

const CHOICES = {
  estado_equipo: ["Operativo", "En mantenimiento", "En almacen", "Fuera de servicio"],
  ubicacion_operativa: ["En planta", "Afuera", "Taller externo", "Almacen", "En mantenimiento"],
  estado_mantenimiento: ["Pendiente", "En progreso", "Completado"],
  tipo_mantenimiento: ["Preventivo", "Correctivo"],
  prioridad_falla: ["Alta", "Media", "Baja"],
  estado_falla: ["Pendiente", "En proceso", "Resuelta"],
  tipo_equipo_envio: ["Motor", "Turbina"],
  estado_logistica: [
    "Permiso de salida aprobado",
    "Equipo en transito",
    "Entrada registrada",
    "Equipo entregado",
  ],
  tipo_documento: ["Cotizacion", "Informe tecnico", "Orden de trabajo", "Otro"],
};

const TABLES = {
  pcm_motor: {
    displayName: "Motor",
    sheetName: "Motores",
    columns: [
      { name: "pcm_codigo", label: "Codigo", type: "Texto", required: true, example: "MOT-001" },
      { name: "pcm_marca", label: "Marca", type: "Texto", required: true, example: "Siemens" },
      { name: "pcm_modelo", label: "Modelo", type: "Texto", example: "1LA7" },
      { name: "pcm_serie", label: "Numero de serie", type: "Texto", example: "SN-12345" },
      { name: "pcm_voltaje", label: "Voltaje (V)", type: "Numero", example: 440 },
      { name: "pcm_potencia", label: "Potencia (kW)", type: "Numero", example: 15 },
      { name: "pcm_rpm", label: "RPM", type: "Numero", example: 1800 },
      { name: "pcm_ubicacion_detalle", label: "Detalle ubicacion", type: "Texto", example: "Planta Norte - Sector A" },
      { name: "pcm_ubicacion_operativa", label: "Ubicacion operativa", type: "Choice:ubicacion_operativa", example: "En planta" },
      { name: "pcm_estado", label: "Estado", type: "Choice:estado_equipo", example: "Operativo" },
      { name: "pcm_fecha_instalacion", label: "Fecha instalacion", type: "Fecha", example: "2024-03-15" },
      { name: "pcm_notas", label: "Notas", type: "Texto largo", example: "" },
    ],
  },
  pcm_turbina: {
    displayName: "Turbina",
    sheetName: "Turbinas",
    columns: [
      { name: "pcm_codigo", label: "Codigo", type: "Texto", required: true, example: "TUR-001" },
      { name: "pcm_gg", label: "GG", type: "Texto", example: "" },
      { name: "pcm_pt", label: "PT", type: "Texto", example: "" },
      { name: "pcm_rodamiento_1", label: "Rodamiento 1", type: "Texto", example: "" },
      { name: "pcm_rodamiento_2", label: "Rodamiento 2", type: "Texto", example: "" },
      { name: "pcm_runtime_retiro", label: "Runtime retiro", type: "Texto", example: "" },
      { name: "pcm_comentarios_retiro", label: "Comentarios retiro", type: "Texto largo", example: "" },
      { name: "pcm_ubicacion_operativa", label: "Ubicacion operativa", type: "Choice:ubicacion_operativa", example: "En planta" },
      { name: "pcm_estado", label: "Estado", type: "Choice:estado_equipo", example: "Operativo" },
      { name: "pcm_motor_codigo", label: "Motor vinculado (codigo)", type: "Lookup texto", example: "MOT-001" },
      { name: "pcm_notas", label: "Notas", type: "Texto largo", example: "" },
    ],
  },
  pcm_tecnico: {
    displayName: "Tecnico",
    sheetName: "Tecnicos",
    columns: [
      { name: "pcm_nombre_completo", label: "Nombre completo", type: "Texto", required: true, example: "Juan Perez" },
      { name: "pcm_telefono", label: "Telefono", type: "Texto", example: "+58 412 0000000" },
      { name: "pcm_email", label: "Correo", type: "Texto", example: "tecnico@empresa.com" },
      { name: "pcm_especialidad", label: "Especialidad", type: "Texto", example: "Electrico industrial" },
    ],
  },
  pcm_mantenimiento: {
    displayName: "Mantenimiento",
    sheetName: "Mantenimientos",
    columns: [
      { name: "pcm_motor_codigo", label: "Motor (codigo)", type: "Lookup texto", required: true, example: "MOT-001" },
      { name: "pcm_tecnico_nombre", label: "Tecnico (nombre)", type: "Lookup texto", example: "Juan Perez" },
      { name: "pcm_tipo", label: "Tipo", type: "Choice:tipo_mantenimiento", example: "Preventivo" },
      { name: "pcm_fecha", label: "Fecha", type: "Fecha", required: true, example: "2026-05-21" },
      { name: "pcm_descripcion", label: "Descripcion", type: "Texto largo", example: "Revision general" },
      { name: "pcm_repuestos", label: "Repuestos usados", type: "Texto largo", example: "" },
      { name: "pcm_costo", label: "Costo", type: "Moneda", example: 150 },
      { name: "pcm_estado", label: "Estado", type: "Choice:estado_mantenimiento", example: "Pendiente" },
      { name: "pcm_notas", label: "Notas", type: "Texto largo", example: "" },
    ],
  },
  pcm_falla: {
    displayName: "Falla",
    sheetName: "Fallas",
    columns: [
      { name: "pcm_motor_codigo", label: "Motor (codigo)", type: "Lookup texto", required: true, example: "MOT-001" },
      { name: "pcm_tecnico_nombre", label: "Tecnico (nombre)", type: "Lookup texto", example: "Juan Perez" },
      { name: "pcm_tipo", label: "Tipo de falla", type: "Texto", required: true, example: "Sobrecalentamiento" },
      { name: "pcm_prioridad", label: "Prioridad", type: "Choice:prioridad_falla", example: "Alta" },
      { name: "pcm_estado", label: "Estado", type: "Choice:estado_falla", example: "Pendiente" },
      { name: "pcm_fecha_reporte", label: "Fecha reporte", type: "Fecha", required: true, example: "2026-05-21" },
      { name: "pcm_solucion", label: "Solucion", type: "Texto largo", example: "" },
      { name: "pcm_notas", label: "Notas", type: "Texto largo", example: "" },
    ],
  },
  pcm_envio_taller: {
    displayName: "Envio taller externo",
    sheetName: "EnviosTaller",
    columns: [
      { name: "pcm_tipo_equipo", label: "Tipo equipo", type: "Choice:tipo_equipo_envio", example: "Motor" },
      { name: "pcm_equipo_codigo", label: "Codigo equipo", type: "Lookup texto", required: true, example: "MOT-001" },
      { name: "pcm_taller", label: "Taller externo", type: "Texto", required: true, example: "Taller ABC" },
      { name: "pcm_responsable", label: "Responsable", type: "Texto", example: "Carlos Ruiz" },
      { name: "pcm_fecha_salida", label: "Fecha salida", type: "Fecha", required: true, example: "2026-05-01" },
      { name: "pcm_retorno_estimado", label: "Retorno estimado", type: "Fecha", example: "2026-05-15" },
      { name: "pcm_retorno_real", label: "Retorno real", type: "Fecha", example: "" },
      { name: "pcm_motivo", label: "Motivo", type: "Texto largo", example: "Rebobinado" },
      { name: "pcm_estado_equipo", label: "Estado fisico equipo", type: "Texto", example: "Operativo" },
      { name: "pcm_estado_logistica", label: "Estado logistica", type: "Choice:estado_logistica", example: "Permiso de salida aprobado" },
      { name: "pcm_notas", label: "Notas", type: "Texto largo", example: "" },
    ],
  },
};

const RELATIONSHIPS = [
  { from: "pcm_turbina", column: "pcm_motor_codigo", to: "pcm_motor", toColumn: "pcm_codigo" },
  { from: "pcm_mantenimiento", column: "pcm_motor_codigo", to: "pcm_motor", toColumn: "pcm_codigo" },
  { from: "pcm_mantenimiento", column: "pcm_tecnico_nombre", to: "pcm_tecnico", toColumn: "pcm_nombre_completo" },
  { from: "pcm_falla", column: "pcm_motor_codigo", to: "pcm_motor", toColumn: "pcm_codigo" },
  { from: "pcm_falla", column: "pcm_tecnico_nombre", to: "pcm_tecnico", toColumn: "pcm_nombre_completo" },
];

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: "FFEAF2FB" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1825" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function addChoiceSheet(wb, key, values) {
  const ws = wb.addWorksheet(`Choice_${key}`, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Valor", key: "value", width: 36 },
    { header: "Orden", key: "order", width: 10 },
  ];
  styleHeaderRow(ws.getRow(1));
  values.forEach((value, i) => ws.addRow({ value, order: i + 1 }));
}

function addTableSheet(wb, tableKey, def) {
  const ws = wb.addWorksheet(def.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Formato compatible con importación Power Apps: fila 1 = encabezados visibles, fila 2 = ejemplo.
  // Nombres lógicos pcm_* → ver dataverse-schema.json / hoja Instrucciones.
  ws.addRow(def.columns.map((c) => c.label));
  ws.addRow(def.columns.map((c) => c.example ?? ""));

  styleHeaderRow(ws.getRow(1));
  ws.getRow(2).font = { color: { argb: "FF94A3B8" } };

  def.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(16, col.label.length + 4);
  });
}

async function buildWorkbook(outPath = OUT_XLSX) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Proelectrica Control Manager";
  wb.created = new Date();

  const wsInfo = wb.addWorksheet("Instrucciones", { views: [{ state: "frozen", ySplit: 1 }] });
  wsInfo.getColumn(1).width = 100;
  const lines = [
    "PLANTILLA DATAVERSE — Proelectrica Control Manager (Canvas App)",
    "",
    "1) En make.powerapps.com cree una Solucion nueva (prefijo pcm recomendado).",
    "2) Importe cada hoja de datos como tabla (Datos > Agregar datos > Excel).",
    "    - Fila 1 = encabezados (Nombre completo, Codigo, etc.)",
    "    - Fila 2 = fila de ejemplo (opcional; puede borrarse tras crear la tabla)",
    "    - Nombres logicos pcm_* = ver dataverse-schema.json al renombrar columnas",
    "3) Cree las Choice columns usando las hojas Choice_* como referencia.",
    "4) Convierta columnas 'Lookup texto' en relaciones Lookup en Dataverse.",
    "5) Consulte la hoja Relaciones para el mapa padre-hijo.",
    "6) Conecte la Canvas App a estas tablas.",
    "",
    "Orden sugerido de importacion:",
    "  Tecnicos > Motores > Turbinas > Mantenimientos > Fallas > EnviosTaller",
    "",
    "Archivo generado desde el repositorio Electron (Proelectrica Control Manager v2).",
  ];
  lines.forEach((line) => wsInfo.addRow([line]));

  for (const [key, values] of Object.entries(CHOICES)) {
    addChoiceSheet(wb, key, values);
  }

  for (const [key, def] of Object.entries(TABLES)) {
    addTableSheet(wb, key, def);
  }

  const wsRel = wb.addWorksheet("Relaciones");
  wsRel.columns = [
    { header: "Tabla origen", key: "from", width: 28 },
    { header: "Columna origen", key: "col", width: 28 },
    { header: "Tabla destino", key: "to", width: 24 },
    { header: "Columna destino", key: "toCol", width: 24 },
  ];
  styleHeaderRow(wsRel.getRow(1));
  RELATIONSHIPS.forEach((r) => wsRel.addRow({
    from: r.from,
    col: r.column,
    to: r.to,
    toCol: r.toColumn,
  }));

  await wb.xlsx.writeFile(outPath);
}

const schemaJson = {
  solution: {
    name: "Proelectrica Control Manager",
    prefix: "pcm",
    publisher: "Proelectrica",
    appType: "Canvas",
    dataSource: "Dataverse",
  },
  choiceSets: CHOICES,
  tables: Object.fromEntries(
    Object.entries(TABLES).map(([key, def]) => [
      key,
      {
        displayName: def.displayName,
        sheetName: def.sheetName,
        columns: def.columns.map(({ name, label, type, required }) => ({
          logicalName: name,
          displayName: label,
          dataType: type,
          required: Boolean(required),
        })),
      },
    ])
  ),
  relationships: RELATIONSHIPS,
  importOrder: [
    "pcm_tecnico",
    "pcm_motor",
    "pcm_turbina",
    "pcm_mantenimiento",
    "pcm_falla",
    "pcm_envio_taller",
  ],
};

writeFileSync(OUT_JSON, `${JSON.stringify(schemaJson, null, 2)}\n`, "utf8");

try {
  await buildWorkbook(OUT_XLSX);
  console.log(`✓ ${OUT_XLSX}`);
} catch (err) {
  if (err?.code === "EBUSY") {
    await buildWorkbook(OUT_XLSX_ALT);
    console.log(`✓ ${OUT_XLSX_ALT} (cierra el Excel anterior y vuelve a ejecutar npm run dataverse:template)`);
  } else {
    throw err;
  }
}
console.log(`✓ ${OUT_JSON}`);
