import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { Activity, User, Edit, Trash2, Plus, Upload, RotateCcw, RefreshCw, LogIn, LogOut, Database, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { xlsxExport } from "../lib/excelExport";
import { useToast } from "../components/ui/Toast";

const EXCEL_COLS = [
  { key: "fecha",        header: "Fecha y hora",  width: 22 },
  { key: "username",     header: "Usuario",        width: 18 },
  { key: "action_label", header: "Acción",         width: 18 },
  { key: "entity_label", header: "Entidad",        width: 22 },
  { key: "entity_id",    header: "ID",             width: 8  },
  { key: "details",      header: "Detalles",       width: 60 },
];

const ACTION_ICONS = {
  CREATE:   { icon: Plus,        color: "text-[#29a16a]", bg: "bg-[#29a16a]/10 border-[#29a16a]/30" },
  UPDATE:   { icon: Edit,        color: "text-[#2f8dff]", bg: "bg-[#2f8dff]/10 border-[#2f8dff]/30" },
  DELETE:   { icon: Trash2,      color: "text-[#e05c5c]", bg: "bg-[#e05c5c]/10 border-[#e05c5c]/30" },
  IMPORT:   { icon: Upload,      color: "text-[#e0a91f]", bg: "bg-[#e0a91f]/10 border-[#e0a91f]/30" },
  UPLOAD:   { icon: Upload,      color: "text-[#5fb3ff]", bg: "bg-[#5fb3ff]/10 border-[#5fb3ff]/30" },
  LOGIN:    { icon: LogIn,       color: "text-[#39d48f]", bg: "bg-[#39d48f]/10 border-[#39d48f]/30" },
  LOGOUT:   { icon: LogOut,      color: "text-[#9ab0c7]", bg: "bg-[#2a3d57]/40 border-[#2a3d57]" },
  BACKUP:   { icon: Database,    color: "text-[#a78bfa]", bg: "bg-[#a78bfa]/10 border-[#a78bfa]/30" },
  RESTORE:  { icon: RotateCcw,   color: "text-[#a78bfa]", bg: "bg-[#a78bfa]/10 border-[#a78bfa]/30" },
  ENTRADA:  { icon: Plus,        color: "text-[#29a16a]", bg: "bg-[#29a16a]/10 border-[#29a16a]/30" },
  SALIDA:   { icon: Trash2,      color: "text-[#e0a91f]", bg: "bg-[#e0a91f]/10 border-[#e0a91f]/30" },
  AJUSTE:   { icon: Edit,        color: "text-[#2f8dff]", bg: "bg-[#2f8dff]/10 border-[#2f8dff]/30" },
  DEFAULT:  { icon: Activity,    color: "text-[#9ab0c7]", bg: "bg-[#2a3d57]/40 border-[#2a3d57]" },
};

const ACTION_LABELS = {
  CREATE: "Creacion",
  UPDATE: "Edicion",
  DELETE: "Eliminacion",
  IMPORT: "Importacion",
  UPLOAD: "Subida",
  LOGIN: "Inicio sesion",
  LOGOUT: "Cierre sesion",
  BACKUP: "Copia seguridad",
  RESTORE: "Restauracion",
  ENTRADA: "Entrada stock",
  SALIDA: "Salida stock",
  AJUSTE: "Ajuste stock",
};

const ENTITY_LABELS = {
  motors: "Motor",
  turbinas: "Turbina",
  technicians: "Tecnico",
  maintenances: "Mantenimiento",
  failures: "Falla",
  users: "Usuario",
  inventory_items: "Inventario",
  inventory_movements: "Movimiento inventario",
  documents: "Documento",
  external_shipments: "Taller externo",
  auth: "Autenticacion",
  db: "Base de datos",
};

function ActionBadge({ action }) {
  const cfg = ACTION_ICONS[action] || ACTION_ICONS.DEFAULT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} font-medium`}>
      <Icon size={10} /> {ACTION_LABELS[action] || action}
    </span>
  );
}

function filterFn(item, q) {
  const s = q.toLowerCase();
  return (item.username || "").toLowerCase().includes(s) ||
         (item.entity   || "").toLowerCase().includes(s) ||
         (item.action   || "").toLowerCase().includes(s) ||
         (item.details  || "").toLowerCase().includes(s);
}

export function ActividadLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(200);
  const { showToast } = useToast();

  const filters = useFilters(items, { filterFn, defaultSortField: "created_at", perPage: 25 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.proelectricaApi.getActivityLog({ limit });
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  function handleExport() {
    if (!filters.filtered.length) {
      showToast("No hay registros para exportar.", "warning");
      return;
    }
    const rows = filters.filtered.map((item) => ({
      fecha:        fmtDate(item.created_at),
      username:     item.username || "—",
      action_label: ACTION_LABELS[item.action] || item.action || "—",
      entity_label: ENTITY_LABELS[item.entity] || item.entity || "—",
      entity_id:    item.entity_id ?? "",
      details:      item.details || "—",
    }));
    const today = new Date().toISOString().slice(0, 10);
    xlsxExport(
      `Actividad_${today}`,
      "Registro de Actividad",
      EXCEL_COLS,
      rows
    );
  }

  // Stats rápidas
  const stats = {
    creates:  items.filter(i => i.action === "CREATE").length,
    updates:  items.filter(i => i.action === "UPDATE").length,
    deletes:  items.filter(i => i.action === "DELETE").length,
    imports:  items.filter(i => i.action === "IMPORT").length,
    users:    [...new Set(items.map(i => i.username))].length,
  };

  return (
    <div className="flex flex-col gap-4 animate-pageFadeIn">
      <PageHeader
        title="Registro de actividad"
        description="Auditoria de acciones y cambios realizados en el sistema"
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="border border-[var(--border)] text-[var(--muted)]" onClick={load}>
              <RefreshCw size={13} className="mr-1" /> Actualizar
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <FileSpreadsheet size={13} className="mr-1" /> Excel
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Creaciones", val: stats.creates, color: "text-[#29a16a]" },
          { label: "Ediciones",  val: stats.updates, color: "text-[#2f8dff]" },
          { label: "Eliminaciones", val: stats.deletes, color: "text-[#e05c5c]" },
          { label: "Importaciones", val: stats.imports, color: "text-[#e0a91f]" },
          { label: "Usuarios activos", val: stats.users, color: "text-[#a78bfa]" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-[#9ab0c7]">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historial de acciones</CardTitle>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="text-xs bg-[#0d1825] border border-[#2a3d57] text-[#9ab0c7] rounded-lg px-2 py-1"
            >
              <option value={100}>Últimas 100</option>
              <option value={200}>Últimas 200</option>
              <option value={500}>Últimas 500</option>
              <option value={9999}>Todas</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            query={filters.query} onQueryChange={filters.setQuery}
            sortField={filters.sortField} onSortFieldChange={filters.setSortField}
            sortDir={filters.sortDir} onSortDirChange={filters.setSortDir}
            sortOptions={[
              { value: "created_at", label: "Fecha" },
              { value: "username",   label: "Usuario" },
              { value: "entity",     label: "Entidad" },
              { value: "action",     label: "Acción" },
            ]}
          />

          {loading ? (
            <p className="text-center text-[#9ab0c7] py-8">Cargando...</p>
          ) : filters.paged.length === 0 ? (
            <EmptyState message="No hay registros de actividad con los filtros actuales." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2a3d57] mt-3">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Fecha y hora</Th>
                    <Th>Usuario</Th>
                    <Th>Acción</Th>
                    <Th>Entidad</Th>
                    <Th>Detalles</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filters.paged.map(item => (
                    <Tr key={item.id}>
                      <Td className="text-xs text-[#9ab0c7] whitespace-nowrap">{fmtDate(item.created_at)}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#eaf2fb]">
                          <User size={11} className="text-[#2f8dff]" /> {item.username}
                        </span>
                      </Td>
                      <Td><ActionBadge action={item.action} /></Td>
                      <Td className="text-xs text-[#9ab0c7]">
                        {ENTITY_LABELS[item.entity] || item.entity}
                        {item.entity_id ? <span className="text-[#4a6a8a] ml-1">#{item.entity_id}</span> : null}
                      </Td>
                      <Td className="text-xs text-[#9ab0c7] max-w-md">
                        <span className="block whitespace-pre-wrap break-words leading-relaxed" title={item.details || undefined}>
                          {item.details || "—"}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}

          <Pager
            page={filters.page}
            totalPages={filters.totalPages}
            onPrev={() => filters.setPage(filters.page - 1)}
            onNext={() => filters.setPage(filters.page + 1)}
            total={filters.filtered.length}
            perPage={filters.perPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
