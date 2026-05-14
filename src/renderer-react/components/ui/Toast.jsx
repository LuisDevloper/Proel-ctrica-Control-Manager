import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { AlertTriangle, Info } from "lucide-react";
import { SuccessCelebration } from "./SuccessCelebration";

const ToastContext = createContext(null);

const CELEBRATION_MS = 2200;

const icons = {
  warning: <AlertTriangle size={16} className="text-[#e0a91f]" />,
  info:    <Info size={16} className="text-[#5fb3ff]" />,
};

const borders = {
  warning: "border-[#e0a91f]",
  info:    "border-[#2f8dff]",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const celebrationTimerRef = useRef(null);

  useEffect(() => () => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
    }
  }, []);

  const showToast = useCallback((message, type = "info") => {
    if (type === "success") {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = null;
      }
      const id = Date.now();
      setCelebration({ message, id });
      celebrationTimerRef.current = window.setTimeout(() => {
        setCelebration((c) => (c?.id === id ? null : c));
        celebrationTimerRef.current = null;
      }, CELEBRATION_MS);
      return;
    }

    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {celebration ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-auto bg-black/45 animate-celebrationBackdrop"
        >
          <SuccessCelebration message={celebration.message} />
        </div>
      ) : null}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 min-w-[240px] max-w-[420px] px-4 py-3 rounded-xl border",
              "bg-[#1b2b3f] text-[#e9eef5] text-sm shadow-xl pointer-events-auto",
              "animate-in slide-in-from-right-4 fade-in duration-200",
              borders[toast.type] || "border-[#355071]"
            )}
          >
            {icons[toast.type] || icons.info}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { showToast: () => {} };
  }
  return ctx;
}
