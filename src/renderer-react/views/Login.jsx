import React, { useState } from "react";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { Loader2, Lock, User } from "lucide-react";
import { AppLogo } from "../components/ui/AppLogo";

const SAVED_USER_KEY = "pcm-saved-username";

export function Login({ onLogin }) {
  const savedUser = localStorage.getItem(SAVED_USER_KEY) || "";
  const [username, setUsername] = useState(savedUser);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!savedUser);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const { showToast }           = useToast();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await window.proelectricaApi.login({ username, password });
      if (!res.ok) { setError(res.message || "Credenciales incorrectas."); return; }
      if (remember) localStorage.setItem(SAVED_USER_KEY, username);
      else localStorage.removeItem(SAVED_USER_KEY);
      showToast("Bienvenido, " + res.user.username, "success");
      // Animación de salida antes de entrar al dashboard
      setSuccess(true);
      setTimeout(() => onLogin(res.user), 400);
    } catch {
      setError("Error al conectar con la base de datos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        transition: "opacity 0.4s ease",
        opacity: success ? 0 : 1,
      }}
    >

      {/* Fondo con luces */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#1a4a8a] opacity-20 blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[5%] w-[400px] h-[400px] rounded-full bg-[#e0a91f] opacity-10 blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-[#2f8dff] opacity-5 blur-[80px] -translate-x-1/2" />
      </div>

      <div
        className="w-full max-w-[400px] relative z-10"
        style={{
          animation: "slideUp 0.4s cubic-bezier(0.34,1.1,0.64,1) both",
          transition: "transform 0.4s ease, opacity 0.4s ease",
          transform: success ? "scale(0.96) translateY(-8px)" : undefined,
        }}
      >

        {/* Logo + título */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-full bg-[#2f8dff] opacity-20 blur-2xl scale-125" />
            <AppLogo size="xl" className="relative drop-shadow-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Proélectrica
          </h1>
          <p className="text-sm text-[#7a9bb8] mt-1 tracking-widest uppercase font-medium">
            Control Manager
          </p>
        </div>

        {/* Tarjeta */}
        <div className="rounded-2xl border border-[#2a3d57]/80 bg-[#0d1825]/90 backdrop-blur-xl shadow-[0_32px_64px_#00000060] p-7">

          <p className="text-xs text-[#7a9bb8] font-semibold uppercase tracking-widest mb-5">
            Iniciar sesion
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* Campo usuario */}
            <div>
              <label className="block text-xs font-medium text-[#9ab0c7] mb-1.5">Usuario</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6a8a]" />
                <Input
                  className="pl-9"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            </div>

            {/* Campo contraseña */}
            <div>
              <label className="block text-xs font-medium text-[#9ab0c7] mb-1.5">Contrasena</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6a8a]" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="Contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Recordar usuario */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <div
                onClick={() => setRemember(r => !r)}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                  remember
                    ? "bg-[#2f8dff] border-[#2f8dff]"
                    : "bg-transparent border-[#2a3d57] hover:border-[#4a6a8a]"
                }`}
              >
                {remember && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-xs text-[#9ab0c7]">Recordar usuario</span>
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-[#2e1212]/70 border border-[#5c2222] rounded-xl px-3 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#e07070] shrink-0" />
                <p className="text-xs text-[#e07070]">{error}</p>
              </div>
            )}

            {/* Boton */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3 rounded-xl font-semibold text-sm text-white cursor-pointer transition-all duration-150 active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed border-none"
              style={{
                background: "linear-gradient(135deg, #2f8dff 0%, #1354a8 60%, #0d3d80 100%)",
                boxShadow: "0 4px 24px #2f8dff44"
              }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Verificando...</span>
                : "Entrar"
              }
            </button>

          </form>
        </div>

        {/* Pie */}
        <p className="text-center text-[11px] text-[#4a6a8a] mt-5">
          Proélectrica © {new Date().getFullYear()} — Sistema de Control Industrial
        </p>

      </div>
    </div>
  );
}
