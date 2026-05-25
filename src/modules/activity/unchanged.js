function normStr(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normNum(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normNullableId(value) {
  if (value == null || value === "") return null;
  return Number(value);
}

/** Compara filas antes/después; cada entrada: { beforeKey, afterKey?, normalize? } */
function isRowUnchanged(before, after, comparisons) {
  return comparisons.every(({ beforeKey, afterKey, normalize = normStr }) => {
    const bk = beforeKey;
    const ak = afterKey ?? beforeKey;
    return normalize(before[bk]) === normalize(after[ak]);
  });
}

module.exports = {
  normStr,
  normNum,
  normNullableId,
  isRowUnchanged,
};
