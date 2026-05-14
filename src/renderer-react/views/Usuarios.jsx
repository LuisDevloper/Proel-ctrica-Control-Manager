import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Field, Select } from "../components/ui/Input";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { ConfirmModal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useDbHealth } from "../context/DbHealthContext";
import { Plus, Trash2, KeyRound, ShieldCheck, Shield, Eye } from "lucide-react";

const ROLES = ["ADMIN", "OPERADOR", "VISOR"];

const ROLE_META = {
  ADMIN:    { label: "Administrador", color: "bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44]", icon: ShieldCheck },
  OPERADOR: { label: "Operador",      color: "bg-[#29a16a22] text-[#29a16a] border border-[#29a16a44]", icon: Shield },
  VISOR:    { label: "Solo lectura",  color: "bg-[#9ab0c722] text-[#9ab0c7] border border-[#9ab0c744]", icon: Eye },
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.VISOR;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

const EMPTY_FORM = { username: "", password: "", confirmPassword: "", role: "OPERADOR" };

export function Usuarios({ user: currentUser }) {
  const [users, setUsers]       = useState([]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);
  const [resetId, setResetId]   = useState(null);
  const [newPwd, setNewPwd]     = useState("");
  const { showToast }           = useToast();
  const { run }                 = useAsync();
  const { dbWritable }          = useDbHealth();
  const dbTitle                 = !dbWritable ? "Sin conexion a la base de datos." : undefined;

  const load = useCallback(async () => {
    setUsers(await window.proelectricaApi.getUsers());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!resetId) return;
    const handler = (e) => {
      if (e.key === "Escape") { setResetId(null); setNewPwd(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [resetId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.username || !form.password) { showToast("Usuario y contrasena son obligatorios.", "warning"); return; }
    if (form.password.length < 6) { showToast("La contrasena debe tener al menos 6 caracteres.", "warning"); return; }
    if (form.password !== form.confirmPassword) { showToast("Las contrasenas no coinciden.", "warning"); return; }
    const { ok } = await run(() => window.proelectricaApi.createUser({ username: form.username, password: form.password, role: form.role }), "Usuario creado correctamente.");
    if (ok) { setForm(EMPTY_FORM); load(); }
  }

  async function handleRoleChange(userId, role) {
    const r = await run(() => window.proelectricaApi.updateUserRole({ id: userId, role }), "Rol actualizado.");
    if (r.ok) load();
  }

  async function handleResetPassword() {
    if (!newPwd || newPwd.length < 6) { showToast("La nueva contrasena debe tener al menos 6 caracteres.", "warning"); return; }
    const r = await run(() => window.proelectricaApi.resetUserPassword({ id: resetId, password: newPwd }), "Contrasena restablecida.");
    if (r.ok) { setResetId(null); setNewPwd(""); load(); }
  }

  async function handleDelete() {
    const { ok } = await run(() => window.proelectricaApi.deleteUser(deleteId), "Usuario eliminado.");
    setDeleteId(null);
    if (ok) load();
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Gestion de usuarios</h2>

      {/* Roles info */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(ROLE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={key} className={`flex items-center gap-3 rounded-xl border p-3 ${meta.color.split(" ").filter(c => c.startsWith("border")).join(" ")} bg-[#0d1825]`}>
              <Icon size={18} className={meta.color.split(" ").find(c => c.startsWith("text-"))} />
              <div>
                <p className="text-xs font-bold text-[#eaf2fb]">{meta.label}</p>
                <p className="text-[11px] text-[#9ab0c7]">
                  {key === "ADMIN" ? "Acceso total" : key === "OPERADOR" ? "Crear y editar" : "Solo consultar"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Crear usuario */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={15}/> Crear usuario</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre de usuario*">
                <Input placeholder="Ej: jperez" value={form.username} onChange={e => setForm({...form, username: e.target.value})} autoComplete="off" />
              </Field>
              <Field label="Rol">
                <Select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </Select>
              </Field>
              <Field label="Contrasena*">
                <Input type="password" placeholder="Min. 6 caracteres" value={form.password} onChange={e => setForm({...form, password: e.target.value})} autoComplete="new-password" />
              </Field>
              <Field label="Confirmar contrasena*">
                <Input type="password" placeholder="Repetir contrasena" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} autoComplete="new-password" />
              </Field>
            </div>
            <Button type="submit" className="mt-3" disabled={!dbWritable} title={dbTitle}>Crear usuario</Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <Card>
        <CardHeader><CardTitle>Usuarios registrados ({users.length})</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0
            ? <p className="text-sm text-[#9ab0c7]">No hay usuarios.</p>
            : <Table>
                <Thead><tr><Th>Usuario</Th><Th>Rol</Th><Th>Acciones</Th></tr></Thead>
                <Tbody>
                  {users.map(u => (
                    <Tr key={u.id}>
                      <Td className="font-medium">
                        {u.username}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-[10px] bg-[#2f8dff22] text-[#2f8dff] border border-[#2f8dff44] px-1.5 py-0.5 rounded-full">Tú</span>
                        )}
                      </Td>
                      <Td>
                        {u.id === currentUser?.id
                          ? <RoleBadge role={u.role} />
                          : <Select
                              value={u.role}
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                              className="text-xs py-1"
                              disabled={!dbWritable}
                              title={dbTitle}
                            >
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                            </Select>
                        }
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost" size="sm"
                            className="text-xs text-[#9ab0c7] hover:text-[#e0a91f]"
                            title={dbTitle || "Restablecer contrasena"}
                            disabled={!dbWritable}
                            onClick={() => { setResetId(u.id); setNewPwd(""); }}
                          >
                            <KeyRound size={13} className="mr-1" /> Contrasena
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button
                              variant="ghost" size="icon"
                              className="hover:text-[#e07070]"
                              onClick={() => setDeleteId(u.id)}
                              disabled={!dbWritable}
                              title={dbTitle}
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
          }
        </CardContent>
      </Card>

      {/* Modal restablecer contraseña */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setResetId(null)} />
          <div className="relative z-10 bg-[#111d2c] border border-[#2a3d57] rounded-2xl shadow-2xl p-6 w-80 animate-slideUp">
            <h3 className="text-base font-bold text-[#eaf2fb] mb-1">Restablecer contrasena</h3>
            <p className="text-xs text-[#9ab0c7] mb-4">Ingresa la nueva contrasena para el usuario.</p>
            <Field label="Nueva contrasena">
              <Input type="password" placeholder="Min. 6 caracteres" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoFocus autoComplete="new-password" />
            </Field>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setResetId(null)} className="flex-1 py-2 rounded-xl text-sm border border-[#2a3d57] text-[#9ab0c7] hover:bg-white/5 cursor-pointer transition-all">Cancelar</button>
              <button type="button" onClick={handleResetPassword} disabled={!dbWritable} title={dbTitle} className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#2f8dff] hover:bg-[#4a9fff] text-white cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} message="Se eliminara este usuario de forma permanente." />
    </div>
  );
}
