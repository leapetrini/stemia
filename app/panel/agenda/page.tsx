'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Lock, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NewAppointmentModal } from '@/components/panel/NewAppointmentModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { generateSlots, type ScheduleSettings } from '@/lib/slots';
import { BLOCKING_STATUSES } from '@/lib/types';

type AppointmentRow = {
  id: string;
  time: string;
  duration_min: number;
  status: string;
  notes: string | null;
  deposit_paid: boolean;
  patient: { id: string; name: string; phone: string | null } | null;
  service: { id: string; name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  'en-sala': 'En sala',
  completado: 'Vino',
  ausente: 'No vino',
  cancelado: 'Cancelado',
};

const STATUS_CHIP: Record<string, string> = {
  confirmado: 'bg-espresso/10 text-espresso',
  pendiente: 'bg-champagne/40 text-moca',
  'en-sala': 'bg-champagne/40 text-moca',
  completado: 'bg-espresso/10 text-espresso',
  ausente: 'bg-terracota/10 text-terracota',
  cancelado: 'bg-terracota/10 text-terracota',
};

// Estos tres ya no se tocan: el turno terminó de una manera o de otra.
const CERRADOS = ['completado', 'ausente', 'cancelado'];

const STRIP_DAYS = 21; // 3 semanas corridas: la anterior, la actual y la siguiente

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function mondayOf(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() + (c.getDay() === 0 ? -6 : 1 - c.getDay()));
  return c;
}

