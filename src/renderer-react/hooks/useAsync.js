import { useCallback } from "react";
import { useToast } from "../components/ui/Toast";

/**
 * Devuelve una funcion `run` que envuelve llamadas asincronas con manejo
 * automatico de errores y toasts.
 *
 * - Si la promesa resuelve con un objeto `{ ok: false }` (IPC estilo API):
 *   muestra aviso (warning) con `message`, o info si fue cancelacion; no muestra el toast de exito.
 * - Si lanza excepcion: toast warning con el mensaje extraido.
 * - Solo si la operacion tiene exito se muestra `successMsg` como toast success.
 *
 * Uso:
 *   const { run } = useAsync();
 *   const { ok } = await run(() => window.proelectricaApi.createMotor(data), "Motor registrado.");
 */
function isResultObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "ok" in value;
}

export function useAsync() {
  const { showToast } = useToast();

  const run = useCallback(
    async (fn, successMsg) => {
      try {
        const result = await fn();

        if (isResultObject(result) && result.ok === false) {
          const canceled = result.canceled === true || result.message === "Cancelado";
          if (canceled) {
            showToast("Operacion cancelada.", "info");
          } else {
            showToast(result.message || "No se pudo completar la operacion.", "warning");
          }
          return { ok: false, result, message: result.message };
        }

        if (isResultObject(result) && result.ok === true && result.unchanged === true) {
          showToast("No hay cambios para guardar.", "info");
          return { ok: true, result, unchanged: true };
        }

        if (successMsg) showToast(successMsg, "success");
        return { ok: true, result };
      } catch (err) {
        const msg = extractErrorMessage(err);
        showToast(msg, "warning");
        return { ok: false, error: msg };
      }
    },
    [showToast]
  );

  return { run };
}

function extractErrorMessage(err) {
  if (!err) return "Ocurrio un error inesperado.";
  const raw = err?.message || String(err);

  if (/UNIQUE constraint failed/i.test(raw)) {
    const field = raw.match(/failed:\s*\w+\.(\w+)/i)?.[1];
    return field
      ? `Ya existe un registro con ese ${field}. Usa un valor diferente.`
      : "Ya existe un registro con ese valor. Usa uno diferente.";
  }
  if (/NOT NULL constraint failed/i.test(raw)) {
    return "Hay campos obligatorios sin completar.";
  }
  if (/FOREIGN KEY constraint failed/i.test(raw)) {
    return "No se puede eliminar: hay registros relacionados activos.";
  }
  if (/no such table/i.test(raw)) {
    return "Error de base de datos: tabla no encontrada. Reinicia la aplicacion.";
  }
  if (/no such column/i.test(raw)) {
    return "Error de base de datos: columna no encontrada.";
  }
  if (/database is locked/i.test(raw)) {
    return "La base de datos esta bloqueada. Intenta de nuevo en un momento.";
  }
  if (/network|fetch/i.test(raw)) {
    return "Error de red. Verifica la conexion.";
  }

  return raw.length > 120 ? raw.slice(0, 120) + "..." : raw;
}
