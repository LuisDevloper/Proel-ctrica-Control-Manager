import React from "react";
import { Search, Download, X, Calendar } from "lucide-react";
import { Input, Select } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

export function FilterBar({
  searchPlaceholder = "Buscar...",
  query, onQueryChange,
  statusOptions = [], status, onStatusChange,
  sortOptions = [], sortField, sortDir, onSortFieldChange, onSortDirChange,
  onExport, exportCount = -1, onClear,
  // Rango de fechas
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  // Paginación
  perPage, onPerPageChange,
}) {
  const { showToast } = useToast();
  const showDates = onDateFromChange !== undefined;

  function handleExport() {
    if (exportCount === 0) { showToast("No hay datos para exportar. Ajusta los filtros.", "warning"); return; }
    onExport?.();
  }

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Fila principal */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ab0c7]" />
          <Input className="pl-8" placeholder={searchPlaceholder} value={query} onChange={(e) => onQueryChange(e.target.value)} />
        </div>

        {statusOptions.length > 0 && (
          <Select value={status} onChange={(e) => onStatusChange(e.target.value)} className="w-40">
            <option value="">Todos</option>
            {statusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
        )}

        {sortOptions.length > 0 && (
          <>
            <Select value={sortField} onChange={(e) => onSortFieldChange(e.target.value)} className="w-44">
              {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>Orden: {opt.label}</option>)}
            </Select>
            <Select value={sortDir} onChange={(e) => onSortDirChange(e.target.value)} className="w-24">
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </Select>
          </>
        )}

        {onPerPageChange && (
          <Select value={perPage} onChange={(e) => onPerPageChange(e.target.value)} className="w-28" title="Registros por página">
            <option value="10">10 / pág</option>
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="100">100 / pág</option>
          </Select>
        )}

        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download size={13} className="mr-1" /> Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X size={13} className="mr-1" /> Limpiar
        </Button>
      </div>

      {/* Fila de fechas (opcional) */}
      {showDates && (
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={13} className="text-[#9ab0c7] shrink-0" />
          <span className="text-xs text-[#9ab0c7]">Desde</span>
          <Input
            type="date"
            value={dateFrom || ""}
            onChange={e => onDateFromChange(e.target.value)}
            className="w-40 text-sm"
          />
          <span className="text-xs text-[#9ab0c7]">Hasta</span>
          <Input
            type="date"
            value={dateTo || ""}
            onChange={e => onDateToChange(e.target.value)}
            className="w-40 text-sm"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { onDateFromChange(""); onDateToChange(""); }}
              className="text-xs text-[#9ab0c7] hover:text-[#e07070] transition-colors cursor-pointer"
            >
              Quitar filtro de fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
