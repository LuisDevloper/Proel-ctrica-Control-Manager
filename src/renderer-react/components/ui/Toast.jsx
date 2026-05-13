import React, { createContext, useContext, useState, useCallback } from "react";
import { cn } from "../../lib/utils";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const icons = {
  success: <CheckCircle size={16} className="text-[#39d48f]" />,
  warning: <AlertTriangle size={16} className="text-[#e0a91f]" />,
  info:    <Info size={16} className="text-[#5fb3ff]" />,
};

const borders = {
  success: "border-[#29a16a]",
  warning: "border-[#e0a91f]",
  info:    "border-[#2f8dff]",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
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
