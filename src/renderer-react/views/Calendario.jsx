import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, statusBadgeVariant } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "../lib/utils";
import { useToast } from "../components/ui/Toast";

const DAYS   = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export function Calendario() {
  const today    = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    window.proelectricaApi.getMaintenancesCalendar({ year, month })
      .then((rows) => setEvents(Array.isArray(rows) ? rows : []))
      .catch(() => {
        setEvents([]);
        showToast("No se pudo cargar el calendario de mantenimientos.", "warning");
      });
  }, [year, month, showToast]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Construye la grilla del mes
  const firstDay  = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsForDay(day) {
    if (!day) return [];
    const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter(e => e.maintenance_date === dateStr);
  }

  function handleDayClick(day) {
    const evs = eventsForDay(day);
    if (evs.length > 0) { setSelected({ day, evs }); setModalOpen(true); }
  }

  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[#eaf2fb]">Calendario de mantenimientos</h2>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar size={15} /> {MONTHS[month - 1]} {year}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft size={16}/></Button>
              <Button variant="ghost" size="sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()+1); }}>Hoy</Button>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight size={16}/></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-[#4a6a8a] py-1">{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const evs   = eventsForDay(day);
              const isToday = day === todayDay;
              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[72px] rounded-xl p-1.5 flex flex-col",
                    day ? "cursor-pointer hover:bg-[#0f1e30] transition-colors" : "opacity-0 pointer-events-none",
                    isToday && "ring-1 ring-[#2f8dff] bg-[#0d1e35]",
                    evs.length > 0 && !isToday && "bg-[#0a1624]"
                  )}
                >
                  {day && (
                    <>
                      <span className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                        isToday ? "bg-[#2f8dff] text-white" : "text-[#9ab0c7]"
                      )}>{day}</span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {evs.slice(0, 3).map((ev, j) => (
                          <div key={j} className={cn(
                            "text-[10px] rounded px-1 py-0.5 truncate font-medium",
                            ev.maintenance_type === "Preventivo" ? "bg-[#0d2e1e] text-[#39d48f]" : "bg-[#2b2208] text-[#e0a91f]"
                          )}>
                            {ev.motor_code}
                          </div>
                        ))}
                        {evs.length > 3 && <span className="text-[10px] text-[#4a6a8a]">+{evs.length - 3} mas</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex gap-4 mt-3 pt-3 border-t border-[#1e2f44]">
            <div className="flex items-center gap-1.5 text-xs text-[#9ab0c7]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#39d48f]"/> Preventivo
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#9ab0c7]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#e0a91f]"/> Correctivo
            </div>
            {events.length > 0 && (
              <span className="ml-auto text-xs text-[#4a6a8a]">{events.length} mantenimiento{events.length !== 1 ? "s" : ""} este mes</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal detalle del día */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={selected ? `${MONTHS[month-1]} ${selected.day}, ${year}` : ""}>
        <div className="flex flex-col gap-3">
          {selected?.evs.map((ev, i) => (
            <div key={i} className="rounded-xl border border-[#2a3d57] bg-[#0a1624] p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-[#eaf2fb]">{ev.motor_code}</span>
                <Badge variant={statusBadgeVariant(ev.maintenance_type)}>{ev.maintenance_type}</Badge>
              </div>
              <p className="text-xs text-[#9ab0c7]">Tecnico: {ev.technician_name || "No asignado"}</p>
              {ev.description && <p className="text-xs text-[#9ab0c7] mt-1">{ev.description}</p>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
