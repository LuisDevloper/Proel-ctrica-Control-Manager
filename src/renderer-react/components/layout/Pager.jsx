import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

export function Pager({ page, totalPages, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#2a3f59]">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1}>
        <ChevronLeft size={14} className="mr-1" /> Anterior
      </Button>
      <span className="text-xs text-[#9ab0c7]">Pagina {page} de {totalPages}</span>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Siguiente <ChevronRight size={14} className="ml-1" />
      </Button>
    </div>
  );
}
