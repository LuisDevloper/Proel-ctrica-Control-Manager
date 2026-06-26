import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Field } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useDbHealth } from "../context/DbHealthContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { canMutateRecords } from "../lib/permissions";
import {
  KeyRound, Info, Database, Monitor, RefreshCw, Type, Settings,
  History, Cloud, ShieldCheck, HardDrive, Trash2, AlertTriangle,
  FileText, RotateCcw, ChevronDown, ChevronUp,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { VersionHistory } from "../components/settings/VersionHistory";

/** Límite en bytes del plan gratuito de Neon (512 MB). */
const NEON_FREE_LIMIT_BYTES = 512 * 1024 * 1024;

function platformToOsName(platform) {
  if (!platform) return null;
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform;
}

function guessArchFromUserAgent() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Win64|x86_64|WOW64/i.test(ua)) return "64 bits (x64)";
  if (/aarch64|ARM64|arm64/i.test(ua)) return "64 bits (ARM)";
  return null;
}

function productDisplayName(info) {
  if (!info) return "—";
  return info.productName ?? info.name ?? "—";
}

function systemOperatingSummary(info) {
  if (!info) return "—";
  const os   = info.osName || platformToOsName(info.platform) || "—";
  const arch = info.arch   || guessArchFromUserAgent()        || "—";
  return `${os}, ${arch}`;
}

function installModeLabel(info) {
  if (!info) return "—";
  if (info.packaged === true)  return "Aplicacion instalada";
  if (info.packaged === false) return "Modo desarrollo";
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return "Modo desarrollo";
  return "Aplicacion instalada";
}

/** Formatea bytes a una cadena legible. */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024)           return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Color de la barra de progreso según el porcentaje de uso. */
function storageBarColor(pct) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-400";
  return "bg-[#39d48f]";
}

/** Mini-icono según mime_type. */
function DocIcon({ mimeType }) {
  if (mimeType?.startsWith("image/"))
    return <span className="text-[#2f8dff] text-[10px] font-bold leading-none">IMG</span>;
  return <FileText size={13} className="text-[#9ab0c7]" />;
}

