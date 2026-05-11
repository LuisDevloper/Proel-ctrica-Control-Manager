import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Field } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { KeyRound, Info, Database, Monitor } from "lucide-react";

export function Configuracion({ user }) {
  const [appInfo, setAppInfo]         = useState(null);
  const [dbStatus, setDbStatus]       = useState(null);
  const [currentPwd, setCurrentPwd]   = useState("");
  const [newPwd, setNewPwd]           = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const { showToast }                 = useToast();
  const { run }                       = useAsync();

  useEffect(() => {
    window.proelectricaApi.getAppInfo().then(setAppInfo);
    window.proelectricaApi.dbPing().then(r => setDbStatus(r.ok));
  }, []);

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

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Configuracion</h2>

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
              <InfoRow label="Aplicacion"  value={appInfo.name} />
              <InfoRow label="Version"     value={`v${appInfo.version}`} />
              <InfoRow label="Electron"    value={appInfo.electronVersion} />
              <InfoRow label="Node.js"     value={appInfo.nodeVersion} />
              <InfoRow label="Plataforma"  value={appInfo.platform} />
            </div>
          ) : (
            <p className="text-sm text-[#9ab0c7]">Cargando...</p>
          )}
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
          <div className="flex items-center gap-3">
            <Badge variant={dbStatus === true ? "success" : dbStatus === false ? "danger" : "default"}>
              {dbStatus === null ? "Verificando..." : dbStatus ? "Conectada" : "Error"}
            </Badge>
            <span className="text-sm text-[#9ab0c7]">SQLite — proelectrica.db</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                setDbStatus(null);
                window.proelectricaApi.dbPing().then(r => {
                  setDbStatus(r.ok);
                  showToast(r.ok ? "Base de datos respondiendo correctamente." : "No se pudo conectar.", r.ok ? "success" : "warning");
                });
              }}
            >
              Verificar
            </Button>
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
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" />
            </Field>
            <Field label="Nueva contrasena">
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Min. 6 caracteres" />
            </Field>
            <Field label="Confirmar nueva contrasena">
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repetir contrasena" />
            </Field>
            <Button type="submit" className="self-start mt-1">Guardar contrasena</Button>
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

function InfoRow({ label, value }) {
  return (
    <>
      <span className="text-[#9ab0c7]">{label}</span>
      <span className="text-[#eaf2fb] font-medium">{value || "—"}</span>
    </>
  );
}