function iniciales(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AgendaPage() {
  const router = useRouter();
  const todayISO = useMemo(() => toISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [anchor, setAnchor] = useState(() => toISO(addDays(mondayOf(new Date()), -7)));
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [apptCounts, setApptCounts] = useState<Record<string, number>>({});
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newDefaultSlot, setNewDefaultSlot] = useState<string | undefined>(undefined);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ appt: AppointmentRow; status: 'completado' | 'ausente' } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);

  useEffect(() => {
    supabase.from('schedule_settings').select('start_time, end_time, slot_minutes').limit(1).maybeSingle()
      .then(({ data }) => setSchedule((data as ScheduleSettings | null) ?? null));
  }, []);

  // Horarios del timeline: los del horario de atención + cualquier turno
  // reservado fuera de esa ventana (para no ocultar nunca un turno existente).
  const slots = useMemo(() => {
    const base = generateSlots(schedule);
    const booked = appointments.map(a => a.time.slice(0, 5));
    return [...new Set([...base, ...booked])].sort();
  }, [schedule, appointments]);

  const fetchAppointments = (date: string) => {
    setLoading(true);
    supabase
      .from('appointments')
      .select('id, time, duration_min, status, notes, deposit_paid, patient:patients(id, name, phone), service:services(id, name)')
      .eq('date', date)
      .order('time')
      .then(({ data }) => {
        setAppointments((data as unknown as AppointmentRow[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => { fetchAppointments(selectedDate); }, [selectedDate]);

  // Ningún estado borra el turno: "No vino" lo deja como 'ausente' para que
  // quede en la historia clínica de la paciente junto con el pago de la seña.
  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (!error) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    setUpdatingId(null);
    setConfirmAction(null);
  };

  const openNew = (slot?: string) => {
    setNewDefaultSlot(slot);
    setShowNew(true);
  };

  // Días corridos desde `anchor`, fines de semana incluidos. Si se saltean los
  // cerrados, la tira pasa del 8 al 11 y confunde.
  const days = useMemo(() => {
    const result: { iso: string; label: string; day: number; month: string; weekend: boolean }[] = [];
    const cursor = new Date(anchor + 'T12:00:00');
    for (let i = 0; i < STRIP_DAYS; i++) {
      const dow = cursor.getDay();
      result.push({
        iso: toISO(cursor),
        label: cursor.toLocaleDateString('es-AR', { weekday: 'short' }),
        day: cursor.getDate(),
        month: cursor.toLocaleDateString('es-AR', { month: 'short' }),
        weekend: dow === 0 || dow === 6,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [anchor]);

  const rangeStart = days[0].iso;
  const rangeEnd = days[days.length - 1].iso;

  useEffect(() => {
    Promise.all([
      supabase.from('available_dates').select('date').gte('date', rangeStart).lte('date', rangeEnd),
      supabase.from('appointments').select('date')
        .in('status', BLOCKING_STATUSES).gte('date', rangeStart).lte('date', rangeEnd),
    ]).then(([openRes, apptRes]) => {
      setOpenDates(new Set((openRes.data ?? []).map((r: { date: string }) => r.date)));
      const counts: Record<string, number> = {};
      for (const a of (apptRes.data as { date: string }[]) ?? []) {
        counts[a.date] = (counts[a.date] ?? 0) + 1;
      }
      setApptCounts(counts);
    });
  }, [rangeStart, rangeEnd]);

  const jumpTo = (iso: string) => {
    if (!iso) return;
    setSelectedDate(iso);
    setAnchor(toISO(addDays(mondayOf(new Date(iso + 'T12:00:00')), -7)));
  };

  const isToday = selectedDate === todayISO;
  const selectedOpen = openDates.has(selectedDate);
  const fechaLarga = new Date(selectedDate + 'T12:00:00')
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] md:text-[11px] text-moca uppercase tracking-wider">Agenda</span>
              <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight first-letter:uppercase">
                {isToday ? 'Hoy' : fechaLarga}
              </h1>
              <span className="text-[12px] md:text-[13px] text-moca mt-0.5">
                {loading ? '…' : appointments.length === 0
                  ? 'Sin turnos'
                  : `${appointments.length} turno${appointments.length > 1 ? 's' : ''}`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openNew()}
                className="pressable flex items-center gap-2 bg-espresso/90 text-ivory rounded-full pl-3 pr-4 py-1.5 hover:bg-espresso border-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[13px]">Turno</span>
              </button>
              <button
                onClick={() => router.push('/panel/agenda/configuracion')}
                className="pressable-soft px-4 py-1.5 rounded-full bg-ivory border border-champagne/50 text-moca hover:text-espresso text-[13px] cursor-pointer"
              >
                Configuración
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setAnchor(toISO(addDays(new Date(anchor + 'T12:00:00'), -7)))}
              title="Semana anterior"
              className="pressable-soft w-8 h-8 rounded-full bg-ivory border border-champagne/50 flex items-center justify-center text-moca hover:text-espresso cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAnchor(toISO(addDays(new Date(anchor + 'T12:00:00'), 7)))}
              title="Semana siguiente"
              className="pressable-soft w-8 h-8 rounded-full bg-ivory border border-champagne/50 flex items-center justify-center text-moca hover:text-espresso cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => jumpTo(e.target.value)}
              title="Ir a una fecha"
              className="px-3 py-1.5 rounded-full bg-ivory border border-champagne/50 text-moca text-[12.5px] cursor-pointer outline-none"
            />
            {!isToday && (
              <button
                onClick={() => jumpTo(todayISO)}
                className="pressable-soft px-4 py-1.5 rounded-full bg-espresso/10 text-espresso text-[12.5px] hover:bg-espresso/15 border-0 cursor-pointer"
              >
                Hoy
              </button>
            )}
          </div>

          {/* Tira de días. Los que no reciben reservas van chicos y apagados. */}
          <div className="flex items-end gap-1.5 mt-4 overflow-x-auto pb-1">
            {days.map((d) => {
              const active = d.iso === selectedDate;
              const past = d.iso < todayISO;
              const esHoy = d.iso === todayISO;
              const count = apptCounts[d.iso] ?? 0;
              const abierto = openDates.has(d.iso);
              const chico = !abierto && count === 0;

              return (
                <button
                  key={d.iso}
                  onClick={() => setSelectedDate(d.iso)}
                  title={
                    count > 0 ? `${count} turno${count > 1 ? 's' : ''}`
                    : abierto ? 'Abierto para reservas'
                    : d.weekend ? 'Fin de semana · cerrado'
                    : 'Cerrado para reservas'
                  }
                  className={`pressable-soft relative shrink-0 flex flex-col items-center gap-0.5 rounded-[0.9rem] border cursor-pointer ${
                    chico ? 'px-2 py-1.5' : 'px-3 py-2'
                  } ${
                    active
                      ? 'bg-espresso border-transparent text-ivory'
                      : esHoy
                        ? 'bg-transparent border-espresso/40 text-espresso hover:bg-espresso/5'
                        : past || chico
                          ? 'bg-transparent border-transparent text-moca/50 hover:bg-espresso/5'
                          : 'bg-transparent border-transparent text-moca hover:bg-espresso/5'
                  }`}
                >
                  <span className={`uppercase tracking-wider ${chico ? 'text-[9px]' : 'text-[10px]'}`}>
                    {d.label.replace('.', '')}
                  </span>
                  <span className={`leading-none tracking-tight ${chico ? 'text-[14px]' : 'text-[19px]'}`}>
                    {d.day}
                  </span>
                  <span className="text-[9px] uppercase opacity-70">{d.month.replace('.', '')}</span>
                  {count > 0 && (
                    <span className={`absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] flex items-center justify-center ${
                      active ? 'bg-ivory text-espresso' : 'bg-espresso text-ivory'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jornada */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
          {!loading && !selectedOpen && (
            <div className="flex items-center gap-2.5 mb-3 px-3.5 py-2.5 rounded-[1rem] bg-ivory border border-champagne/50">
              <Lock className="w-3.5 h-3.5 shrink-0 text-moca" />
              <span className="text-[12px] text-moca leading-relaxed">
                Este día no recibe reservas online. Podés cargar turnos a mano, o abrirlo desde{' '}
                <button
                  onClick={() => router.push('/panel/agenda/configuracion')}
                  className="text-espresso underline bg-transparent border-0 p-0 cursor-pointer"
                >
                  Configuración
                </button>.
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-10 text-moca">
              <LoaderCircle className="spinner w-4 h-4" />
              <span className="text-[13px]">Cargando…</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {slots.map((slot) => {
                const appt = appointments.find(a => a.time.slice(0, 5) === slot);
                const cerrado = appt ? CERRADOS.includes(appt.status) : false;
                const ausente = appt?.status === 'ausente';
                const actualizando = appt && updatingId === appt.id;

                return (
                  <div key={slot} className="flex gap-3.5 items-stretch min-h-[52px]">
                    <div className="w-11 shrink-0 text-right pt-[15px]">
                      <span className={`text-[13px] ${appt ? 'text-espresso' : 'text-moca/50'}`}>{slot}</span>
                    </div>

                    <div className={`w-px shrink-0 rounded-full ${appt ? 'bg-espresso/40' : 'bg-champagne/60'}`} />

                    <div className="flex-1 min-w-0 py-1.5">
                      {appt ? (
                        <motion.div
                          layout
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[1rem] border bg-ivory ${
                            ausente ? 'border-terracota/25 opacity-75'
                            : appt.status === 'completado' ? 'border-espresso/25'
                            : 'border-champagne/60'
                          }`}
                        >
                          <button
                            onClick={() => appt.patient?.id && router.push(`/panel/pacientes/${appt.patient.id}`)}
                            className="w-9 h-9 shrink-0 rounded-full bg-espresso/10 text-espresso flex items-center justify-center text-[12px] border-0 cursor-pointer"
                          >
                            {iniciales(appt.patient?.name ?? '?')}
                          </button>

                          <button
                            onClick={() => appt.patient?.id && router.push(`/panel/pacientes/${appt.patient.id}`)}
                            className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
                          >
                            <span className="block text-[14px] text-espresso truncate">
                              {appt.patient?.name ?? 'Paciente'}
                            </span>
                            <span className="block text-[11.5px] text-moca truncate mt-0.5">
                              {appt.service?.name ?? '—'} · {appt.duration_min} min
                            </span>
                          </button>

                          {cerrado ? (
                            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] ${STATUS_CHIP[appt.status] ?? ''}`}>
                              {STATUS_LABEL[appt.status] ?? appt.status}
                            </span>
                          ) : (
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                title="Vino"
                                disabled={!!actualizando}
                                onClick={() => setConfirmAction({ appt, status: 'completado' })}
                                className="pressable-soft w-8 h-8 rounded-[0.7rem] border border-espresso/30 bg-espresso/5 hover:bg-espresso/10 flex items-center justify-center cursor-pointer"
                              >
                                <Check className="w-[15px] h-[15px] text-espresso" />
                              </button>
                              <button
                                title="No vino"
                                disabled={!!actualizando}
                                onClick={() => setConfirmAction({ appt, status: 'ausente' })}
                                className="pressable-soft w-8 h-8 rounded-[0.7rem] border border-terracota/30 bg-terracota/5 hover:bg-terracota/10 flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-[15px] h-[15px] text-terracota" />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => openNew(slot)}
                          className="pressable-soft w-full flex items-center gap-1.5 px-3.5 py-2.5 rounded-[1rem] border border-dashed border-champagne/70 bg-transparent text-moca/50 hover:text-espresso hover:border-espresso/30 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[12px]">Disponible</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        confirmAction.status === 'completado' ? (
          <ConfirmDialog
            title="Confirmar asistencia"
            message={`¿Marcar el turno de ${confirmAction.appt.patient?.name ?? 'la paciente'} de las ${confirmAction.appt.time.slice(0, 5)} hs como "Vino"?`}
            confirmLabel="Sí, vino"
            tone="emerald"
            icon="check"
            loading={updatingId === confirmAction.appt.id}
            onConfirm={() => handleStatusChange(confirmAction.appt.id, 'completado')}
            onClose={() => setConfirmAction(null)}
          />
        ) : (
          <ConfirmDialog
            title="Marcar como no vino"
            message={`El turno de ${confirmAction.appt.patient?.name ?? 'la paciente'} de las ${confirmAction.appt.time.slice(0, 5)} hs queda registrado como "No vino" en su historia clínica. No se borra nada.`}
            confirmLabel="Sí, no vino"
            tone="danger"
            loading={updatingId === confirmAction.appt.id}
            onConfirm={() => handleStatusChange(confirmAction.appt.id, 'ausente')}
            onClose={() => setConfirmAction(null)}
          />
        )
      )}

      {showNew && (
        <NewAppointmentModal
          date={selectedDate}
          defaultSlot={newDefaultSlot}
          onSave={newAppt => {
            setAppointments(prev => [...prev, newAppt].sort((a, b) => a.time.localeCompare(b.time)));
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );
}