export function Configuracion({ user }) {
  const [appInfo, setAppInfo]         = useState(null);
  const [currentPwd, setCurrentPwd]   = useState("");
  const [newPwd, setNewPwd]           = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const { showToast }                 = useToast();
  const { run }                       = useAsync();
  const { status: dbHealthStatus, refresh: dbRefresh } = useDbHealth();
  const { fontPercent, setFontPercent } = useAccessibility();
  const dbTitle      = dbHealthStatus !== true ? "Sin conexion a la base de datos." : undefined;
  const canMutateOps = canMutateRecords(user?.role);

  // ── Estado almacenamiento ─────────────────────────────────────────────────
  const [storageStats,   setStorageStats]   = useState(null);
  const [heavyDocs,      setHeavyDocs]      = useState(null);
  const [orphanDocs,     setOrphanDocs]     = useState(null);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [deletingIds,    setDeletingIds]    = useState(false);
  const [showHeavy,      setShowHeavy]      = useState(false);
  const [showOrphans,    setShowOrphans]    = useState(false);

  const loadStorageData = useCallback(async () => {
    setLoadingStorage(true);
    setSelectedIds(new Set());
    try {
      const [stats, heavy, orphans] = await Promise.all([
        window.proelectricaApi.getStorageStats(),
        window.proelectricaApi.listHeavyDocuments({ limit: 20 }),
        window.proelectricaApi.listOrphanDocuments(),
      ]);
      if (stats.ok)   setStorageStats(stats);
      if (heavy.ok)   setHeavyDocs(heavy.items);
      if (orphans.ok) setOrphanDocs(orphans.items);
    } catch {
      showToast("No se pudo cargar la informacion de almacenamiento.", "warning");
    } finally {
      setLoadingStorage(false);
    }
  }, [showToast]);

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeletingIds(true);
    const res = await window.proelectricaApi.deleteManyDocuments({ ids: [...selectedIds] });
    setDeletingIds(false);
    if (res?.ok) {
      showToast(`${res.deleted} documento(s) eliminado(s) correctamente.`, "success");
      await loadStorageData();
    } else {
      showToast(res?.message || "No se pudo completar la eliminacion.", "warning");
    }
  }

  async function handleDeleteOrphans() {
    if (!orphanDocs?.length) return;
    setDeletingIds(true);
    const res = await window.proelectricaApi.deleteManyDocuments({ ids: orphanDocs.map((d) => d.id) });
    setDeletingIds(false);
    if (res?.ok) {
      showToast(`${res.deleted} documento(s) huerfano(s) eliminado(s).`, "success");
      setShowOrphans(false);
      await loadStorageData();
    } else {
      showToast(res?.message || "No se pudo completar la eliminacion.", "warning");
    }
  }

  function toggleDocSelection(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(items) {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((d) => d.id))
    );
  }

  useEffect(() => {
    let cancelled = false;
    window.proelectricaApi.getAppInfo()
      .then((info) => { if (!cancelled) setAppInfo(info); })
      .catch(() => { if (!cancelled) showToast("No se pudo obtener la informacion del sistema.", "warning"); });
    return () => { cancelled = true; };
  }, [showToast]);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) { showToast("Completa todos los campos.", "warning"); return; }
    if (newPwd.length < 6) { showToast("La nueva contrasena debe tener al menos 6 caracteres.", "warning"); return; }
    if (newPwd !== confirmPwd) { showToast("Las contrasenas nuevas no coinciden.", "warning"); return; }
    const { ok } = await run(
      () => window.proelectricaApi.changePassword({ userId: user.id, currentPassword: currentPwd, newPassword: newPwd }),
      "Contrasena actualizada correctamente."
    );
    if (ok) { setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }
  }

  async function handleCheckUpdates() {
    const r = await window.proelectricaApi.checkForUpdates();
    if (r?.reason === "dev") {
      showToast("La busqueda de actualizaciones solo funciona en la aplicacion instalada (no en modo desarrollo).", "info");
      return;
    }
    if (r?.reason === "no_updater") { showToast("El comprobador de actualizaciones no esta disponible.", "warning"); return; }
    if (r?.ok) { if (!r.updateAvailable) showToast("No hay actualizaciones nuevas, tienes la ultima version.", "info"); return; }
    showToast(r?.message || "No se pudo iniciar la comprobacion.", "warning");
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <PageHeader
        title="Configuracion"
        description="Sistema, accesibilidad y contrasena"
        icon={Settings}
      />

      {/* Info de la app */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info size={15} className="text-[#2f8dff]" /> Informacion del sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appInfo ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <InfoRow label="Producto"          value={productDisplayName(appInfo)} />
              <InfoRow label="Version"           value={appInfo.version != null ? `v${appInfo.version}` : "—"} />
              <InfoRow label="Sistema operativo" value={systemOperatingSummary(appInfo)} />
              <InfoRow label="Instalacion"       value={installModeLabel(appInfo)} />
              <InfoRow label="Datos de la app"   value={appInfo.userDataPath} valueClassName="break-all text-xs font-normal leading-snug" />
            </div>
          ) : (
            <p className="text-sm text-[#9ab0c7]">Cargando...</p>
          )}
        </CardContent>
      </Card>

      {/* Tamaño de texto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type size={15} className="text-[#9ab0c7]" /> Lectura en pantalla
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#9ab0c7] mb-3">
            Tamano de texto en toda la aplicacion. Atajos: Alt + + / Alt + - / Alt + 0 (restablecer);
            Alt + Enter (pantalla completa); Alt + 1–9 para navegar modulos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={fontPercent === 100 ? "secondary" : "ghost"} size="sm" onClick={() => setFontPercent(100)}>Normal</Button>
            <Button type="button" variant={fontPercent === 112 ? "secondary" : "ghost"} size="sm" onClick={() => setFontPercent(112)}>Grande</Button>
            <Button type="button" variant={fontPercent === 125 ? "secondary" : "ghost"} size="sm" onClick={() => setFontPercent(125)}>Muy grande</Button>
          </div>
        </CardContent>
      </Card>

      {/* Estado de BD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={15} className="text-[#39d48f]" /> Base de datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={dbHealthStatus === true ? "success" : dbHealthStatus === false ? "danger" : "default"}>
              {dbHealthStatus === null ? "Verificando..." : dbHealthStatus ? "Conectada" : "Error"}
            </Badge>
            <span className="text-sm text-[#9ab0c7]">PostgreSQL — Neon (nube)</span>
            <Button variant="ghost" size="sm" onClick={async () => {
              const ok = await dbRefresh();
              showToast(ok ? "Base de datos respondiendo correctamente." : "No se pudo conectar.", ok ? "success" : "warning");
            }}>
              Verificar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actualizaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw size={15} className="text-[#2f8dff]" /> Actualizaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#9ab0c7] mb-3">Busca manualmente una version nueva publicada.</p>
          <Button variant="secondary" type="button" onClick={handleCheckUpdates}>
            <RefreshCw size={14} className="mr-2" /> Buscar actualizaciones
          </Button>
        </CardContent>
      </Card>

      {/* Historial de versiones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={15} className="text-[#9ab0c7]" /> Historial de versiones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#9ab0c7] mb-3">
            Consulta que incluye cada version instalada en este equipo.
          </p>
          <VersionHistory currentVersion={appInfo?.version} />
        </CardContent>
      </Card>

      {/* Almacenamiento y limpieza */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive size={15} className="text-[#2f8dff]" /> Almacenamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          {/* Barra de uso */}
          {storageStats ? (() => {
            const pct = Math.min(100, (storageStats.totalBytes / NEON_FREE_LIMIT_BYTES) * 100);
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between text-sm">
                  <span className="text-[#9ab0c7]">Documentos adjuntos en Neon</span>
                  <span className="text-[#eaf2fb] font-medium tabular-nums">
                    {formatBytes(storageStats.totalBytes)}
                    <span className="text-[#9ab0c7] font-normal"> / 512 MB</span>
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#1a2e44] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${storageBarColor(pct)}`}
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#9ab0c7]">
                  <span>{storageStats.totalCount} documento(s) registrado(s)</span>
                  <span>{storageStats.cloudCount} con archivo en la nube</span>
                  {storageStats.orphanCount > 0 && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      {storageStats.orphanCount} huerfano(s) — {formatBytes(storageStats.orphanBytes)} recuperables
                    </span>
                  )}
                </div>
              </div>
            );
          })() : (
            <p className="text-sm text-[#9ab0c7]">
              {loadingStorage ? "Analizando almacenamiento..." : "Presiona Analizar para ver el uso."}
            </p>
          )}

          {/* Botón analizar */}
          <div>
            <Button
              type="button" variant="secondary" size="sm"
              onClick={loadStorageData}
              disabled={loadingStorage || dbHealthStatus !== true}
              title={dbTitle}
            >
              <RotateCcw size={13} className={`mr-1.5 ${loadingStorage ? "animate-spin" : ""}`} />
              {loadingStorage ? "Analizando..." : storageStats ? "Actualizar" : "Analizar almacenamiento"}
            </Button>
          </div>

          {/* Documentos huérfanos */}
          {storageStats && (
            <div className="border border-[#1e3651] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOrphans((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-[#1a2e44]/60 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium text-[#eaf2fb]">
                  {storageStats.orphanCount > 0
                    ? <AlertTriangle size={14} className="text-amber-400" />
                    : <ShieldCheck   size={14} className="text-[#39d48f]" />
                  }
                  Documentos huerfanos
                  <Badge variant={storageStats.orphanCount > 0 ? "warning" : "success"} className="ml-1">
                    {storageStats.orphanCount}
                  </Badge>
                </span>
                {showOrphans ? <ChevronUp size={14} className="text-[#9ab0c7]" /> : <ChevronDown size={14} className="text-[#9ab0c7]" />}
              </button>

              {showOrphans && (
                <div className="border-t border-[#1e3651] px-4 py-3 flex flex-col gap-3">
                  {orphanDocs?.length === 0 ? (
                    <p className="text-sm text-[#9ab0c7]">No hay documentos huerfanos. Todo limpio.</p>
                  ) : (
                    <>
                      <p className="text-xs text-[#9ab0c7]">
                        Estos archivos pertenecen a equipos o registros que ya fueron eliminados. Puedes eliminarlos con seguridad.
                      </p>
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                        {orphanDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-lg bg-[#0d1b2b]/60">
                            <div className="flex items-center gap-2 min-w-0">
                              <DocIcon mimeType={doc.mimeType} />
                              <span className="text-[#eaf2fb] truncate max-w-[220px]">{doc.fileName}</span>
                              <span className="text-[#9ab0c7] shrink-0">{doc.entityType}</span>
                            </div>
                            <span className="text-amber-400 shrink-0 tabular-nums">{formatBytes(doc.sizeBytes)}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button" variant="danger" size="sm"
                        onClick={handleDeleteOrphans}
                        disabled={deletingIds || !canMutateOps}
                        className="self-start"
                      >
                        <Trash2 size={13} className="mr-1.5" />
                        Eliminar {orphanDocs.length} huerfano(s) — {formatBytes(storageStats.orphanBytes)}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documentos más pesados */}
          {storageStats && (
            <div className="border border-[#1e3651] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowHeavy((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-[#1a2e44]/60 transition-colors"
              >
                <span className="font-medium text-[#eaf2fb] flex items-center gap-2">
                  <FileText size={14} className="text-[#2f8dff]" />
                  Documentos mas pesados
                  {selectedIds.size > 0 && (
                    <Badge variant="info" className="ml-1">{selectedIds.size} sel.</Badge>
                  )}
                </span>
                {showHeavy ? <ChevronUp size={14} className="text-[#9ab0c7]" /> : <ChevronDown size={14} className="text-[#9ab0c7]" />}
              </button>

              {showHeavy && (
                <div className="border-t border-[#1e3651] px-4 py-3 flex flex-col gap-3">
                  {!heavyDocs?.length ? (
                    <p className="text-sm text-[#9ab0c7]">No hay documentos registrados.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleSelectAll(heavyDocs)}
                          className="text-xs text-[#2f8dff] hover:underline"
                        >
                          {selectedIds.size === heavyDocs.length ? "Deseleccionar todo" : "Seleccionar todo"}
                        </button>
                        <span className="text-xs text-[#9ab0c7]">Top {heavyDocs.length} por tamaño</span>
                      </div>

                      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                        {heavyDocs.map((doc) => (
                          <label
                            key={doc.id}
                            className={`flex items-center gap-3 text-xs py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                              selectedIds.has(doc.id)
                                ? "bg-red-500/10 border border-red-500/30"
                                : "bg-[#0d1b2b]/60 hover:bg-[#1a2e44]/60 border border-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(doc.id)}
                              onChange={() => toggleDocSelection(doc.id)}
                              className="accent-[#2f8dff] shrink-0"
                            />
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <DocIcon mimeType={doc.mimeType} />
                              <span className="text-[#eaf2fb] truncate">{doc.fileName}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[#9ab0c7]">{doc.entityType}</span>
                              <span className="text-[#eaf2fb] font-medium tabular-nums w-20 text-right">
                                {formatBytes(doc.sizeBytes)}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>

                      {selectedIds.size > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-[#1e3651]">
                          <span className="text-xs text-[#9ab0c7]">
                            {selectedIds.size} sel. — {formatBytes(
                              heavyDocs.filter((d) => selectedIds.has(d.id)).reduce((a, d) => a + d.sizeBytes, 0)
                            )} a liberar
                          </span>
                          <Button
                            type="button" variant="danger" size="sm"
                            onClick={handleDeleteSelected}
                            disabled={deletingIds || !canMutateOps}
                          >
                            <Trash2 size={13} className="mr-1.5" />
                            {deletingIds ? "Eliminando..." : "Eliminar seleccionados"}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup / Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud size={15} className="text-[#39d48f]" /> Copias de seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 bg-[#39d48f]/5 border border-[#39d48f]/20 rounded-xl p-4">
            <ShieldCheck size={18} className="text-[#39d48f] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-[#eaf2fb] font-medium">Copias automáticas gestionadas por Neon</p>
              <p className="text-sm text-[#9ab0c7]">
                La base de datos está en la nube (PostgreSQL — Neon). Neon realiza copias de seguridad
                automáticas con retención de 7 días en el plan gratuito. No se requiere ninguna acción manual.
              </p>
              <a
                href="https://neon.com/docs/manage/backups"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#2f8dff] hover:underline mt-1 w-fit"
              >
                Ver documentación de backups en Neon →
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cambiar contraseña */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={15} className="text-[#e0a91f]" /> Cambiar contrasena
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3 max-w-sm">
            <Field label="Contrasena actual">
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" disabled={dbHealthStatus !== true} />
            </Field>
            <Field label="Nueva contrasena">
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Min. 6 caracteres" disabled={dbHealthStatus !== true} />
            </Field>
            <Field label="Confirmar nueva contrasena">
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repetir contrasena" disabled={dbHealthStatus !== true} />
            </Field>
            <Button type="submit" className="self-start mt-1" disabled={dbHealthStatus !== true} title={dbTitle}>
              Guardar contrasena
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sesion actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor size={15} className="text-[#9ab0c7]" /> Sesion actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Usuario" value={user?.username} />
            <InfoRow label="Rol"     value={user?.role} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, valueClassName }) {
  return (
    <>
      <span className="text-[#9ab0c7]">{label}</span>
      <span className={valueClassName ? `text-[#eaf2fb] font-medium ${valueClassName}` : "text-[#eaf2fb] font-medium"}>
        {value || "—"}
      </span>
    </>
  );
}
