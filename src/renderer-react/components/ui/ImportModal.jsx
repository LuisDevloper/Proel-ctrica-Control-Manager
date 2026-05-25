import React, { useState, useEffect } from "react";
import { useDbHealth } from "../../context/DbHealthContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../../lib/permissions";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { X, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Download } from "lucide-react";

const IMPORT_MAX_ROWS = 200;

const TEMPLATES = {
  motors: {
    label: "Motores",
    cols: ["Codigo", "Marca", "Modelo", "Potencia (kW)", "Voltaje (V)", "RPM", "Ubicacion", "Fecha instalacion", "Estado", "Observaciones"],
    example: ["MOT-001", "Siemens", "1LA7", "15", "440", "1800", "Planta Norte", "2024-01-15", "Operativo", ""],
  },
  technicians: {
    label: "Técnicos",
    cols: ["Nombre", "Telefono", "Email", "Especialidad"],
    example: ["Juan Pérez", "3001234567", "juan@correo.com", "Electrica"],
  },
};

/** Fila que la IPC aceptará (Codigo+Marca o Nombre). */
function rowIsImportable(entity, r) {
  if (entity === "motors") {
    const code = String(r.Codigo ?? r.codigo ?? r.CODIGO ?? "").trim();
    const brand = String(r.Marca ?? r.marca ?? r.MARCA ?? "").trim();
    return !!(code && brand);
  }
  const name = String(r.Nombre ?? r.nombre ?? r.NOMBRE ?? "").trim();
  return !!name;
}

