import React, { useEffect } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, className }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={cn(
        "w-full max-w-md bg-gradient-to-b from-[#17273a] to-[#111d2c] border border-[#335073] rounded-2xl shadow-2xl",
        "animate-in zoom-in-95 duration-200",
        className
      )}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3d57]">
            <h3 className="text-base font-semibold text-[#eaf2fb]">{title}</h3>
            <button
              onClick={onClose}
              className="text-[#9ab0c7] hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, message, confirmText = "Eliminar" }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirmar accion">
      <p className="text-sm text-[#9ab0c7] mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  );
}
