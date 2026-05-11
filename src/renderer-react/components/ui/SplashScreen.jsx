import React, { useEffect, useState } from "react";
import { AppLogo } from "./AppLogo";

export function SplashScreen({ onFinish }) {
  const [phase, setPhase] = useState("in"); // "in" | "idle" | "out"
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simula progreso de carga
    const steps = [
      { delay: 100,  pct: 20,  label: "Iniciando motor..." },
      { delay: 400,  pct: 50,  label: "Conectando base de datos..." },
      { delay: 800,  pct: 80,  label: "Cargando modulos..." },
      { delay: 1200, pct: 100, label: "Listo" }
    ];

    steps.forEach(({ delay, pct }) => {
      setTimeout(() => setProgress(pct), delay);
    });

    // Inicia fade-out después de que la barra llegue al 100%
    setTimeout(() => setPhase("out"), 1700);

    // Notifica al padre cuando termina la animación de salida
    setTimeout(() => onFinish(), 2200);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "radial-gradient(900px 600px at 30% 20%, #15365f44, transparent 60%), #070b10",
        opacity: phase === "out" ? 0 : 1,
        transition: "opacity 0.5s ease"
      }}
    >
      {/* Resplandor de fondo */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[#1a4a8a] opacity-10 blur-[120px] pointer-events-none" />

      <div
        className="flex flex-col items-center gap-6 relative"
        style={{
          opacity: phase === "out" ? 0 : 1,
          transform: phase === "out" ? "translateY(-12px) scale(0.97)" : "translateY(0) scale(1)",
          transition: "opacity 0.4s ease, transform 0.4s ease"
        }}
      >
        {/* Logo con anillo giratorio */}
        <div className="relative flex items-center justify-center">
          <svg
            className="absolute"
            width="180" height="180"
            viewBox="0 0 180 180"
            style={{ animation: "spin 2.5s linear infinite" }}
          >
            <circle
              cx="90" cy="90" r="82"
              fill="none"
              stroke="url(#grad)"
              strokeWidth="2"
              strokeDasharray="160 360"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#2f8dff" stopOpacity="0" />
                <stop offset="60%"  stopColor="#2f8dff" stopOpacity="1" />
                <stop offset="100%" stopColor="#2f8dff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <AppLogo size="xl" />
        </div>

        {/* Nombre */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Proelectrica</h1>
          <p className="text-xs text-[#7a9bb8] tracking-widest uppercase mt-1">Control Manager</p>
        </div>

        {/* Barra de progreso */}
        <div className="w-56 flex flex-col items-center gap-2">
          <div className="w-full h-1 rounded-full bg-[#1a2d44] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #1a5aad, #2f8dff)",
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 8px #2f8dff88"
              }}
            />
          </div>
          <p className="text-[11px] text-[#4a6a8a]">{progress}%</p>
        </div>
      </div>

      <p className="absolute bottom-6 text-[11px] text-[#2a3d57]">
        Proelectrica © {new Date().getFullYear()}
      </p>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
