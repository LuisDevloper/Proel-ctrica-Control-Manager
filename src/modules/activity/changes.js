function normalizeComparable(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value).trim();
}

function valuesEqual(a, b) {
  return normalizeComparable(a) === normalizeComparable(b);
}

function formatDisplayValue(value, options = {}) {
  const { sensitive = false, binary = false } = options;
  if (sensitive) return "(oculto)";
  if (binary) return "(archivo actualizado)";
  if (typeof value === "string" && value.startsWith("data:")) return "(archivo actualizado)";
  const norm = normalizeComparable(value);
  if (norm === "") return "(vacio)";
  if (norm.length > 100) return `${norm.slice(0, 97)}...`;
  return norm;
}

/**
 * Compara campos before/after y devuelve texto legible para activity_log.details.
 * fields: Array<[key, label]> | Array<[key, label, options]>
 */
function buildUpdateDetails({ summary, fields, before, after }) {
  const changes = [];
  for (const entry of fields) {
    const [key, label, options = {}] = entry;
    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (valuesEqual(oldVal, newVal)) continue;
    changes.push(
      `${label}: ${formatDisplayValue(oldVal, options)} -> ${formatDisplayValue(newVal, options)}`
    );
  }
  if (changes.length === 0) {
    return summary ? `${summary} (sin cambios detectados)` : "Sin cambios detectados";
  }
  return summary ? `${summary} | ${changes.join("; ")}` : changes.join("; ");
}

module.exports = {
  buildUpdateDetails,
  formatDisplayValue,
  valuesEqual,
};
