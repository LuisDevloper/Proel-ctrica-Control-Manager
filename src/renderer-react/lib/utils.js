import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Compara valores de formulario de edición (ignora null/vacío equivalente). */
export function normalizeEditValue(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

export function editFormUnchanged(original, current, keys) {
  if (!original || !current) return true;
  return keys.every(
    (key) => normalizeEditValue(original[key]) === normalizeEditValue(current[key])
  );
}
