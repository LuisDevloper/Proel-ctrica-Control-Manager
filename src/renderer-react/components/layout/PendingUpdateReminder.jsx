import React, { useEffect, useRef } from "react";
import { useToast } from "../ui/Toast";

/**
 * Si hubo una actualizacion descargada y el usuario abre la app antes de instalarla,
 * muestra un recordatorio alineado con UpdateBanner.
 */
export function PendingUpdateReminder() {
  const { showToast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !window.proelectricaApi?.getPendingInstall) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await window.proelectricaApi.getPendingInstall();
        if (cancelled || !p?.version) return;
        shown.current = true;
        showToast(
          `Hay una actualizacion lista (v${p.version}). Cierra la aplicacion para instalarla o usa Instalar ahora en el aviso superior.`,
          "info"
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return null;
}
