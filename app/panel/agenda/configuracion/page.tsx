'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { generateSlots, SLOT_MINUTES_OPTIONS, DEFAULT_SCHEDULE, type ScheduleSettings } from '@/lib/slots';
import { BLOCKING_STATUSES } from '@/lib/types';

// Turno ya reservado, para no dejar cerrar un día que tiene gente anotada.
type BookedAppt = {
  date: string;
  time: string;       // "HH:MM"
  patientName: string;
  serviceName: string;
};

const FULL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_ABBR = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
const WEEKDAY_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// Opciones de hora para los selects (06:00 a 22:00 cada 30 min)
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => {
  const min = 6 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
});

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function getWeekdaysInHalf(year: number, month: number, half: 1 | 2): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const start = half === 1 ? 1 : 16;
  const end = half === 1 ? 15 : daysInMonth;
  const result: string[] = [];
  for (let d = start; d <= end; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) result.push(toISO(year, month, d));
  }
  return result;
}

export default function AgendaConfigPage() {
  const router = useRouter();
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set()); // "date|HH:MM"
  const [schedule, setSchedule] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [togglingHalf, setTogglingHalf] = useState<string | null>(null);
  const [togglingDay, setTogglingDay] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [selDay, setSelDay] = useState<string | null>(null);

  // Turnos ya reservados de hoy en adelante, para avisar antes de cerrar.
  const [booked, setBooked] = useState<BookedAppt[]>([]);
  // Día o quincena que se está por cerrar teniendo turnos anotados.
  const [closeWarning, setCloseWarning] = useState<
    { kind: 'day'; dateISO: string } | { kind: 'half'; year: number; month: number; half: 1 | 2 } | null
  >(null);

  useEffect(() => {
    Promise.all([
      supabase.from('professionals').select('id').limit(1).single(),
      supabase.from('available_dates').select('date'),
      supabase.from('blocked_slots').select('date, time'),
      supabase.from('schedule_settings').select('start_time, end_time, slot_minutes').limit(1).maybeSingle(),
      // Los turnos activos de acá en adelante: son los que no hay que pisar.
      supabase.from('appointments')
        .select('date, time, status, patient:patients(name), service:services(name)')
        .in('status', BLOCKING_STATUSES)
        .gte('date', todayISO),
    ]).then(([profRes, availRes, blockedRes, schedRes, apptRes]) => {
      if (profRes.data) setProfessionalId(profRes.data.id);
      setOpenDates(new Set((availRes.data ?? []).map((r: { date: string }) => r.date)));
      setBlocked(new Set((blockedRes.data ?? []).map((r: { date: string; time: string }) => `${r.date}|${r.time.slice(0,5)}`)));
      if (schedRes.data) {
        setSchedule({
          start_time: (schedRes.data.start_time as string).slice(0, 5),
          end_time: (schedRes.data.end_time as string).slice(0, 5),
          slot_minutes: schedRes.data.slot_minutes as number,
        });
      }

      type ApptRow = {
        date: string; time: string;
        patient: { name: string } | { name: string }[] | null;
        service: { name: string } | { name: string }[] | null;
      };
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
      setBooked(((apptRes.data as unknown as ApptRow[]) ?? []).map(r => ({
        date: r.date,
        time: r.time.slice(0, 5),
        patientName: one(r.patient)?.name ?? 'Paciente',
        serviceName: one(r.service)?.name ?? 'Consulta',
      })));

      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "YYYY-MM-DD|HH:MM" → turno, para pintar los horarios tomados
  const bookedBySlot = useMemo(() => {
    const map = new Map<string, BookedAppt>();
    for (const a of booked) map.set(`${a.date}|${a.time}`, a);
    return map;
  }, [booked]);

  // Cuántos turnos tiene cada día
  const bookedByDate = useMemo(() => {
    const map = new Map<string, BookedAppt[]>();
    for (const a of booked) map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return map;
  }, [booked]);

  const baseSlots = useMemo(() => generateSlots(schedule), [schedule]);

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const total = today.getMonth() + i;
      result.push({ year: today.getFullYear() + Math.floor(total / 12), month: total % 12 });
    }
    return result;
  }, []);

  const saveSchedule = async (patch: Partial<ScheduleSettings>) => {
    if (!professionalId) return;
    const next = { ...schedule, ...patch };
    setSchedule(next);
    setSavingSchedule(true);
    await supabase.from('schedule_settings').upsert({
      professional_id: professionalId,
      start_time: next.start_time,
      end_time: next.end_time,
      slot_minutes: next.slot_minutes,
      updated_at: new Date().toISOString(),
    });
    setSavingSchedule(false);
  };

  const closeHalf = async (year: number, month: number, half: 1 | 2) => {
    if (!professionalId) return;
    const weekdays = getWeekdaysInHalf(year, month, half);
    setTogglingHalf(`${year}-${month}-${half}`);
    await supabase.from('available_dates').delete()
      .eq('professional_id', professionalId).in('date', weekdays);
    setOpenDates(prev => { const n = new Set(prev); weekdays.forEach(d => n.delete(d)); return n; });
    setTogglingHalf(null);
    setCloseWarning(null);
  };

  const toggleHalf = async (year: number, month: number, half: 1 | 2) => {
    if (!professionalId) return;
    const key = `${year}-${month}-${half}`;
    if (togglingHalf === key) return;
    const weekdays = getWeekdaysInHalf(year, month, half);
    const openCount = weekdays.filter(d => openDates.has(d)).length;
    const isFullyOpen = openCount === weekdays.length && weekdays.length > 0;

    if (isFullyOpen) {
      // Cerrar 15 días de una es lo más peligroso de esta pantalla: si alguno
      // ya tiene gente anotada, primero se avisa.
      if (weekdays.some(d => bookedByDate.has(d))) {
        setCloseWarning({ kind: 'half', year, month, half });
        return;
      }
      await closeHalf(year, month, half);
      return;
    }

    setTogglingHalf(key);
    const toAdd = weekdays.filter(d => !openDates.has(d));
    if (toAdd.length > 0) {
      await supabase.from('available_dates').upsert(toAdd.map(date => ({ professional_id: professionalId, date })));
      setOpenDates(prev => new Set([...prev, ...toAdd]));
    }
    setTogglingHalf(null);
  };

  const openDay = async (dateISO: string) => {
    if (!professionalId || togglingDay) return;
    setTogglingDay(dateISO);
    await supabase.from('available_dates').upsert({ professional_id: professionalId, date: dateISO });
    setOpenDates(prev => new Set([...prev, dateISO]));
    setTogglingDay(null);
  };

  const closeDay = async (dateISO: string) => {
    if (!professionalId || togglingDay) return;
    setTogglingDay(dateISO);
    await supabase.from('available_dates').delete()
      .eq('professional_id', professionalId).eq('date', dateISO);
    setOpenDates(prev => { const n = new Set(prev); n.delete(dateISO); return n; });
    setTogglingDay(null);
    setCloseWarning(null);
  };

  // Cerrar un día con turnos anotados no los cancela: hay que decirlo antes.
  const requestCloseDay = (dateISO: string) => {
    if (bookedByDate.has(dateISO)) setCloseWarning({ kind: 'day', dateISO });
    else closeDay(dateISO);
  };

  const toggleSlot = async (dateISO: string, time: string) => {
    if (!professionalId) return;
    const key = `${dateISO}|${time}`;
    if (busySlot === key) return;
    // Un horario ya reservado no se puede bloquear: bloquearlo no cancelaría
    // el turno, solo lo escondería de la reserva.
    if (bookedBySlot.has(key)) return;
    setBusySlot(key);
    if (blocked.has(key)) {
      await supabase.from('blocked_slots').delete()
        .eq('professional_id', professionalId).eq('date', dateISO).eq('time', time);
      setBlocked(prev => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      await supabase.from('blocked_slots').upsert({ professional_id: professionalId, date: dateISO, time });
      setBlocked(prev => new Set([...prev, key]));
    }
    setBusySlot(null);
  };

  // Compact calendar data
  const firstDayOfCal = new Date(calYear, calMonth, 1).getDay();
  const daysInCal = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDayOfCal).fill(null),
    ...Array.from({ length: daysInCal }, (_, i) => i + 1),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const selDayDate = selDay ? new Date(selDay + 'T12:00:00') : null;
  const selDayOpen = selDay ? openDates.has(selDay) : false;
  const selDayBlockedCount = selDay ? baseSlots.filter(t => blocked.has(`${selDay}|${t}`)).length : 0;
  const selDayBookedCount = selDay ? (bookedByDate.get(selDay)?.length ?? 0) : 0;

  // Texto del aviso cuando se quiere cerrar algo que ya tiene gente anotada.
  const fmtDayLong = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  let closeWarningTitle = '';
  let closeWarningMessage = '';
  if (closeWarning?.kind === 'day') {
    const appts = [...(bookedByDate.get(closeWarning.dateISO) ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    closeWarningTitle = appts.length === 1 ? 'Este día ya tiene un turno' : `Este día ya tiene ${appts.length} turnos`;
    closeWarningMessage =
      `${fmtDayLong(closeWarning.dateISO)}:\n\n` +
      appts.map(a => `· ${a.time} hs — ${a.patientName} (${a.serviceName})`).join('\n') +
      `\n\nCerrar el día solo evita que entren reservas nuevas: estos turnos NO se cancelan. ` +
      `Para cancelarlos, andá a Turnos.`;
  } else if (closeWarning?.kind === 'half') {
    const weekdays = getWeekdaysInHalf(closeWarning.year, closeWarning.month, closeWarning.half);
    const withAppts = weekdays.filter(d => bookedByDate.has(d));
    const total = withAppts.reduce((n, d) => n + (bookedByDate.get(d)?.length ?? 0), 0);
    closeWarningTitle = 'Hay turnos en esta quincena';
    closeWarningMessage =
      `${FULL_MONTHS[closeWarning.month]} ${closeWarning.half === 1 ? '1–15' : '16 en adelante'}: ` +
      `${withAppts.length} día${withAppts.length === 1 ? '' : 's'} con ${total} turno${total === 1 ? '' : 's'} reservado${total === 1 ? '' : 's'}.\n\n` +
      withAppts.map(d => {
        const n = bookedByDate.get(d)?.length ?? 0;
        return `· ${fmtDayLong(d)} — ${n} turno${n === 1 ? '' : 's'}`;
      }).join('\n') +
      `\n\nCerrar la quincena solo evita que entren reservas nuevas: estos turnos NO se cancelan.`;
  }

  return (
    <>
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <div>
            <h1 className="scrhead__title">Agenda</h1>
            <p className="scrhead__sub">Configuración</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          <button onClick={() => router.push('/panel/agenda')}
            style={{ padding: '7px 16px', borderRadius: 99, border: '1.5px solid var(--line)',
              background: 'transparent', color: 'var(--muted)', fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13 }}>
            Turnos
          </button>
          <button style={{ padding: '7px 16px', borderRadius: 99, border: 'none',
            background: 'var(--emerald)', color: '#fff', fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Configuración
          </button>
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 48 }}>
        {loading ? (
          <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--faint)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--emerald)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Cargando configuración…</span>
          </div>
        ) : (
          <>
          {/* ── Horario de atención ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontFamily: 'var(--serif)', fontWeight: 600, color: 'var(--ink)' }}>
                  Horario de atención
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                  Define los turnos que ven los clientes en los días abiertos.
                </div>
              </div>
              <span style={{ fontSize: 11, color: savingSchedule ? 'var(--emerald)' : 'var(--faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {savingSchedule ? 'Guardando…' : 'Guardado'}
              </span>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-sm)', padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.02em' }}>Desde</span>
                  <select value={schedule.start_time}
                    onChange={e => saveSchedule({ start_time: e.target.value })}
                    style={selStyle}>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t} hs</option>)}
                  </select>
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.02em' }}>Hasta</span>
                  <select value={schedule.end_time}
                    onChange={e => saveSchedule({ end_time: e.target.value })}
                    style={selStyle}>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t} hs</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: 'block', marginTop: 12 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.02em' }}>Duración de cada turno</span>
                <select value={schedule.slot_minutes}
                  onChange={e => saveSchedule({ slot_minutes: Number(e.target.value) })}
                  style={selStyle}>
                  {SLOT_MINUTES_OPTIONS.map(m => <option key={m} value={m}>{m} minutos</option>)}
                </select>
              </label>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
                  {baseSlots.length > 0
                    ? `${baseSlots.length} turnos por día`
                    : 'El horario "hasta" debe ser mayor que "desde"'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {baseSlots.map(t => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 600, color: 'var(--emerald)', background: 'var(--emerald-tint)', border: '1px solid var(--emerald-tint-2)', borderRadius: 7, padding: '3px 7px' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Habilitar por períodos ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontFamily: 'var(--serif)', fontWeight: 600, color: 'var(--ink)' }}>
                Habilitar por períodos
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                Por defecto la agenda está cerrada. Activá las quincenas que querés abrir.
                Abren solo de lunes a viernes: para atender un sábado, tocalo en el
                calendario de abajo.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {months.map(({ year, month }) => {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                return (
                  <div key={`${year}-${month}`}
                    style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
                    {/* Month header */}
                    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                      <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', letterSpacing: '.01em' }}>
                        {FULL_MONTHS[month]}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 0 }}>{year}</div>
                    </div>
                    {/* Halves */}
                    <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                      {([1, 2] as const).map(half => {
                        const weekdays = getWeekdaysInHalf(year, month, half);
                        const openCount = weekdays.filter(d => openDates.has(d)).length;
                        const total = weekdays.length;
                        const isFullyOpen = openCount === total && total > 0;
                        const isPartial = openCount > 0 && !isFullyOpen;
                        const key = `${year}-${month}-${half}`;
                        const isSpinning = togglingHalf === key;
                        const halfLabel = half === 1 ? `1–15` : `16–${daysInMonth}`;

                        return (
                          <button key={half}
                            onClick={() => toggleHalf(year, month, half)}
                            disabled={!!togglingHalf}
                            style={{
                              flex: 1, padding: '10px 4px 10px', borderRadius: 10,
                              background: isFullyOpen
                                ? 'var(--emerald)'
                                : isPartial
                                ? 'rgba(154,124,58,.1)'
                                : 'var(--surface-2)',
                              border: isFullyOpen
                                ? '1.5px solid transparent'
                                : isPartial
                                ? '1.5px solid rgba(154,124,58,.35)'
                                : '1.5px solid var(--line)',
                              color: isFullyOpen ? '#fff' : isPartial ? 'var(--emerald)' : 'var(--faint)',
                              cursor: togglingHalf ? 'default' : 'pointer',
                              transition: 'background .2s, border .2s, color .2s, transform .1s',
                              opacity: isSpinning ? 0.55 : 1,
                              textAlign: 'center',
                              transform: isSpinning ? 'scale(.97)' : 'scale(1)',
                            }}>
                            <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--sans)', letterSpacing: '.02em', marginBottom: 4, opacity: isFullyOpen ? 0.8 : 1 }}>
                              {halfLabel}
                            </div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--sans)', lineHeight: 1 }}>
                              {isFullyOpen
                                ? `${total} días ✓`
                                : isPartial
                                ? `${openCount}/${total}`
                                : 'Cerrado'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Ajuste por día ── */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 17, fontFamily: 'var(--serif)', fontWeight: 600, color: 'var(--ink)' }}>
                Ajuste por día
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                Tocá un día para abrirlo, cerrarlo o bloquear horarios sueltos.
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <button onClick={() => { setSelDay(null); if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                  className="iconbtn" style={{ width: 30, height: 30, flexShrink: 0 }}>
                  <Icon name="chevL" size={14} />
                </button>
                <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                  {FULL_MONTHS[calMonth]} {calYear}
                </div>
                <button onClick={() => { setSelDay(null); if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                  className="iconbtn" style={{ width: 30, height: 30, flexShrink: 0 }}>
                  <Icon name="chevR" size={14} />
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '6px 8px 0' }}>
                {DAY_ABBR.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '4px 0', letterSpacing: '.03em' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px 10px', gap: 2 }}>
                {calCells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} style={{ aspectRatio: '1' }} />;
                  const dateISO = toISO(calYear, calMonth, day);
                  const dow = new Date(calYear, calMonth, day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isPast = dateISO < todayISO;
                  const isOpen = openDates.has(dateISO);
                  const isToday = dateISO === todayISO;
                  const isSel = selDay === dateISO;
                  // Los fines de semana se pueden abrir de a uno. Lo que no
                  // hacen es abrirse solos con las quincenas.
                  const canClick = !isPast;
                  const hasBlocks = isOpen && baseSlots.some(t => blocked.has(`${dateISO}|${t}`));
                  const apptCount = bookedByDate.get(dateISO)?.length ?? 0;

                  return (
                    <button key={day}
                      onClick={() => canClick && setSelDay(isSel ? null : dateISO)}
                      title={apptCount > 0 ? `${apptCount} turno${apptCount > 1 ? 's' : ''} reservado${apptCount > 1 ? 's' : ''}` : undefined}
                      style={{
                        aspectRatio: '1', borderRadius: '50%',
                        border: isSel ? '2px solid var(--gold)' : '2px solid transparent',
                        background: isOpen
                          ? 'var(--emerald)'
                          : isToday
                          ? 'var(--emerald-tint)'
                          : 'transparent',
                        color: isOpen
                          ? '#fff'
                          : isToday
                          ? 'var(--emerald)'
                          : (isWeekend || isPast)
                          ? 'var(--faint)'
                          : 'var(--ink)',
                        fontSize: 12, fontWeight: isOpen ? 700 : 400,
                        cursor: canClick ? 'pointer' : 'default',
                        // El fin de semana cerrado se ve apagado, pero si está
                        // abierto tiene que verse igual que cualquier otro día.
                        opacity: isPast ? 0.3 : (isWeekend && !isOpen) ? 0.45 : 1,
                        transition: 'background .15s, color .15s, border .15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        outline: 'none', position: 'relative',
                        fontFamily: 'var(--sans)',
                      }}>
                      {day}
                      {/* Días con turnos: punto dorado, se ve esté abierto o cerrado */}
                      {apptCount > 0 && (
                        <span style={{
                          position: 'absolute', top: 1, right: 1, minWidth: 13, height: 13, padding: '0 2px',
                          borderRadius: 99, background: 'var(--gold)', color: '#fff',
                          fontSize: 8.5, fontWeight: 700, lineHeight: '13px',
                          border: '1.5px solid var(--surface)',
                        }}>
                          {apptCount}
                        </span>
                      )}
                      {hasBlocks && (
                        <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff', opacity: .9 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ padding: '8px 16px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--emerald)' }} />
                  Abierto
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)' }} />
                  Cerrado
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--emerald)', position: 'relative' }}>
                    <span style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: '#fff' }} />
                  </div>
                  Con horarios bloqueados
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--gold)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
                  Turnos reservados
                </div>
              </div>
            </div>

            {/* Panel del día seleccionado */}
            {selDay && selDayDate && (
              <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                      {WEEKDAY_FULL[selDayDate.getDay()]} {selDayDate.getDate()} de {FULL_MONTHS[selDayDate.getMonth()]}
                    </div>
                    <div style={{ fontSize: 12, color: selDayOpen ? 'var(--emerald)' : 'var(--faint)', marginTop: 2, fontWeight: 600 }}>
                      {[
                        selDayOpen ? 'Abierto' : 'Cerrado',
                        selDayBookedCount > 0
                          ? `${selDayBookedCount} turno${selDayBookedCount > 1 ? 's' : ''} reservado${selDayBookedCount > 1 ? 's' : ''}`
                          : null,
                        selDayOpen && selDayBlockedCount > 0
                          ? `${selDayBlockedCount} horario${selDayBlockedCount > 1 ? 's' : ''} bloqueado${selDayBlockedCount > 1 ? 's' : ''}`
                          : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => selDayOpen ? requestCloseDay(selDay) : openDay(selDay)}
                    disabled={togglingDay === selDay}
                    style={{
                      padding: '8px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--sans)', flexShrink: 0,
                      border: selDayOpen ? '1.5px solid var(--line)' : 'none',
                      background: selDayOpen ? 'transparent' : 'var(--emerald)',
                      color: selDayOpen ? 'var(--danger)' : '#fff',
                      opacity: togglingDay === selDay ? 0.5 : 1,
                    }}>
                    {selDayOpen ? 'Cerrar día' : 'Abrir día'}
                  </button>
                </div>

                {selDayOpen && (
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                      Tocá un horario para bloquearlo. Los bloqueados no se ofrecen a los clientes.
                    </div>
                    {baseSlots.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Configurá el horario de atención arriba para ver los turnos.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {baseSlots.map(t => {
                          const key = `${selDay}|${t}`;
                          const appt = bookedBySlot.get(key);
                          const isBlocked = blocked.has(key);
                          const isBusy = busySlot === key;

                          // Reservado: no se toca desde acá. Se muestra con quién
                          // es el turno para que no haya dudas.
                          if (appt) {
                            return (
                              <div key={t} title={`${appt.patientName} · ${appt.serviceName}`}
                                style={{
                                  padding: '7px 4px', borderRadius: 10, fontFamily: 'var(--sans)',
                                  border: '1.5px solid var(--gold)', background: 'var(--gold-tint)',
                                  color: 'var(--gold-deep)', textAlign: 'center', cursor: 'not-allowed',
                                }}>
                                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{t}</div>
                                <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {appt.patientName.split(' ')[0]}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button key={t}
                              onClick={() => toggleSlot(selDay, t)}
                              disabled={isBusy}
                              style={{
                                padding: '10px 2px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                fontFamily: 'var(--sans)', cursor: 'pointer',
                                border: isBlocked ? '1.5px solid var(--line)' : '1.5px solid var(--emerald)',
                                background: isBlocked ? 'var(--surface-2)' : 'var(--emerald-tint)',
                                color: isBlocked ? 'var(--faint)' : 'var(--emerald)',
                                textDecoration: isBlocked ? 'line-through' : 'none',
                                opacity: isBusy ? 0.5 : 1,
                                transition: 'all .12s',
                              }}>
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selDayBookedCount > 0 && (
                      <div style={{ display: 'flex', gap: 9, marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--gold-tint)', border: '1px solid var(--gold-soft)' }}>
                        <Icon name="alert" size={15} color="var(--gold-deep)" />
                        <div style={{ fontSize: 12, color: 'var(--gold-deep)', lineHeight: 1.5 }}>
                          Los horarios en dorado ya están reservados y no se pueden bloquear.
                          Para cancelar un turno andá a <strong>Turnos</strong>.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>

    {/* Cerrar un día o una quincena con turnos anotados no los cancela.
        Se avisa con nombre y hora para que no quede la duda. */}
    {closeWarning && (
      <ConfirmDialog
        title={closeWarningTitle}
        message={closeWarningMessage}
        confirmLabel="Cerrar igual"
        tone="danger"
        icon="alert"
        loading={!!togglingDay || !!togglingHalf}
        onConfirm={() => {
          if (closeWarning.kind === 'day') closeDay(closeWarning.dateISO);
          else closeHalf(closeWarning.year, closeWarning.month, closeWarning.half);
        }}
        onClose={() => setCloseWarning(null)}
      />
    )}

    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
    </>
  );
}

const selStyle: React.CSSProperties = {
  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
  fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
};
