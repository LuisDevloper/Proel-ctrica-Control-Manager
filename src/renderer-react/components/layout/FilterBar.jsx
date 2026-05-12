import React from "react";
import { Search, Download, X } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

export function FilterBar({
  searchPlaceholder = "Buscar...",
  query,
  onQueryChange,
  statusOptions = [],
  status,
  onStatusChange,
  sortOptions = [],
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirChange,
  onExport,
  exportCount = -1,
  onClear
}) {
  const { showToast } = useToast();

  function handleExport() {
    if (exportCount === 0) {
      showToast("No hay datos para exportar. Ajusta los filtros.", "warning");
      return;
    }
    onExport?.();
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c7]" />
        <Input
          className="pl-8"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      {statusOptions.length > 0 && (
        <Select value={status} onChange={(e) => onStatusChange(e.target.value)} className="w-40">
          <option value="">Todos</option>
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      )}

      {sortOptions.length > 0 && (
        <>
          <Select value={sortField} onChange={(e) => onSortFieldChange(e.target.value)} className="w-44">
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>Orden: {opt.label}</option>
            ))}
          </Select>
          <Select value={sortDir} onChange={(e) => onSortDirChange(e.target.value)} className="w-24">
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </Select>
        </>
      )}

      <Button variant="secondary" size="sm" onClick={handleExport}>
        <Download size={13} className="mr-1" /> Excel
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X size={13} className="mr-1" /> Limpiar
      </Button>
    </div>
  );
}
