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

export function useFilters(items, { filterFn, defaultSortField = "id", perPage: defaultPerPage = 10, dateField = null }) {
  const [query, setQuery]         = useState("");
  const [status, setStatus]       = useState("");
  const [location, setLocation]   = useState("");
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortDir, setSortDir]     = useState("desc");
  const [page, setPage]           = useState(1);
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [perPage, setPerPage]     = useState(defaultPerPage);

  const filtered = useMemo(() => {
    let base = filterFn ? items.filter((item) => filterFn(item, query, status, location)) : items;
    if (dateField && dateFrom) base = base.filter(i => (i[dateField] || "") >= dateFrom);
    if (dateField && dateTo)   base = base.filter(i => (i[dateField] || "") <= dateTo);
    return sortItems(base, sortField, sortDir);
  }, [items, query, status, location, sortField, sortDir, filterFn, dateField, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  function reset() {
    setQuery(""); setStatus(""); setLocation(""); setSortField(defaultSortField);
    setSortDir("desc"); setPage(1); setDateFrom(""); setDateTo("");
  }

  return {
    query,    setQuery:    (v) => { setQuery(v);    setPage(1); },
    status,   setStatus:   (v) => { setStatus(v);   setPage(1); },
    location, setLocation: (v) => { setLocation(v); setPage(1); },
    sortField, setSortField:(v) => { setSortField(v);setPage(1); },
    sortDir,  setSortDir:  (v) => { setSortDir(v);  setPage(1); },
    dateFrom, setDateFrom: (v) => { setDateFrom(v); setPage(1); },
    dateTo,   setDateTo:   (v) => { setDateTo(v);   setPage(1); },
    perPage,  setPerPage:  (v) => { setPerPage(Number(v)); setPage(1); },
    page: safePage, setPage, totalPages,
    paged, filtered, reset,
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
