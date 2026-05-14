import React, { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Overlay breve con anillo de progreso que se completa y un check que se dibuja en el centro.
 * Usado para confirmaciones de registro / guardado exitoso (toast tipo success).
 */
export function SuccessCelebration({ message, className }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const upd = () => setReduceMotion(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 px-10 py-8 rounded-2xl border shadow-2xl max-w-md mx-4",
        "bg-[var(--panel-soft)] border-[var(--success)] text-[var(--text)] text-center pointer-events-auto",
        "animate-celebrationCardEnter",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("relative w-[7.5rem] h-[7.5rem] shrink-0", reduceMotion && "celebration-reduce-motion")}>
        <svg className="w-full h-full block" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            className="stroke-[var(--border)]"
            strokeWidth="5"
            opacity="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            className="stroke-[var(--success)] celebration-ring-progress"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="289.03"
            strokeDashoffset="289.03"
            transform="rotate(-90 50 50)"
          />
          <path
            className="celebration-check-path stroke-[var(--success)]"
            d="M 30 52 L 45 67 L 72 36"
            fill="none"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
          />
        </svg>
      </div>
      <p className="text-sm sm:text-[0.95rem] leading-snug font-medium text-[var(--text)] px-1">{message}</p>
    </div>
  );
}
