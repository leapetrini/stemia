'use client';

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { ExpandableText } from '@/components/ui/RichText';
import { supabase } from '@/lib/supabase';
import { generateSlots, type ScheduleSettings } from '@/lib/slots';
import { BLOCKING_STATUSES, type Professional, type Service } from '@/lib/types';

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Day {
  idx: number;
  date: Date;
  dateISO: string; // YYYY-MM-DD
  day: number;
  dayName: string;
  month: string;
  state: 'libre' | 'ocupado' | 'cerrado';
}

// Días corridos desde el lunes de esta semana, fines de semana incluidos. Antes
// se salteaban los días sin lugar y la tira pasaba del 8 al 11, que confunde.
// Ahora están todos y los que no se pueden elegir van reducidos y apagados.
function genDays(n = 30): Day[] {
  const days: Day[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Alinear a lunes para que cada ventana de 7 se lea como una semana
  cursor.setDate(cursor.getDate() + (cursor.getDay() === 0 ? -6 : 1 - cursor.getDay()));

  for (let idx = 0; idx < n; idx++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    days.push({
      idx,
      date: new Date(cursor),
      dateISO: `${y}-${m}-${d}`,
      day: cursor.getDate(),
      dayName: DAY_NAMES[cursor.getDay()],
      month: MONTH_NAMES[cursor.getMonth()],
      state: 'libre',
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function fmtPrice(n: number) {
  return '$ ' + n.toLocaleString('es-AR');
}

// ── Step indicator ──────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Servicio' },
  { n: 2, label: 'Profesional' },
  { n: 3, label: 'Horario' },
  { n: 4, label: 'Confirmar' },
];

// Los pasos ya completados son botones: tocarlos vuelve atrás. Es donde la
// gente busca volver, antes solo había un botón al pie de la pantalla.
function StepIndicator({ step, onGoTo }: { step: number; onGoTo: (n: number) => void }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Paso {step} de {STEPS.length}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {step === 1 ? 'Seleccionar servicio' : step === 2 ? 'Seleccionar profesional' : step === 3 ? 'Seleccionar fecha y hora' : 'Confirmar turno'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {STEPS.map(s => {
          const done = step > s.n;
          return (
            <button key={s.n} type="button" disabled={!done}
              onClick={() => onGoTo(s.n)}
              title={done ? `Volver a ${s.label.toLowerCase()}` : undefined}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 6px', borderRadius: 999, minWidth: 0, fontFamily: 'var(--sans)',
                background: step === s.n ? 'var(--emerald)' : done ? 'var(--emerald-tint)' : 'var(--surface-2)',
                border: `1px solid ${step === s.n ? 'transparent' : done ? 'var(--emerald-tint-2)' : 'var(--line)'}`,
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                color: step === s.n ? '#fff' : done ? 'var(--emerald)' : 'var(--muted)',
                cursor: done ? 'pointer' : 'default',
              }}>
              {done
                ? <Icon name="check" size={11} color="var(--emerald)" stroke={2.5} />
                : <span style={{ fontWeight: 700 }}>{s.n}</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: servicio ────────────────────────────────────────────
// La tarjeta tiene dos zonas: arriba el botón que elige el servicio y abajo
// la descripción, que se pliega sola con "Ver más" si es larga. Están
// separadas para que tocar "Ver más" no reserve el turno sin querer.
function ServiceCard({ service, selected, onSelect }: {
  service: Service;
  selected: boolean;
  onSelect: () => void;
}) {
  const free = (service.price ?? 0) === 0;

  return (
    <div className="card card--press svc-card" style={{
      border: selected ? '2px solid var(--emerald)' : '1px solid var(--line)',
      background: selected ? 'var(--emerald-tint)' : 'var(--surface)',
    }}>
      <button type="button" className="svc-card__pick" onClick={onSelect}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{service.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
            <span className="chip chip--silver" style={{ fontSize: 11, padding: '3px 9px' }}>
              <Icon name="clock" size={11} /> {service.duration_min} min
            </span>
            <span className={`chip ${free ? 'chip--emerald' : 'chip--gold'}`} style={{ fontSize: 11, padding: '3px 9px' }}>
              {free ? 'Sin cargo' : fmtPrice(service.price)}
            </span>
            {!free && (service.deposit_amount ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Seña {fmtPrice(service.deposit_amount)}</span>
            )}
          </div>
        </div>
        <Icon name="chevR" size={17} color={selected ? 'var(--emerald)' : 'var(--faint)'} />
      </button>

      {service.description && (
        <div className="svc-card__desc">
          <ExpandableText text={service.description} collapsedHeight={72} />
        </div>
      )}
    </div>
  );
}

function ServicePicker({ services, selected, onSelect }: {
  services: Service[] | null;
  selected: Service | null;
  onSelect: (s: Service) => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
      <div className="field__label" style={{ marginBottom: 12 }}>¿Qué tratamiento querés realizarte?</div>

      {services === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1].map(i => <div key={i} style={{ height: 84, borderRadius: 'var(--r)', background: 'var(--surface-2)', opacity: 0.6 + i * 0.15 }} />)}
        </div>
      ) : services.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
          No hay servicios disponibles en este momento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {services.map(s => (
            <ServiceCard key={s.id} service={s}
              selected={selected?.id === s.id}
              onSelect={() => onSelect(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 2: profesional ─────────────────────────────────────────
function ProfessionalPicker({ professionals, service, selected, onSelect }: {
  professionals: Professional[] | null;
  service: Service | null;
  selected: Professional | null;
  onSelect: (p: Professional) => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
      <div className="field__label" style={{ marginBottom: 12 }}>
        Profesionales que realizan {service ? `"${service.name}"` : 'este tratamiento'}
      </div>

      {professionals === null ? (
        <div style={{ height: 76, borderRadius: 'var(--r)', background: 'var(--surface-2)', opacity: 0.7 }} />
      ) : professionals.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
          No hay profesionales disponibles.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {professionals.map(p => {
            const isSel = selected?.id === p.id;
            return (
              <button key={p.id} onClick={() => onSelect(p)} className="card card--press" style={{
                padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%',
                display: 'flex', alignItems: 'center', gap: 13,
                border: isSel ? '2px solid var(--emerald)' : '1px solid var(--line)',
                background: isSel ? 'var(--emerald-tint)' : 'var(--surface)',
              }}>
                <Avatar initials={p.initials} tone="emerald" size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{p.title}</div>
                </div>
                <Icon name="chevR" size={17} color={isSel ? 'var(--emerald)' : 'var(--faint)'} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step 3: fecha y hora ────────────────────────────────────────
function DateTimePicker({ service, value, onSelect }: {
  service: Service | null;
  // Lo ya elegido, para no perderlo al volver desde el paso de confirmación.
  value: { day: Day; time: string } | null;
  onSelect: (v: { day: Day; time: string }) => void;
}) {
  const allDays = useMemo(() => genDays(126), []); // 18 semanas justas
  const [selDay, setSelDay] = useState<Day | null>(value?.day ?? null);
  const [selTime, setSelTime] = useState<string | null>(value?.time ?? null);
  // Si venía con fecha elegida, la tira arranca en la semana de esa fecha.
  const [startIdx, setStartIdx] = useState(() => {
    if (!value) return 0;
    const i = allDays.findIndex(d => d.dateISO === value.day.dateISO);
    return i >= 0 ? Math.floor(i / 7) * 7 : 0;
  });
  const [bookedByDay, setBookedByDay] = useState<Record<string, string[]>>({});
  const [blockedByDay, setBlockedByDay] = useState<Record<string, string[]>>({});
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  // Fechas con al menos un horario libre. null = todavía cargando.
  const [availSet, setAvailSet] = useState<Set<string> | null>(null);

  // Horarios base según el horario de atención configurado por la doctora.
  const baseSlots = useMemo(() => generateSlots(schedule), [schedule]);

  const todayISO = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }, []);
  const nowHHMM = useMemo(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }, []);

  // Fetch all availability data in one shot
  useEffect(() => {
    const startISO = allDays[0]?.dateISO;
    const endISO = allDays[allDays.length - 1]?.dateISO;
    if (!startISO || !endISO) return;

    Promise.all([
      // Solo los turnos activos tapan el horario: uno cancelado o ausente lo
      // libera, si no el horario quedaría bloqueado para siempre.
      supabase.from('appointments').select('date, time')
        .in('status', BLOCKING_STATUSES).gte('date', startISO).lte('date', endISO),
      supabase.from('available_dates').select('date').gte('date', startISO).lte('date', endISO),
      supabase.from('blocked_slots').select('date, time').gte('date', startISO).lte('date', endISO),
      supabase.from('schedule_settings').select('start_time, end_time, slot_minutes').limit(1).maybeSingle(),
    ]).then(([apptRes, availRes, blockedRes, schedRes]) => {
      const byDay: Record<string, string[]> = {};
      for (const a of apptRes.data ?? []) {
        if (!byDay[a.date]) byDay[a.date] = [];
        byDay[a.date].push(a.time.slice(0, 5));
      }
      setBookedByDay(byDay);

      const blocked: Record<string, string[]> = {};
      for (const b of blockedRes.data ?? []) {
        if (!blocked[b.date]) blocked[b.date] = [];
        blocked[b.date].push(b.time.slice(0, 5));
      }
      setBlockedByDay(blocked);

      const sched = (schedRes.data as ScheduleSettings | null) ?? null;
      setSchedule(sched);
      const daySlots = generateSlots(sched);

      const openDays = new Set((availRes.data ?? []).map((a: { date: string }) => a.date));

      const withRoom = allDays.filter(day => {
        if (day.dateISO < todayISO) return false;
        if (!openDays.has(day.dateISO)) return false;
        const dayBooked = byDay[day.dateISO] ?? [];
        const dayBlocked = blocked[day.dateISO] ?? [];
        return daySlots.some(t => {
          if (dayBooked.includes(t) || dayBlocked.includes(t)) return false;
          if (day.dateISO === todayISO && t <= nowHHMM) return false;
          return true;
        });
      });

      setAvailSet(new Set(withRoom.map(d => d.dateISO)));
    });
  }, [allDays, todayISO, nowHHMM]);

  // La tira muestra los días corridos hasta la semana del último día con lugar.
  // Más allá sería todo gris, y antes de eso los días sin lugar se salteaban:
  // la tira pasaba del 8 al 11 y confundía.
  const stripDays = useMemo(() => {
    if (!availSet || availSet.size === 0) return [];
    let last = 0;
    allDays.forEach((d, i) => { if (availSet.has(d.dateISO)) last = i; });
    return allDays.slice(0, Math.min(allDays.length, Math.ceil((last + 1) / 7) * 7));
  }, [allDays, availSet]);

  const visible = stripDays.slice(startIdx, startIdx + 7);

  // Mes (+ año) de la ventana visible, en grande. Si abarca dos meses, los une.
  const monthLabel = useMemo(() => {
    if (!visible.length) return '';
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const d of visible) {
      const key = `${d.month} ${d.date.getFullYear()}`;
      if (!seen.has(key)) { seen.add(key); parts.push(key); }
    }
    return parts.join(' · ');
  }, [visible]);

  const slots = selDay
    ? baseSlots.filter(t => {
        const dayBooked = bookedByDay[selDay.dateISO] ?? [];
        const dayBlocked = blockedByDay[selDay.dateISO] ?? [];
        if (dayBooked.includes(t) || dayBlocked.includes(t)) return false;
        if (selDay.dateISO === todayISO && t <= nowHHMM) return false;
        return true;
      })
    : [];

  useEffect(() => {
    if (selDay && selTime) onSelect({ day: selDay, time: selTime });
  }, [selDay, selTime, onSelect]);

  const totalDays = stripDays.length;
  const free = (service?.price ?? 0) === 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
      {/* Service info banner */}
      <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--emerald-tint)', border: '1px solid var(--emerald-tint-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="user" size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--emerald)' }}>{service?.name ?? 'Consulta'}</div>
          <div style={{ fontSize: 12, color: 'var(--emerald)', opacity: .75, marginTop: 2 }}>
            {service?.duration_min ?? 30} min · <span style={{ fontWeight: 600 }}>{free ? 'Sin cargo' : fmtPrice(service!.price)}</span>
          </div>
        </div>
      </div>

      {/* Calendar strip */}
      <div style={{ padding: '18px 0 0' }}>
        <div style={{ padding: '0 20px', marginBottom: 14 }}>
          <div className="field__label" style={{ margin: 0 }}>Elegir fecha</div>
          {monthLabel && (
            <div style={{
              marginTop: 4,
              fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600,
              color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '.01em',
              textTransform: 'capitalize' as const,
            }}>
              {monthLabel}
            </div>
          )}
        </div>

        {availSet === null ? (
          // Skeleton
          <div style={{ display: 'flex', gap: 4, padding: '0 10px' }}>
            {[0,1,2,3,4,5,6].map(i => (
              <div key={i} style={{ flex: 1, height: 62, borderRadius: 12, background: 'var(--surface-2)', opacity: 0.6 + i * 0.05 }} />
            ))}
          </div>
        ) : totalDays === 0 ? (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13, lineHeight: 1.6 }}>
            No hay turnos disponibles<br />en este momento.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 10px' }}>
            <button onClick={() => setStartIdx(Math.max(0, startIdx - 7))} disabled={startIdx === 0}
              className="iconbtn" style={{ width: 30, height: 30, flexShrink: 0, opacity: startIdx === 0 ? 0.25 : 1 }}>
              <Icon name="chevL" size={14} />
            </button>

            {/* Semana completa: los días sin lugar se ven apagados y no se
                pueden tocar, pero están, así los números van corridos. */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {visible.map(d => {
                const isSel = selDay?.idx === d.idx;
                const canPick = availSet.has(d.dateISO);
                return (
                  <button key={d.idx} disabled={!canPick}
                    onClick={() => { setSelDay(d); setSelTime(null); }}
                    title={canPick ? undefined : 'Sin turnos disponibles'}
                    style={{
                      width: '100%', padding: canPick ? '9px 1px' : '7px 1px',
                      borderRadius: 10, textAlign: 'center' as const,
                      background: isSel ? 'var(--emerald)' : canPick ? '#e8f5ef' : 'transparent',
                      border: `1.5px solid ${isSel ? 'transparent' : canPick ? '#b7ddc8' : 'var(--line)'}`,
                      color: isSel ? '#fff' : canPick ? 'var(--emerald)' : 'var(--faint)',
                      opacity: canPick ? 1 : 0.5,
                      cursor: canPick ? 'pointer' : 'default', transition: 'all .12s',
                    }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' as const, opacity: .8 }}>{d.dayName}</div>
                    <div style={{ fontSize: canPick ? 16 : 13, fontWeight: 700, lineHeight: 1.2 }}>{d.day}</div>
                  </button>
                );
              })}
            </div>

            <button onClick={() => setStartIdx(Math.min(Math.max(0, totalDays - 7), startIdx + 7))}
              disabled={startIdx + 7 >= totalDays}
              className="iconbtn" style={{ width: 30, height: 30, flexShrink: 0, opacity: startIdx + 7 >= totalDays ? 0.25 : 1 }}>
              <Icon name="chevR" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Time slots */}
      {selDay && (
        <div style={{ padding: '20px 20px 0' }}>
          <div className="field__label" style={{ marginBottom: 12 }}>Elegir horario</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {slots.map(t => {
              const on = selTime === t;
              return (
                <button key={t} onClick={() => setSelTime(t)} style={{
                  padding: '11px 0', borderRadius: 'var(--r-sm)', fontSize: 13.5, fontWeight: 600,
                  background: on ? 'var(--emerald)' : 'var(--surface)',
                  border: `1.5px solid ${on ? 'transparent' : 'var(--line)'}`,
                  color: on ? '#fff' : 'var(--ink)',
                  cursor: 'pointer', transition: 'all .12s',
                }}>{t} hs</button>
              );
            })}
          </div>
        </div>
      )}

      {!selDay && availSet !== null && totalDays > 0 && (
        <div style={{ padding: '28px 20px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
          Seleccioná una fecha para ver los horarios disponibles
        </div>
      )}
    </div>
  );
}

// ── Step 4: confirmación ────────────────────────────────────────
function BookingConfirmation({ service, professional, day, time, sending, error, onConfirm }: {
  service: Service;
  professional: Professional;
  day: Day;
  time: string;
  sending: boolean;
  error: string | null;
  onConfirm: (name: string, email: string, phone: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const canSubmit = name.trim() && email.trim() && phone.trim() && !sending;
  // Servicio sin cargo: nunca se muestra ni se cobra seña
  const deposit = (service.price ?? 0) > 0 ? (service.deposit_amount ?? 0) : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
      <div className="field__label" style={{ marginBottom: 14, fontSize: 13 }}>RESUMEN DE TU TURNO</div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Avatar initials={professional.initials} tone="emerald" size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{professional.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{professional.title}</div>
          </div>
        </div>
        <hr className="divline" style={{ margin: '10px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="calendar" size={15} color="var(--muted)" />
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
              {day.dayName.charAt(0).toUpperCase() + day.dayName.slice(1)} {day.day} de {day.month} de {day.date.getFullYear()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="clock" size={15} color="var(--muted)" />
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{time} hs · {service.duration_min} min</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="user" size={15} color="var(--muted)" />
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>{service.name}</span>
            <span className="chip chip--emerald" style={{ padding: '3px 9px', fontSize: 11, marginLeft: 4 }}>
              {(service.price ?? 0) === 0 ? 'Sin cargo' : fmtPrice(service.price)}
            </span>
          </div>
        </div>
      </div>

      {/* form real: permite que el navegador / celular autocomplete los datos */}
      <form
        onSubmit={e => { e.preventDefault(); if (canSubmit) onConfirm(name.trim(), email.trim(), phone.trim()); }}
        autoComplete="on"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <div className="field">
            <label className="field__label" htmlFor="bk-name">Nombre y apellido</label>
            <input id="bk-name" name="name" className="input" placeholder="Ej. María González"
              type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bk-email">Email</label>
            <input id="bk-email" name="email" className="input" placeholder="tu@email.com"
              type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bk-phone">Teléfono</label>
            <input id="bk-phone" name="tel" className="input" placeholder="+54 9 11 0000 0000"
              type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
        </div>

        {deposit > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--gold-tint)', border: '1px solid var(--gold-soft)', marginBottom: 14 }}>
            <Icon name="lock" size={16} color="var(--gold-deep)" />
            <span style={{ fontSize: 13, color: 'var(--gold-deep)', lineHeight: 1.5 }}>
              Para reservar tu lugar se abona una seña de <strong>{fmtPrice(deposit)}</strong> con Mercado Pago. Al confirmar te llevamos al pago seguro.
            </span>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(180,83,63,.08)', border: '1px solid rgba(180,83,63,.2)', color: 'var(--danger)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn btn--primary btn--lg btn--block"
          disabled={!canSubmit}
          style={{ opacity: canSubmit ? 1 : .38 }}>
          <Icon name="check" size={18} color="#fff" stroke={2.5} />
          {sending ? 'Confirmando…' : deposit > 0 ? 'Confirmar y pagar seña' : 'Confirmar turno'}
        </button>
      </form>
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────
function BookingSuccess({ service, day, time, onClose }: { service: Service; day: Day; time: string; onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--emerald-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon name="checkCircle" size={36} color="var(--emerald)" />
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
        ¡Turno confirmado!
      </div>
      <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
        Tu {service.name.toLowerCase()} quedó agendada para el
        <strong style={{ color: 'var(--ink)' }}> {day.dayName} {day.day} de {day.month}</strong> a las
        <strong style={{ color: 'var(--ink)' }}> {time} hs</strong>.
      </div>
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 'var(--r)', background: 'var(--emerald-tint)', border: '1px solid var(--emerald-tint-2)', fontSize: 13, color: 'var(--emerald)', maxWidth: 300 }}>
        Te enviaremos el link de la videollamada por email antes del turno.
      </div>
      <button className="btn btn--ghost" style={{ marginTop: 28 }} onClick={onClose}>
        Volver al inicio
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────
interface BookingFlowProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function BookingFlow({ onClose, onSuccess }: BookingFlowProps) {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[] | null>(null);
  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [datetime, setDatetime] = useState<{ day: Day; time: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('services')
        .select('id, name, category, description, price, duration_min, deposit_amount, active, professional_id')
        .eq('active', true).order('name'),
      supabase.from('professionals').select('id, name, title, initials, bio').order('name'),
    ]).then(([svcRes, profRes]) => {
      setServices((svcRes.data as Service[]) ?? []);
      setProfessionals((profRes.data as Professional[]) ?? []);
    });
  }, []);

  // Volver no borra lo ya elegido: solo se limpia lo que dejó de tener sentido
  // cuando efectivamente se cambia de servicio o de profesional.
  const canGoBack = step > 1 && step < 5;
  const goTo = (n: number) => { if (n < step) setStep(n); };

  const pickService = (s: Service) => {
    if (s.id !== service?.id) {
      setProfessional(null);
      setDatetime(null);
    }
    setService(s);
    setStep(2);
  };

  const pickProfessional = (p: Professional) => {
    if (p.id !== professional?.id) setDatetime(null);
    setProfessional(p);
    setStep(3);
  };

  const onConfirm = async (name: string, email: string, phone: string) => {
    if (!service || !professional || !datetime) return;
    setSending(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone,
          day: datetime.day, time: datetime.time,
          service_id: service.id, professional_id: professional.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSending(false);
        setBookingError(data.error ?? 'Ocurrió un error. Por favor intentá de nuevo.');
        return;
      }
      // Servicio con seña: la API devuelve la URL del checkout de Mercado Pago
      if (data.init_point) {
        window.location.href = data.init_point;
        return; // se mantiene "Confirmando…" hasta que el navegador navega
      }
    } catch {
      setSending(false);
      setBookingError('No se pudo conectar. Verificá tu conexión e intentá de nuevo.');
      return;
    }
    setSending(false);
    setStep(5);
    onSuccess?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-tint)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 'var(--safe-top) 16px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {/* En los pasos intermedios la flecha vuelve atrás y la X pasa a la
            derecha, que es como funciona cualquier app del teléfono. */}
        <button className="iconbtn" style={{ flexShrink: 0 }}
          title={canGoBack ? 'Volver' : 'Cerrar'}
          onClick={() => (canGoBack ? setStep(step - 1) : onClose())}>
          <Icon name={canGoBack ? 'chevL' : 'x'} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {professional ? (
            <>
              <Avatar initials={professional.initials} tone="emerald" size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {professional.name}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
                  NUEVO TURNO
                </div>
              </div>
            </>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Stemia</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
                NUEVO TURNO
              </div>
            </div>
          )}
        </div>

        {canGoBack && (
          <button className="iconbtn" onClick={onClose} title="Cerrar" style={{ flexShrink: 0 }}>
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      {step < 5 && <StepIndicator step={step} onGoTo={goTo} />}

      <div key={step} className="step-anim" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {step === 1 && (
          <ServicePicker services={services} selected={service} onSelect={pickService} />
        )}
        {step === 2 && (
          // Cada servicio lo realiza su profesional. Si el servicio no tiene
          // uno asignado (dato viejo), se ofrecen todos.
          <ProfessionalPicker
            professionals={
              professionals && service?.professional_id
                ? professionals.filter(p => p.id === service.professional_id)
                : professionals
            }
            service={service} selected={professional}
            onSelect={pickProfessional} />
        )}
        {step === 3 && <DateTimePicker service={service} value={datetime} onSelect={setDatetime} />}
        {step === 4 && service && professional && datetime && (
          <BookingConfirmation
            service={service}
            professional={professional}
            day={datetime.day}
            time={datetime.time}
            sending={sending}
            error={bookingError}
            onConfirm={onConfirm}
          />
        )}
        {step === 5 && service && datetime && (
          <BookingSuccess service={service} day={datetime.day} time={datetime.time} onClose={onClose} />
        )}
      </div>

      {/* Bottom bar */}
      {step === 2 && (
        <div style={{ padding: '8px 20px calc(8px + var(--safe-bottom))', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <button className="btn btn--ghost btn--block" style={{ fontSize: 13 }} onClick={() => setStep(1)}>
            <Icon name="chevL" size={15} /> Cambiar servicio
          </button>
        </div>
      )}
      {step === 3 && (
        <div style={{ padding: '12px 20px calc(12px + var(--safe-bottom))', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" style={{ fontSize: 13 }} onClick={() => setStep(2)}>
            <Icon name="chevL" size={15} /> Volver
          </button>
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => setStep(4)}
            disabled={!datetime}>
            Continuar <Icon name="chevR" size={16} color="#fff" />
          </button>
        </div>
      )}
      {step === 4 && (
        <div style={{ padding: '8px 20px calc(8px + var(--safe-bottom))', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <button className="btn btn--ghost btn--block" style={{ fontSize: 13 }} onClick={() => setStep(3)}>
            <Icon name="chevL" size={15} /> Cambiar fecha u horario
          </button>
        </div>
      )}
    </div>
  );
}
