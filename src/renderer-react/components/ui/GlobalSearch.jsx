import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Zap, Wrench, AlertTriangle, X, ArrowRight } from "lucide-react";

// ── Utilidades ────────────────────────────────────────────────────────────────

function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#2f6fcd]/40 text-[#90c4ff] rounded px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const STATUS_COLOR = {
  Operativo:    "text-[#29a16a]",
  "En taller":  "text-[#e0a429]",
  "De baja":    "text-[#e07070]",
  Completado:   "text-[#29a16a]",
  Pendiente:    "text-[#e0a429]",
  "En progreso":"text-[#5fb3ff]",
  Resuelta:     "text-[#29a16a]",
};

// ── Secciones de resultados ───────────────────────────────────────────────────

function ResultSection({ label, icon: Icon, color, items, query, renderItem, focusedIdx, onFocusChange, baseIdx, onSelect }) {
  if (!items.length) return null;
  return (
    <div>
      <div className={`flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider ${color}`}>
        <Icon size={11} />
        {label}
        <span className="ml-auto text-[#4a6a8a] font-normal normal-case tracking-normal">{items.length} resultado{items.length !== 1 ? "s" : ""}</span>
      </div>
      {items.map((item, i) => {
        const idx = baseIdx + i;
        const focused = focusedIdx === idx;
        return (
          <button
            key={item.id}
            type="button"
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              focused ? "bg-[#1a3050]" : "hover:bg-[#111d2c]"
            }`}
            onMouseEnter={() => onFocusChange(idx)}
            onClick={() => onSelect(item)}
          >
            {renderItem(item, query)}
            {focused && <ArrowRight size={13} className="ml-auto shrink-0 text-[#4a6a8a]" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Render de cada tipo de resultado ─────────────────────────────────────────

function MotorResult({ item, query }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[#1a2d44] flex items-center justify-center shrink-0">
        <Zap size={15} className="text-[#5fb3ff]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#eaf2fb]">{highlight(item.code, query)}</p>
        <p className="text-xs text-[#7a9bb8] truncate">
          {item.brand} {item.model}
          {item.operationalLocation ? ` · ${item.operationalLocation}` : ""}
        </p>
      </div>
      {item.status && (
        <span className={`ml-auto text-xs shrink-0 ${STATUS_COLOR[item.status] || "text-[#7a9bb8]"}`}>
          {item.status}
        </span>
      )}
    </div>
  );
}

function MaintenanceResult({ item, query }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[#1a2d44] flex items-center justify-center shrink-0">
        <Wrench size={14} className="text-[#e0a429]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#eaf2fb]">
          {highlight(item.maintenanceType, query)}
          <span className="font-normal text-[#7a9bb8] ml-1">— {highlight(item.motorCode, query)}</span>
        </p>
        <p className="text-xs text-[#7a9bb8]">{item.maintenanceDate}</p>
      </div>
      {item.status && (
        <span className={`ml-auto text-xs shrink-0 ${STATUS_COLOR[item.status] || "text-[#7a9bb8]"}`}>
          {item.status}
        </span>
      )}
    </div>
  );
}

function FailureResult({ item, query }) {
  const priorityColor = item.priority === "Alta" ? "text-[#e07070]" : item.priority === "Media" ? "text-[#e0a429]" : "text-[#7a9bb8]";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-[#1a2d44] flex items-center justify-center shrink-0">
        <AlertTriangle size={14} className="text-[#e07070]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#eaf2fb]">
          {highlight(item.failureType, query)}
          <span className="font-normal text-[#7a9bb8] ml-1">— {highlight(item.motorCode, query)}</span>
        </p>
        <p className="text-xs text-[#7a9bb8]">
          {item.reportedAt ? new Date(item.reportedAt).toLocaleDateString("es-CO") : ""}
          {item.priority ? ` · Prioridad: ` : ""}
          {item.priority && <span className={priorityColor}>{item.priority}</span>}
        </p>
      </div>
      {item.status && (
        <span className={`ml-auto text-xs shrink-0 ${STATUS_COLOR[item.status] || "text-[#7a9bb8]"}`}>
          {item.status}
        </span>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function GlobalSearch({ open, onClose, onNavigate }) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [focusedIdx, setFocus]  = useState(0);
  const inputRef                = useRef(null);
  const debouncedQ              = useDebounce(query, 220);

  // Resetear al abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setFocus(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Buscar cuando cambia la query debounced
  useEffect(() => {
    if (!open) return;
    if (debouncedQ.length < 2) { setResults(null); return; }
    let cancelled = false;
    setLoading(true);

    const api = window.proelectricaApi;
    if (typeof api?.globalSearch !== "function") {
      // La app necesita reiniciarse para cargar el nuevo handler
      if (!cancelled) {
        setResults({ motors: [], maintenances: [], failures: [], _error: "restart" });
        setLoading(false);
      }
      return () => { cancelled = true; };
    }

    api.globalSearch(debouncedQ)
      .then((r) => {
        if (cancelled) return;
        // Normalizar respuesta defensivamente
        setResults({
          motors:       Array.isArray(r?.motors)       ? r.motors       : [],
          maintenances: Array.isArray(r?.maintenances) ? r.maintenances : [],
          failures:     Array.isArray(r?.failures)     ? r.failures     : [],
        });
        setFocus(0);
      })
      .catch((err) => {
        if (cancelled) return;
        const isNoHandler = String(err?.message || "").includes("No handler");
        setResults({
          motors: [], maintenances: [], failures: [],
          _error: isNoHandler ? "restart" : "generic",
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedQ, open]);

  // Flatten de resultados para navegación por teclado
  const allItems = results && !results._error
    ? [
        ...(results.motors       || []).map((m) => ({ ...m, _type: "motor" })),
        ...(results.maintenances || []).map((m) => ({ ...m, _type: "maintenance" })),
        ...(results.failures     || []).map((f) => ({ ...f, _type: "failure" })),
      ]
    : [];

  const isEmpty = results && !results._error && !allItems.length;

  function handleSelect(item) {
    onClose();
    if (item._type === "motor") {
      onNavigate("motores", { motorId: item.id });
    } else if (item._type === "maintenance") {
      onNavigate("mantenimientos", {});
    } else {
      onNavigate("fallas", {});
    }
  }

  // Teclas dentro del panel
  function handleKeyDown(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocus((f) => Math.min(f + 1, allItems.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocus((f) => Math.max(f - 1, 0));
    }
    if (e.key === "Enter" && allItems[focusedIdx]) {
      handleSelect(allItems[focusedIdx]);
    }
  }

  if (!open) return null;

  const motorBase = 0;
  const maintBase = results?.motors.length || 0;
  const failBase  = maintBase + (results?.maintenances.length || 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-[580px] bg-[#0d1825] border border-[#2a3d57] rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e3148]">
          <Search size={17} className="text-[#4a6a8a] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar motores, mantenimientos, fallas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#eaf2fb] placeholder:text-[#4a6a8a] text-sm outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults(null); inputRef.current?.focus(); }}
              className="text-[#4a6a8a] hover:text-[#9ab0c7] transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="max-h-[420px] overflow-y-auto">
          {/* Estado inicial */}
          {!query && (
            <p className="text-center text-sm text-[#4a6a8a] py-8 px-4">
              Escribe al menos 2 caracteres para buscar
            </p>
          )}

          {/* Cargando */}
          {loading && (
            <p className="text-center text-sm text-[#4a6a8a] py-8 animate-pulse">
              Buscando...
            </p>
          )}

          {/* Error: necesita reinicio */}
          {results?._error === "restart" && !loading && (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-[#e0a429]">La búsqueda global requiere reiniciar la aplicación.</p>
              <p className="text-xs text-[#4a6a8a] mt-1">Cierra y vuelve a abrir la app para activarla.</p>
            </div>
          )}

          {/* Error genérico */}
          {results?._error === "generic" && !loading && (
            <p className="text-center text-sm text-[#e07070] py-8 px-4">
              Error al buscar. Comprueba la conexión a la base de datos.
            </p>
          )}

          {/* Sin resultados */}
          {isEmpty && !loading && !results?._error && (
            <p className="text-center text-sm text-[#4a6a8a] py-8 px-4">
              Sin resultados para <span className="text-[#9ab0c7]">"{query}"</span>
            </p>
          )}

          {/* Resultados — solo cuando no hay error */}
          {results && !loading && !results._error && (
            <>
              <ResultSection
                label="Equipos"
                icon={Zap}
                color="text-[#5fb3ff]"
                items={results.motors || []}
                query={debouncedQ}
                renderItem={(item, q) => <MotorResult item={item} query={q} />}
                focusedIdx={focusedIdx}
                onFocusChange={setFocus}
                baseIdx={motorBase}
                onSelect={handleSelect}
              />
              <ResultSection
                label="Mantenimientos"
                icon={Wrench}
                color="text-[#e0a429]"
                items={results.maintenances || []}
                query={debouncedQ}
                renderItem={(item, q) => <MaintenanceResult item={item} query={q} />}
                focusedIdx={focusedIdx}
                onFocusChange={setFocus}
                baseIdx={maintBase}
                onSelect={handleSelect}
              />
              <ResultSection
                label="Fallas"
                icon={AlertTriangle}
                color="text-[#e07070]"
                items={results.failures || []}
                query={debouncedQ}
                renderItem={(item, q) => <FailureResult item={item} query={q} />}
                focusedIdx={focusedIdx}
                onFocusChange={setFocus}
                baseIdx={failBase}
                onSelect={handleSelect}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e3148] text-xs text-[#3a5470]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">↵</kbd> abrir</span>
          </div>
          <span><kbd className="font-mono">Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
