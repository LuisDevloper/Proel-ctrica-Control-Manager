import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Eye, Download, Trash2, FileText, Paperclip, Search, Image } from "lucide-react";
import { Button } from "../ui/Button";
import { Select, Field, Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";
import { ConfirmModal } from "../ui/Modal";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { EmptyState } from "../ui/EmptyState";

export const DOC_TYPE_OPTIONS = [
  { value: "cotizacion",      label: "Cotizacion" },
  { value: "informe",         label: "Informe tecnico" },
  { value: "orden_trabajo",   label: "Orden de trabajo" },
  { value: "permiso_firmado", label: "Permiso firmado" },
  { value: "foto",            label: "Fotografia" },
  { value: "otro",            label: "Otro documento" },
];

const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPE_OPTIONS.map((o) => [o.value, o.label]));

function docTypeBadgeVariant(docType) {
  if (docType === "cotizacion")      return "warning";
  if (docType === "informe")         return "info";
  if (docType === "orden_trabajo")   return "success";
  if (docType === "permiso_firmado") return "success";
  if (docType === "foto")            return "info";
  return "default";
}

function isImage(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

/** Miniatura inline para documentos de imagen usando la API de contenido. */
function ImageThumb({ documentId }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    window.proelectricaApi.getDocumentContent({ id: documentId })
      .then((res) => {
        if (cancelled || !res?.ok || !res.dataBase64) return;
        setSrc(`data:${res.mimeType || "image/jpeg"};base64,${res.dataBase64}`);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [documentId]);

  if (!src) {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#1a2d44] flex items-center justify-center shrink-0">
        <Image size={16} className="text-[#5fb3ff]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Vista previa"
      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#2a3d57]"
    />
  );
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function EntityDocuments({
  entityType,
  entityId,
  title = "Documentos",
  canMutate = false,
  username,
  compact = false,
  onChange,
  docTypeOptions = DOC_TYPE_OPTIONS,
  defaultDocType = "informe",
  acceptHint,
  showFilters = true,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(defaultDocType);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [viewerId, setViewerId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await window.proelectricaApi.listDocuments({ entityType, entityId });
      setItems(res?.ok ? res.items : []);
    } catch {
      setItems([]);
      showToast("No se pudieron cargar los documentos.", "warning");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setDocType(defaultDocType);
    setFilterQuery("");
    setFilterType("");
  }, [defaultDocType, entityId]);

  const filteredItems = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return items.filter((doc) => {
      if (filterType && doc.docType !== filterType) return false;
      if (!q) return true;
      const hay = `${doc.fileName || ""} ${DOC_TYPE_LABEL[doc.docType] || doc.docType || ""} ${doc.uploadedBy || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filterQuery, filterType]);

  async function handleUpload() {
    if (!canMutate) return;
    setUploading(true);
    try {
      const res = await window.proelectricaApi.pickAndUploadDocument({
        entityType,
        entityId,
        docType,
        username,
      });
      if (res?.ok) {
        showToast("Documento cargado correctamente.", "success");
        load();
        onChange?.();
      } else if (res?.errorCode === "STORAGE_FULL") {
        showToast(res.message, "warning", { duration: 8000 });
      } else if (res?.message && res.message !== "Cancelado") {
        showToast(res.message, "warning");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id) {
    const res = await window.proelectricaApi.downloadDocument({ id });
    if (res?.ok) showToast("Documento guardado.", "success");
    else if (res?.message && res.message !== "Cancelado") showToast(res.message, "warning");
  }

  async function handleDelete() {
    if (!canMutate || !deleteId) return;
    const res = await window.proelectricaApi.deleteDocument({ id: deleteId, username });
    setDeleteId(null);
    if (res?.ok) {
      showToast("Documento eliminado.", "success");
      load();
      onChange?.();
    } else {
      showToast(res?.message || "No se pudo eliminar.", "warning");
    }
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function guessMime(file) {
    if (file.type) return file.type;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "pdf")                return "application/pdf";
    if (ext === "png")                return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp")               return "image/webp";
    return "application/octet-stream";
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (!canMutate) return;

    const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const MAX_BYTES = 15 * 1024 * 1024;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    for (const file of files) {
      const mime = guessMime(file);
      if (!ALLOWED.includes(mime)) {
        showToast(`Formato no permitido: ${file.name}. Use PDF, JPG, PNG o WEBP.`, "warning");
        continue;
      }
      if (file.size > MAX_BYTES) {
        showToast(`${file.name} supera el límite de 15 MB.`, "warning");
        continue;
      }
      setUploading(true);
      try {
        const dataBase64 = await readFileBase64(file);
        const res = await window.proelectricaApi.uploadDocument({
          entityType,
          entityId,
          docType,
          fileName: file.name,
          mimeType: mime,
          dataBase64,
          username,
        });
        if (res?.ok) {
          showToast(`${file.name} subido correctamente.`, "success");
          load();
          onChange?.();
        } else if (res?.errorCode === "STORAGE_FULL") {
          showToast(res.message, "warning", { duration: 8000 });
        } else if (res?.message) {
          showToast(res.message, "warning");
        }
      } catch {
        showToast(`No se pudo subir ${file.name}.`, "warning");
      } finally {
        setUploading(false);
      }
    }
  }

  return (
    <div
      className={`relative ${compact ? "flex flex-col gap-3" : "flex flex-col gap-4"} rounded-xl transition-colors duration-150 ${
        isDragging ? "outline outline-2 outline-[#2f8dff]/60 bg-[#0d1825]/60" : ""
      }`}
      onDragEnter={canMutate ? handleDragEnter : undefined}
      onDragLeave={canMutate ? handleDragLeave : undefined}
      onDragOver={canMutate ? handleDragOver : undefined}
      onDrop={canMutate ? handleDrop : undefined}
    >
      {/* Overlay de soltar archivo */}
      {isDragging && canMutate && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2f8dff] bg-[#0a1525]/85 backdrop-blur-[2px] pointer-events-none">
          <Upload size={36} className="text-[#5fb3ff] mb-2 animate-bounce" />
          <p className="text-sm font-semibold text-[#5fb3ff]">Suelta aquí para subir</p>
          <p className="text-xs text-[#4a6a8a] mt-1">
            Se guardará como: <span className="text-[#9ab0c7]">{DOC_TYPE_LABEL[docType] || docType}</span>
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className={`font-semibold text-[#eaf2fb] flex items-center gap-2 ${compact ? "text-sm" : "text-base"}`}>
            <Paperclip size={compact ? 14 : 16} /> {title}
          </h3>
          <p className="text-xs text-[#7a9bb8] mt-0.5">{acceptHint || "PDF, JPG, PNG o WEBP — max. 15 MB"}</p>
        </div>
        {canMutate && (
          <div className="flex flex-wrap items-end gap-2">
            {docTypeOptions.length > 1 && (
              <Field label="Tipo">
                <Select value={docType} onChange={(e) => setDocType(e.target.value)} className="min-w-[170px]">
                  {docTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              <Upload size={13} className="mr-1" />
              {uploading ? "Subiendo..." : "Subir archivo"}
            </Button>
          </div>
        )}
      </div>

      {showFilters && items.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Buscar" className="flex-1 min-w-[180px] mb-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6a8a]" aria-hidden />
              <Input
                className="pl-9"
                placeholder="Nombre, tipo o usuario"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Tipo de documento" className="min-w-[170px] mb-0">
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Todos</option>
              {docTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          {(filterQuery || filterType) && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-0.5"
              onClick={() => { setFilterQuery(""); setFilterType(""); }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#7a9bb8]">Cargando documentos...</p>
      ) : items.length === 0 ? (
        <EmptyState message="Sin documentos adjuntos." className="py-6" />
      ) : filteredItems.length === 0 ? (
        <EmptyState message="No hay documentos con esos filtros." className="py-6" />
      ) : (
        <div className="flex flex-col gap-2">
          {filteredItems.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2a3d57] bg-[#0d1825]/80 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isImage(doc.mimeType) ? (
                  <ImageThumb documentId={doc.id} />
                ) : (
                  <div className="p-2 rounded-lg bg-[#1a2d44] text-[#5fb3ff] shrink-0">
                    <FileText size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={docTypeBadgeVariant(doc.docType)}>{DOC_TYPE_LABEL[doc.docType] || doc.docType}</Badge>
                    <span className="text-sm font-medium text-[#eaf2fb] truncate">{doc.fileName}</span>
                  </div>
                  <p className="text-xs text-[#7a9bb8] mt-0.5">
                    {formatBytes(doc.fileSize)} · {formatDate(doc.createdAt)}
                    {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" title="Ver" onClick={() => setViewerId(doc.id)}>
                  <Eye size={14} />
                </Button>
                <Button variant="ghost" size="icon" title="Descargar" onClick={() => handleDownload(doc.id)}>
                  <Download size={14} />
                </Button>
                {canMutate && (
                  <Button variant="ghost" size="icon" className="hover:text-[#e07070]" title="Eliminar" onClick={() => setDeleteId(doc.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentViewerModal open={!!viewerId} documentId={viewerId} onClose={() => setViewerId(null)} />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Se eliminará este documento de forma permanente. Esta acción no se puede deshacer."
      />
    </div>
  );
}

export function DocumentsModal({ open, onClose, onChange, ...props }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#111d2c] border border-[#2a3d57] rounded-2xl shadow-2xl p-5 animate-slideUp">
        <EntityDocuments {...props} compact onChange={onChange} />
        <div className="flex justify-end mt-4 pt-3 border-t border-[#2a3d57]">
          <Button variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
