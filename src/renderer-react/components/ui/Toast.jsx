import React, { createContext, useContext, useState, useCallback } from "react";
import { AlertToast } from "./AlertToast";

const ToastContext = createContext(null);

const DURATIONS = {
  success: 3400,
  warning: 4200,
  info: 3600,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info", opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, type, duration: opts.duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-4 left-1/2 z-[10000] flex w-[min(calc(100%-1.5rem),26rem)] -translate-x-1/2 flex-col gap-2 pointer-events-none"
        aria-label="Avisos del sistema"
      >
        {toasts.map((toast) => (
          <AlertToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration || DURATIONS[toast.type] || DURATIONS.info}
            onDismiss={() => dismissToast(toast.id)}
          />
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
