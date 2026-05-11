import { useState, useMemo } from "react";

function sortItems(items, field, direction) {
  return [...items].sort((a, b) => {
    const av = (a[field] ?? "").toString().toLowerCase();
    const bv = (b[field] ?? "").toString().toLowerCase();
    if (av < bv) return direction === "asc" ? -1 : 1;
    if (av > bv) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function useFilters(items, { filterFn, defaultSortField = "id", perPage = 8 }) {
  const [query, setQuery]       = useState("");
  const [status, setStatus]     = useState("");
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortDir, setSortDir]   = useState("desc");
  const [page, setPage]         = useState(1);

  const filtered = useMemo(() => {
    const base = filterFn ? items.filter((item) => filterFn(item, query, status)) : items;
    return sortItems(base, sortField, sortDir);
  }, [items, query, status, sortField, sortDir, filterFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  function reset() {
    setQuery(""); setStatus(""); setSortField(defaultSortField); setSortDir("desc"); setPage(1);
  }

  return {
    query, setQuery: (v) => { setQuery(v); setPage(1); },
    status, setStatus: (v) => { setStatus(v); setPage(1); },
    sortField, setSortField: (v) => { setSortField(v); setPage(1); },
    sortDir, setSortDir: (v) => { setSortDir(v); setPage(1); },
    page: safePage, setPage, totalPages,
    paged, filtered, reset
  };
}

export function csvExport(fileName, rows) {
  if (!rows.length) return;
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headers = Object.keys(rows[0]);
  const content = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))
  ].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
