import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Field } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useDbHealth } from "../context/DbHealthContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { canMutateRecords, READ_ONLY_ROLE_TITLE } from "../lib/permissions";
import { KeyRound, Info, Database, Monitor, RefreshCw, Type, Settings, History, Cloud, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { VersionHistory } from "../components/settings/VersionHistory";

/** Compat: respuesta antigua del proceso principal (solo `platform`) o renderer recargado sin reiniciar Electron. */
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
  const v = info.productName ?? info.name;
  return v || "—";
}

function systemOperatingSummary(info) {
  if (!info) return "—";
  const os = info.osName || platformToOsName(info.platform) || "—";
  const arch = info.arch || guessArchFromUserAgent() || "—";
  return `${os}, ${arch}`;
}

function installModeLabel(info) {
  if (!info) return "—";
  if (info.packaged === true) return "Aplicacion instalada";
  if (info.packaged === false) return "Modo desarrollo";
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return "Modo desarrollo";
  return "Aplicacion instalada";
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
  const dbTitle                       = dbHealthStatus !== true ? "Sin conexion a la base de datos." : undefined;
  const canMutateOps                  = canMutateRecords(user?.role);

  useEffect(() => {
    let cancelled = false;
    window.proelectricaApi.getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => {
        if (!cancelled) showToast("No se pudo obtener la informacion del sistema.", "warning");
      });
    return () => { cancelled = true; };
  }, [showToast]);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) {
      showToast("Completa todos los campos.", "warning"); return;
    }
    if (newPwd.length < 6) {
      showToast("La nueva contrasena debe tener al menos 6 caracteres.", "warning"); return;
    }
    if (newPwd !== confirmPwd) {
      showToast("Las contrasenas nuevas no coinciden.", "warning"); return;
    }
    const { ok } = await run(
      () => window.proelectricaApi.changePassword({ userId: user.id, currentPassword: currentPwd, newPassword: newPwd }),
      "Contrasena actualizada correctamente."
    );
    if (ok) { setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }
  }

  async function handleCheckUpdates() {
    const msgUltimaVersion = "No hay actualizaciones nuevas, Tienes la ultima version.";
    const r = await window.proelectricaApi.checkForUpdates();
    if (r?.reason === "dev") {
      showToast("La busqueda de actualizaciones solo funciona en la aplicacion instalada (no en modo desarrollo).", "info");
      return;
    }
    if (r?.reason === "no_updater") {
      showToast("El comprobador de actualizaciones no esta disponible.", "warning");
      return;
    }
    if (r?.ok) {
      if (!r.updateAvailable) {
        showToast(msgUltimaVersion, "info");
      }
      return;
    }
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
              <InfoRow label="Producto" value={productDisplayName(appInfo)} />
              <InfoRow label="Version" value={appInfo.version != null ? `v${appInfo.version}` : "—"} />
              <InfoRow label="Sistema operativo" value={systemOperatingSummary(appInfo)} />
              <InfoRow label="Instalacion" value={installModeLabel(appInfo)} />
              <InfoRow
                label="Datos de la app"
                value={appInfo.userDataPath}
                valueClassName="break-all text-xs font-normal leading-snug"
              />
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
            Tamano de texto en toda la aplicacion. Atajes: Alt + + / Alt + - / Alt + 0 (restablecer tamano);
            Alt + Enter (pantalla completa); en el menu lateral Alt + 1 a 9 para ir al modulo (segun su rol).
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
            <Button
              variant="ghost" size="sm"
              onClick={async () => {
                const ok = await dbRefresh();
                showToast(ok ? "Base de datos respondiendo correctamente." : "No se pudo conectar.", ok ? "success" : "warning");
              }}
            >
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
          <p className="text-sm text-[#9ab0c7] mb-3">
            Busca manualmente una version nueva publicada.
          </p>
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
            Consulta que incluye cada version de SIGEMT instalada en este equipo.
          </p>
          <VersionHistory currentVersion={appInfo?.version} />
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
              <p className="text-sm text-[#eaf2fb] font-medium">
                Copias automáticas gestionadas por Neon
              </p>
              <p className="text-sm text-[#9ab0c7]">
                La base de datos está en la nube (PostgreSQL — Neon). Neon realiza copias de seguridad
                automáticas con retención de 7 días en el plan gratuito. No se requiere ninguna acción manual.
              </p>
              <a
                href="https://neon.tech/docs/introduction/backups"
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
            <Button type="submit" className="self-start mt-1" disabled={dbHealthStatus !== true} title={dbTitle}>Guardar contrasena</Button>
          </form>
        </CardContent>
      </Card>

      {/* Info sesion */}
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
      <span className={valueClassName ? `text-[#eaf2fb] font-medium ${valueClassName}` : "text-[#eaf2fb] font-medium"}>{value || "—"}</span>
    </>
  );
}
