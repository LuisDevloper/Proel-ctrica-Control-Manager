import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

export function Pager({ page, totalPages, onPrev, onNext, total, perPage }) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total ?? 0);

  return (
    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border-soft)]">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1}>
        <ChevronLeft size={14} className="mr-1" /> Anterior
      </Button>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-[var(--muted)]">Pagina {page} de {totalPages}</span>
        {total !== undefined && (
          <span className="text-[10px] text-[var(--faint)]">{from}–{to} de {total} registros</span>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Siguiente <ChevronRight size={14} className="ml-1" />
      </Button>
    </div>
  );
}
