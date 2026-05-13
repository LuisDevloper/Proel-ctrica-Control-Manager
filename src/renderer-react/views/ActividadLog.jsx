import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, Thead, Th, Tbody, Tr, Td } from "../components/ui/Table";
import { useFilters } from "../hooks/useFilters";
import { FilterBar } from "../components/layout/FilterBar";
import { Pager } from "../components/layout/Pager";
import { Activity, User, Edit, Trash2, Plus, Upload, RotateCcw, RefreshCw } from "lucide-react";

const ACTION_ICONS = {
  CREATE:   { icon: Plus,        color: "text-[#29a16a]", bg: "bg-[#29a16a]/10 border-[#29a16a]/30" },
  UPDATE:   { icon: Edit,        color: "text-[#2f8dff]", bg: "bg-[#2f8dff]/10 border-[#2f8dff]/30" },
  DELETE:   { icon: Trash2,      color: "text-[#e05c5c]", bg: "bg-[#e05c5c]/10 border-[#e05c5c]/30" },
  IMPORT:   { icon: Upload,      color: "text-[#e0a91f]", bg: "bg-[#e0a91f]/10 border-[#e0a91f]/30" },
  RESTORE:  { icon: RotateCcw,   color: "text-[#a78bfa]", bg: "bg-[#a78bfa]/10 border-[#a78bfa]/30" },
  DEFAULT:  { icon: Activity,    color: "text-[#9ab0c7]", bg: "bg-[#2a3d57]/40 border-[#2a3d57]" },
};

const ENTITY_LABELS = {
  motors: "Motor", technicians: "Técnico", maintenances: "Mantenimiento",
  failures: "Falla", users: "Usuario", inventory: "Inventario",
  db: "Base de datos",
};

function ActionBadge({ action }) {
  const cfg = ACTION_ICONS[action] || ACTION_ICONS.DEFAULT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} font-medium`}>
      <Icon size={10} /> {action}
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

  const filters = useFilters(items, { filterFn, defaultSortField: "created_at", defaultSortDir: "desc", perPage: 25 });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await window.proelectricaApi.getActivityLog({ limit });
    setItems(data || []);
    setLoading(false);
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#eaf2fb] flex items-center gap-2">
          <Activity size={18} className="text-[#2f8dff]" /> Registro de actividad
        </h2>
        <Button variant="ghost" size="sm" className="border border-[#2a3d57] text-[#9ab0c7]" onClick={load}>
          <RefreshCw size={13} className="mr-1" /> Actualizar
        </Button>
      </div>

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
          ) : filters.page.length === 0 ? (
            <p className="text-center text-[#9ab0c7] py-8">No hay registros de actividad.</p>
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
                  {filters.page.map(item => (
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
                      <Td className="text-xs text-[#9ab0c7] max-w-[260px] truncate">{item.details || "—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}

          <Pager
            page={filters.currentPage} total={filters.filtered.length}
            perPage={25} totalPages={filters.totalPages}
            onPrev={filters.prevPage} onNext={filters.nextPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
