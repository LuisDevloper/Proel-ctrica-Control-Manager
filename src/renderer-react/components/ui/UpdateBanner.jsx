import React, { useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  CheckCircle,
  X,
  Loader2,
  ScrollText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";
import { VersionReleaseNotes } from "../settings/VersionHistory";

const IMPORTANT_EVENTS = new Set(["available", "downloaded", "error"]);

function compactLabel(event, version, percent) {
  switch (event) {
    case "checking":
      return "Comprobando actualizaciones…";
    case "available":
      return `Nueva versión ${version}`;
    case "downloading":
      return `Descargando… ${percent ?? 0}%`;
    case "downloaded":
      return `Versión ${version} lista`;
    case "error":
      return "Error al comprobar actualizaciones";
    default:
      return "Actualización";
  }
}

export function UpdateBanner({ variant = "inline" }) {
  const isOverlay = variant === "overlay";
  const [state, setState] = useState(null);
  const [renderState, setRenderState] = useState(null);
  const [releaseModal, setReleaseModal] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.proelectricaApi?.onUpdaterEvent) return;
    const unsub = window.proelectricaApi.onUpdaterEvent((data) => {
      if (data.event === "checking") {
        setState({ event: "checking" });
        setExpanded(false);
        return;
      }
      if (data.event === "up-to-date") {
        setState((prev) => (prev?.event === "checking" ? null : prev));
        return;
      }
      if (data.event === "error") {
        const msg = String(data.message || "");
        const is404 = /404|not found|Cannot find latest\.yml|latest\.yml/i.test(msg);
        if (is404) {
          setState({
            event: "error",
            message:
              "GitHub no devolvió latest.yml o el release no tiene el instalador publicado. En cada release deben estar el .exe y el archivo latest.yml generado por electron-builder (carpeta dist). La etiqueta del release debe ser una versión mayor que la instalada.",
          });
          setExpanded(isOverlay);
          return;
        }
        const isCert = /ERR_CERT|CERT_AUTHORITY|certificate|SSL|TLS/i.test(msg);
        if (isCert) {
          setState({
            event: "error",
            message:
              "No se pudo verificar el certificado HTTPS al conectar con GitHub (red corporativa, antivirus o fecha/hora del equipo incorrecta). Actualice manualmente con el instalador .exe o pida a informática que confíe en las descargas de github.com.",
          });
          setExpanded(isOverlay);
          return;
        }
      }
      setState(data);
      if (isOverlay && IMPORTANT_EVENTS.has(data.event)) {
        setExpanded(true);
      }
    });
    return unsub;
  }, [isOverlay]);

  useEffect(() => {
    let cancelled = false;
    window.proelectricaApi?.getAppInfo?.()
      .then((info) => { if (!cancelled) setCurrentVersion(info?.version); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!state) return;
    setRenderState(state);
    setVisible(true);
  }, [state]);

  useEffect(() => {
    if (state || !renderState) return;
    setVisible(false);
    const id = window.setTimeout(() => setRenderState(null), 300);
    return () => window.clearTimeout(id);
  }, [state, renderState]);

  const showReleaseNotes = (version) => setReleaseModal(version);

  if (!renderState) return null;

  const { event, version, percent, message } = renderState;

  const configs = {
    checking: {
      icon: Loader2,
      bg: "border-[color-mix(in_srgb,var(--primary)_38%,var(--glass-border))]",
      text: "text-[#c5d8ef]",
      msg: "Comprobando actualizaciones…",
      showClose: false,
    },
    available: {
      icon: Download,
      bg: "border-[color-mix(in_srgb,var(--primary)_42%,var(--glass-border))]",
      text: "text-[#7ab8ff]",
      msg: `Nueva versión ${version} disponible. Descargando en segundo plano...`,
      showClose: false,
    },
    downloading: {
      icon: RefreshCw,
      bg: "border-[color-mix(in_srgb,var(--primary)_42%,var(--glass-border))]",
      text: "text-[#7ab8ff]",
      msg: `Descargando actualización... ${percent ?? 0}%`,
      showClose: false,
    },
    downloaded: {
      icon: CheckCircle,
      bg: "border-[color-mix(in_srgb,var(--success)_42%,var(--glass-border))]",
      text: "text-[#5edc9e]",
      msg: `Versión ${version} lista. Se instalará al cerrar la app.`,
      showClose: true,
      action: { label: "Instalar ahora", onClick: () => window.proelectricaApi.installUpdate() },
    },
    error: {
      icon: X,
      bg: "border-[color-mix(in_srgb,var(--danger)_42%,var(--glass-border))]",
      text: "text-[#e07070]",
      msg: `Error de actualización: ${message}`,
      showClose: true,
    },
  };

  const cfg = configs[event];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const canShowNotes = version && (event === "available" || event === "downloaded");
  const canCollapse = isOverlay && (IMPORTANT_EVENTS.has(event) || event === "downloading");
  const showCompact = isOverlay && !expanded;

  function handleDismiss() {
    setState(null);
  }

  const panel = (
    <div
      className={cn(
        "rounded-xl border font-medium text-xs transition-[box-shadow,background-color] duration-300",
        cfg.bg,
        cfg.text,
        isOverlay ? "login-update-banner__panel pcm-glass-strong shadow-[0_8px_32px_#00000055]" : "pcm-glass flex items-center gap-3 mb-3 px-4 py-2.5",
        isOverlay && (showCompact ? "login-update-banner__panel--compact" : "login-update-banner__panel--expanded")
      )}
      role={
        event === "checking"
          ? "status"
          : event === "error"
            ? "alert"
            : undefined
      }
      aria-live={event === "checking" ? "polite" : event === "error" ? "assertive" : undefined}
    >
      {showCompact ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="login-update-banner__compact-btn flex w-full items-center gap-2 px-3 py-2 text-left cursor-pointer border-none bg-transparent text-inherit"
          aria-expanded={false}
        >
          <Icon
            size={13}
            className={cn("shrink-0", (event === "downloading" || event === "checking") && "animate-spin")}
            aria-hidden
          />
          <span className="flex-1 truncate">{compactLabel(event, version, percent)}</span>
          <ChevronDown size={14} className="shrink-0 opacity-60" aria-hidden />
        </button>
      ) : (
        <div className={cn(isOverlay ? "flex flex-col gap-2.5 px-3 py-2.5" : "contents")}>
          <div className={cn("flex items-center gap-3", isOverlay && "min-h-[1.25rem]")}>
            <Icon
              size={14}
              className={cn("shrink-0", (event === "downloading" || event === "checking") && "animate-spin")}
              aria-hidden
            />
            <span className={cn("flex-1", isOverlay && "leading-snug")}>{cfg.msg}</span>
            {isOverlay && canCollapse && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent p-0.5 shrink-0"
                aria-label="Contraer aviso"
                title="Contraer"
              >
                <ChevronUp size={12} />
              </button>
            )}
            {cfg.showClose && (
              <button
                type="button"
                onClick={handleDismiss}
                className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent p-0.5 shrink-0"
                aria-label="Cerrar aviso"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {event === "downloading" && (
            <div className={cn("rounded-full bg-white/10 overflow-hidden", isOverlay ? "h-1.5 w-full" : "w-24 h-1.5")}>
              <div
                className="h-full rounded-full bg-[#2f8dff] transition-all duration-300"
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>
          )}

          {(cfg.action || canShowNotes) && (
            <div className={cn("flex flex-wrap items-center gap-2", !isOverlay && "contents")}>
              {cfg.action && (
                <button
                  type="button"
                  onClick={cfg.action.onClick}
                  className="px-3 py-1 rounded-lg bg-[#29a16a]/20 hover:bg-[#29a16a]/40 text-[#5edc9e] transition-colors cursor-pointer border-none text-xs font-semibold"
                >
                  {cfg.action.label}
                </button>
              )}

              {canShowNotes && (
                <button
                  type="button"
                  onClick={() => showReleaseNotes(version)}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-current transition-colors cursor-pointer border border-white/10 text-xs font-semibold inline-flex items-center gap-1"
                >
                  <ScrollText size={12} /> Novedades
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isOverlay ? (
        <div
          className={cn(
            "login-update-banner fixed top-3 left-1/2 z-[60] w-[min(calc(100%-1.5rem),26rem)] -translate-x-1/2 pointer-events-none",
            !visible && "login-update-banner--hide"
          )}
        >
          <div className="pointer-events-auto">{panel}</div>
        </div>
      ) : (
        panel
      )}

      <Modal
        open={!!releaseModal}
        onClose={() => setReleaseModal(null)}
        title={releaseModal ? `Novedades de la version ${releaseModal}` : ""}
        className="max-w-lg"
      >
        <VersionReleaseNotes version={releaseModal} currentVersion={currentVersion} />
      </Modal>
    </>
  );
}
