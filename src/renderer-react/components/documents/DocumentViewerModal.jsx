import React, { useEffect, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";

export function DocumentViewerModal({ open, documentId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    let url = null;

    async function load() {
      setLoading(true);
      setError("");
      setDoc(null);
      setBlobUrl(null);
      try {
        const res = await window.proelectricaApi.getDocumentContent({ id: documentId });
        if (cancelled) return;
        if (!res?.ok) {
          setError(res?.message || "No se pudo cargar el documento.");
          return;
        }
        const binary = atob(res.dataBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: res.document.mimeType });
        url = URL.createObjectURL(blob);
        setDoc(res.document);
        setBlobUrl(url);
      } catch {
        if (!cancelled) setError("Error al leer el archivo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, documentId]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isPdf = doc?.mimeType === "application/pdf";
  const isImage = doc?.mimeType?.startsWith("image/");

  async function handleDownload() {
    const res = await window.proelectricaApi.downloadDocument({ id: documentId });
    if (!res?.ok && res?.message !== "Cancelado") {
      setError(res?.message || "No se pudo descargar.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl h-[85vh] bg-[#0d1825] border border-[#2a3d57] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2a3d57]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#eaf2fb] truncate">{doc?.fileName || "Documento"}</p>
            {doc && <p className="text-xs text-[#7a9bb8]">{doc.mimeType}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={handleDownload} disabled={!doc}>
              <Download size={13} className="mr-1" /> Descargar
            </Button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#9ab0c7] hover:text-white hover:bg-white/5 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-[#070b10] flex items-center justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-[#9ab0c7]">
              <Loader2 size={18} className="animate-spin" /> Cargando documento...
            </div>
          )}
          {!loading && error && <p className="text-sm text-[#e07070] px-6 text-center">{error}</p>}
          {!loading && !error && blobUrl && isPdf && (
            <iframe title={doc.fileName} src={blobUrl} className="w-full h-full border-0 bg-white" />
          )}
          {!loading && !error && blobUrl && isImage && (
            <img src={blobUrl} alt={doc.fileName} className="max-w-full max-h-full object-contain p-4" />
          )}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <p className="text-sm text-[#9ab0c7]">Vista previa no disponible. Usa descargar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