export function ImportModal({ open, entity, user, onClose, onSuccess }) {
  const [step, setStep]         = useState("idle"); // idle | preview | done
  const [parsed, setParsed]     = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const { showToast }           = useToast();
  const { dbWritable }          = useDbHealth();
  const dbTitle                 = !dbWritable ? "Sin conexion a la base de datos." : undefined;
  const canImport               = canMutateRecords(user?.role);
  const importBlockTitle        = !dbWritable ? dbTitle : (!canImport ? READ_ONLY_ROLE_TITLE : undefined);
  const importDisabled          = !dbWritable || !canImport;

  const tmpl = TEMPLATES[entity] || TEMPLATES.motors;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key !== "Escape") return;
      setStep("idle");
      setParsed(null);
      setResult(null);
      setError("");
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function handleClose() {
    setStep("idle"); setParsed(null); setResult(null); setError("");
    onClose();
  }

  async function handleSelectFile() {
    setLoading(true); setError("");
    const res = await window.proelectricaApi.parseExcel({ entity });
    setLoading(false);
    if (res.canceled) return;
    if (!res.ok) { setError(res.message || "Error al leer el archivo."); return; }
    if (!res.rows.length) { setError("El archivo no tiene datos o el formato no coincide."); return; }
    setParsed(res);
    if (res.rowLimitReached) {
      const max = res.importMaxRows || IMPORT_MAX_ROWS;
      const extra = res.extraRowsInFile || 0;
      const total = res.rows.length + extra;
      showToast(
        `El Excel tiene ${total} filas con datos; solo se cargaron las primeras ${max}. Las restantes no se importarán.`,
        "warning"
      );
    }
    setStep("preview");
  }

  async function handleImport() {
    const rowsToSend = parsed.rows.filter((r) => rowIsImportable(entity, r));
    if (!rowsToSend.length) {
      showToast(
        entity === "motors"
          ? "Ninguna fila tiene Codigo y Marca obligatorios. Completa el Excel o quita filas vacías."
          : "Ninguna fila tiene Nombre obligatorio.",
        "warning"
      );
      return;
    }
    setLoading(true);
    const fn = entity === "motors"
      ? window.proelectricaApi.importMotors
      : window.proelectricaApi.importTechnicians;
    const res = await fn({ rows: rowsToSend, username: user?.username });
    setLoading(false);
    setResult(res);
    setStep("done");
    if (res.ok && typeof res.skipped === "number" && res.skipped > 0) {
      const skipMsg =
        entity === "motors"
          ? res.skipped === 1
            ? "Importación de Excel: 1 fila omitida (codigo duplicado o ya registrado)."
            : `Importación de Excel: ${res.skipped} filas omitidas (codigos duplicados o ya registrados).`
          : res.skipped === 1
            ? "Importación de Excel: 1 fila omitida (nombre duplicado o ya registrado)."
            : `Importación de Excel: ${res.skipped} filas omitidas (nombres duplicados o ya registrados).`;
      showToast(skipMsg, "warning");
    }
    if (res.ok) onSuccess?.();
  }

  async function handleDownloadTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Proélectrica Control Manager";
    wb.created = new Date();

    const ws = wb.addWorksheet("Plantilla", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      views: [{ state: "frozen", ySplit: 4 }],
    });

    const colCount = tmpl.cols.length;

    // Fila 1: Título principal
    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell("A1");
    titleCell.value = `PROELECTRICA — PLANTILLA DE IMPORTACIÓN: ${tmpl.label.toUpperCase()}`;
    titleCell.font  = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "1A4A8A" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Fila 2: Instrucciones
    ws.mergeCells(2, 1, 2, colCount);
    const infoCell = ws.getCell("A2");
    infoCell.value = `Complete los datos a partir de la fila 4. No modifique los encabezados. Campos con * son obligatorios.`;
    infoCell.font  = { name: "Calibri", size: 9, italic: true, color: { argb: "4A6A8A" } };
    infoCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF2FB" } };
    infoCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    // Fila 3: Encabezados de columnas
    tmpl.cols.forEach((col, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value = col.toUpperCase();
      cell.font  = { name: "Calibri", size: 10, bold: true, color: { argb: "EAF2FB" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "0D1825" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top:    { style: "thin", color: { argb: "2F8DFF" } },
        bottom: { style: "thin", color: { argb: "2F8DFF" } },
        left:   { style: "thin", color: { argb: "1A2D47" } },
        right:  { style: "thin", color: { argb: "1A2D47" } },
      };
    });
    ws.getRow(3).height = 22;

    // Fila 4: Ejemplo (en gris claro)
    const exRow = ws.addRow(tmpl.example);
    exRow.height = 18;
    exRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "7A9BB8" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0F5FA" } };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top:    { style: "hair", color: { argb: "C5D5E8" } },
        bottom: { style: "hair", color: { argb: "C5D5E8" } },
        left:   { style: "hair", color: { argb: "C5D5E8" } },
        right:  { style: "hair", color: { argb: "C5D5E8" } },
      };
    });

    // Filas vacías para rellenar
    for (let r = 0; r < 20; r++) {
      const row = ws.addRow(tmpl.cols.map(() => ""));
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: r % 2 === 0 ? "FFFFFF" : "F7FAFE" } };
        cell.border = {
          top:    { style: "hair", color: { argb: "C5D5E8" } },
          bottom: { style: "hair", color: { argb: "C5D5E8" } },
          left:   { style: "hair", color: { argb: "C5D5E8" } },
          right:  { style: "hair", color: { argb: "C5D5E8" } },
        };
      });
    }

    tmpl.cols.forEach((_, i) => { ws.getColumn(i + 1).width = 22; });

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `plantilla_${entity}.xlsx`;
    a.click(); a.remove();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={handleClose} />
      <div className="relative z-10 bg-[#111d2c] border border-[#2a3d57] rounded-2xl shadow-2xl w-[580px] max-h-[80vh] flex flex-col animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3d57]">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={18} className="text-[#29a16a]" />
            <div>
              <h3 className="text-base font-bold text-[#eaf2fb]">Importar {tmpl.label} desde Excel</h3>
              <p className="text-xs text-[#9ab0c7]">Sube un archivo .xlsx con los datos</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-[#9ab0c7] hover:text-white cursor-pointer transition-colors"><X size={16}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Paso: idle */}
          {step === "idle" && (
            <>
              {/* Columnas esperadas */}
              <div className="bg-[#0d1825] rounded-xl p-4 border border-[#2a3d57]">
                <p className="text-xs font-semibold text-[#9ab0c7] uppercase tracking-wide mb-2">Columnas requeridas</p>
                <div className="flex flex-wrap gap-2">
                  {tmpl.cols.map(c => (
                    <span key={c} className="text-xs bg-[#1a2d44] text-[#2f8dff] border border-[#2f8dff33] px-2 py-1 rounded-lg">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-[#4a6a8a] mt-3">
                  • Si usa la plantilla de la app, los encabezados están en la fila bajo las instrucciones (columna A = Codigo).<br/>
                  • En archivos simples, la primera fila puede ser solo encabezados: Codigo, Marca, …<br/>
                  • El campo <strong className="text-[#9ab0c7]">{entity === "motors" ? "Codigo + Marca" : "Nombre"}</strong> es obligatorio.<br/>
                  • Registros con codigo duplicado serán omitidos.<br/>
                  • Máximo <strong className="text-[#9ab0c7]">{IMPORT_MAX_ROWS}</strong> filas de datos por archivo; si el Excel tiene más, solo se procesan las primeras {IMPORT_MAX_ROWS}.<br/>
                  • Estados válidos en columna Estado: <strong className="text-[#9ab0c7]">Operativo</strong>, <strong className="text-[#9ab0c7]">En mantenimiento</strong>, <strong className="text-[#9ab0c7]">Fuera de servicio</strong>. Cualquier otro texto se guardará como Operativo y se avisará al finalizar.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-[#2e1212]/70 border border-[#5c2222] rounded-xl px-3 py-2.5">
                  <AlertTriangle size={13} className="text-[#e07070] shrink-0" />
                  <p className="text-xs text-[#e07070]">{error}</p>
                </div>
              )}

              {!canImport && (
                <div className="flex items-center gap-2 bg-[#2f8dff]/10 border border-[#2f8dff]/25 rounded-xl px-3 py-2">
                  <AlertTriangle size={13} className="text-[#5fb3ff] shrink-0" />
                  <p className="text-xs text-[#9ab0c7]">Tu rol no permite importar datos. Solo administradores y operadores pueden usar esta función.</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="ghost" size="sm" className="border border-[#2a3d57] text-[#9ab0c7]" onClick={handleDownloadTemplate}>
                  <Download size={13} className="mr-1.5" /> Descargar plantilla
                </Button>
                <Button onClick={handleSelectFile} disabled={loading || importDisabled} title={importBlockTitle} className="flex-1">
                  <Upload size={13} className="mr-1.5" /> {loading ? "Leyendo..." : "Seleccionar archivo .xlsx"}
                </Button>
              </div>
            </>
          )}

          {/* Paso: preview */}
          {step === "preview" && parsed && (() => {
            const totalRows = parsed.rows.length;
            const importable = parsed.rows.filter((r) => rowIsImportable(entity, r)).length;
            const incomplete = totalRows - importable;
            const maxRows = parsed.importMaxRows || IMPORT_MAX_ROWS;
            const extraInFile = parsed.extraRowsInFile || 0;
            const totalInFile = parsed.rowLimitReached ? totalRows + extraInFile : totalRows;
            return (
            <>
              {parsed.rowLimitReached && (
                <div className="flex items-start gap-2 bg-[#e0a91f]/12 border border-[#e0a91f]/35 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-[#e0a91f] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#eaf2fb] leading-snug">
                    El archivo tiene <strong>{totalInFile}</strong> filas con datos; solo se cargaron las primeras{" "}
                    <strong>{maxRows}</strong>. Las <strong>{extraInFile}</strong> filas restantes no aparecen en la vista previa ni se importarán.
                    Divida el Excel en varios archivos si necesita importar todo.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[#29a16a] bg-[#29a16a]/10 border border-[#29a16a]/30 rounded-xl px-3 py-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>
                  {importable === totalRows
                    ? `${importable} registro(s) listo(s) para importar (${entity === "motors" ? "Codigo y Marca" : "Nombre"} completo).`
                    : `${importable} registro(s) listo(s) para importar de ${totalRows} fila(s) en el archivo.${incomplete > 0 ? ` ${incomplete} fila(s) sin datos obligatorios no se importarán.` : ""}`}
                </span>
              </div>

              {/* Preview tabla */}
              <div className="overflow-auto rounded-xl border border-[#2a3d57] max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {parsed.headers.map((h, hi) => (
                        <th key={`h-${hi}`} className="text-left px-3 py-2 text-[#9ab0c7] bg-[#0d1825] whitespace-nowrap border-b border-[#2a3d57]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 10).map((row, ri) => (
                      <tr key={`r-${ri}`} className={ri % 2 === 0 ? "bg-[#111d2c]" : "bg-[#0d1825]"}>
                        {parsed.headers.map((h, hi) => (
                          <td key={`r-${ri}-c-${hi}`} className="px-3 py-1.5 text-[#eaf2fb] whitespace-nowrap max-w-[160px] truncate">{row[h] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 10 && (
                  <p className="text-center text-xs text-[#4a6a8a] py-2">...y {parsed.rows.length - 10} registros más</p>
                )}
                <p className="text-center text-xs text-[#5a7a9a] py-2 border-t border-[#1e2f44]">
                  Vista previa: {Math.min(parsed.rows.length, 10)} de {totalRows} fila(s){importable < totalRows ? ` · Solo ${importable} cumplen requisitos para importar` : ""}
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => { setStep("idle"); setParsed(null); }}>Cancelar</Button>
                <Button onClick={handleImport} disabled={loading || importDisabled || importable === 0} title={importBlockTitle || (importable === 0 ? "No hay filas con los campos obligatorios." : undefined)} className="flex-1 bg-[#29a16a] hover:bg-[#34c47e]">
                  {loading ? "Importando..." : importable === 0 ? "Sin filas válidas" : `Importar ${importable} registro(s)`}
                </Button>
              </div>
            </>
            );
          })()}

          {/* Paso: done */}
          {step === "done" && result && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
                result.inserted === 0 && result.skipped > 0
                  ? "bg-[#e0a91f]/10 border-[#e0a91f]/35"
                  : "bg-[#29a16a]/10 border-[#29a16a]/30"
              }`}>
                {result.inserted === 0 && result.skipped > 0 ? (
                  <AlertTriangle size={32} className="text-[#e0a91f]" />
                ) : (
                  <CheckCircle2 size={32} className="text-[#29a16a]" />
                )}
              </div>
              <h4 className="text-base font-bold text-[#eaf2fb]">
                {result.inserted === 0 && result.skipped > 0
                  ? "Ningún registro nuevo"
                  : "Importación completada"}
              </h4>
              {typeof result.skipped === "number" && result.skipped > 0 && (
                <div className="flex items-start gap-2 w-full bg-[#e0a91f]/12 border border-[#e0a91f]/35 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={16} className="text-[#e0a91f] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#eaf2fb] leading-snug">
                    {entity === "motors" ? (
                      result.skipped === 1 ? (
                        <>Se omitió <strong>1 fila</strong>: el codigo ya existe en la base de datos o la fila no pudo insertarse.</>
                      ) : (
                        <>Se omitieron <strong>{result.skipped} filas</strong>: codigos duplicados respecto a motores ya registrados (o no aplicables por la base de datos).</>
                      )
                    ) : result.skipped === 1 ? (
                      <>Se omitió <strong>1 fila</strong>: el nombre ya existe en técnicos o la fila no pudo insertarse.</>
                    ) : (
                      <>Se omitieron <strong>{result.skipped} filas</strong>: nombres duplicados respecto a técnicos ya registrados.</>
                    )}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-[#29a16a]/10 border border-[#29a16a]/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#29a16a]">{result.inserted}</p>
                  <p className="text-xs text-[#9ab0c7]">Registros importados</p>
                </div>
                <div className="bg-[#e0a91f]/10 border border-[#e0a91f]/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#e0a91f]">{result.skipped}</p>
                  <p className="text-xs text-[#9ab0c7]">Omitidos (duplicados o incompletos)</p>
                </div>
              </div>
              {typeof result.statusAdjusted === "number" && result.statusAdjusted > 0 && (
                <p className="text-xs text-center text-[#e0a91f] bg-[#e0a91f]/10 border border-[#e0a91f]/25 rounded-xl px-3 py-2 w-full">
                  {result.statusAdjusted === 1
                    ? "1 fila tenía un estado no reconocido; se guardó como Operativo (solo se permiten: Operativo, En mantenimiento, Fuera de servicio)."
                    : `${result.statusAdjusted} filas tenían un estado no reconocido; se guardaron como Operativo.`}
                </p>
              )}
              <Button onClick={handleClose} className="w-full mt-2">Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
