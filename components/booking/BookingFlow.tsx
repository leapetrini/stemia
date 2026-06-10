'use client';

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import type { Professional } from '@/lib/types';

const SERVICE = {
  id: 's1',
  name: 'Consulta online de piel',
  description: 'Evaluación dermatológica por videollamada',
  duration_min: 30,
  price: 0,
  modality: 'Online',
};

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Slots de 10:00 a 16:30 cada 30 min
const ALL_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const totalMin = 10 * 60 + i * 30;
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

interface Day {
  idx: number;
  date: Date;
  dateISO: string; // YYYY-MM-DD
  day: number;
  dayName: string;
  month: string;
  state: 'libre' | 'ocupado' | 'cerrado';
}

function genDays(n = 30): Day[] {
  const days: Day[] = [];
  let idx = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (days.length < n) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      days.push({
        idx,
        date: new Date(cursor),
        dateISO: `${y}-${m}-${d}`,
        day: cursor.getDate(),
        dayName: DAY_NAMES[dow],
        month: MONTH_NAMES[cursor.getMonth()],
        state: 'libre',
      });
      idx++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function genSlots(_dayIdx: number): string[] {
  return ALL_SLOTS;
}

// ── Step indicator ──────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Paso {step} de 2</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {step === 1 ? 'Seleccionar Fecha y hora' : 'Confirmar turno'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[{ n: 1, label: 'Horario' }, { n: 2, label: 'Confirmar' }].map(s => (
          <div key={s.n} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 10px', borderRadius: 999,
            background: step === s.n ? 'var(--emerald)' : step > s.n ? 'var(--emerald-tint)' : 'var(--surface-2)',
            border: `1px solid ${step === s.n ? 'transparent' : step > s.n ? 'var(--emerald-tint-2)' : 'var(--line)'}`,
            fontSize: 12, fontWeight: 600,
            color: step === s.n ? '#fff' : step > s.n ? 'var(--emerald)' : 'var(--muted)',
          }}>
            {step > s.n
              ? <Icon name="check" size={12} color="var(--emerald)" stroke={2.5} />
              : <span style={{ fontWeight: 700, marginRight: 2 }}>{s.n}</span>}
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Date & Time picker ──────────────────────────────────────────
function DateTimePicker({ onSelect }: { onSelect: (v: { day: Day; time: string }) => void }) {
  const allDays = useMemo(() => genDays(30), []);
  const [startIdx, setStartIdx] = useState(0);
  const [selDay, setSelDay] = useState<Day | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const visible = allDays.slice(startIdx, startIdx + 5);
  const slots = selDay ? ALL_SLOTS.filter(t => !bookedTimes.includes(t)) : [];

  useEffect(() => {
    if (!selDay) return;
    supabase
      .from('appointments')
      .select('time')
      .eq('date', selDay.dateISO)
      .then(({ data }) => {
        setBookedTimes((data ?? []).map((a: { time: string }) => a.time.slice(0, 5)));
      });
  }, [selDay]);

  useEffect(() => {
    if (selDay && selTime) onSelect({ day: selDay, time: selTime });
  }, [selDay, selTime, onSelect]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
      {/* Service info banner */}
      <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--emerald-tint)', border: '1px solid var(--emerald-tint-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="user" size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--emerald)' }}>{SERVICE.name}</div>
          <div style={{ fontSize: 12, color: 'var(--emerald)', opacity: .75, marginTop: 2 }}>
            {SERVICE.duration_min} min · <span style={{ fontWeight: 600 }}>Online · Sin cargo</span>
          </div>
        </div>
      </div>

      {/* Calendar strip */}
      <div style={{ padding: '18px 0 0' }}>
        <div className="field__label" style={{ padding: '0 20px', marginBottom: 12 }}>Elegir fecha</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px' }}>
          <button onClick={() => setStartIdx(Math.max(0, startIdx - 5))} disabled={startIdx === 0}
            className="iconbtn" style={{ width: 32, height: 32, flexShrink: 0, opacity: startIdx === 0 ? 0.25 : 1 }}>
            <Icon name="chevL" size={15} />
          </button>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
            {visible.map(d => {
              const isSel = selDay?.idx === d.idx;
              return (
                <button key={d.idx} onClick={() => { setSelDay(d); setSelTime(null); setBookedTimes([]); }}
                  style={{
                    width: '100%', padding: '8px 2px', borderRadius: 12, textAlign: 'center' as const,
                    background: isSel ? 'var(--emerald)' : '#e8f5ef',
                    border: `1.5px solid ${isSel ? 'transparent' : '#b7ddc8'}`,
                    color: isSel ? '#fff' : 'var(--emerald)',
                    cursor: 'pointer', transition: 'all .12s',
                  }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, opacity: .8 }}>{d.month}</div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{d.dayName}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>{d.day}</div>
                </button>
              );
            })}
          </div>

          <button onClick={() => setStartIdx(Math.min(allDays.length - 5, startIdx + 5))}
            disabled={startIdx + 5 >= allDays.length}
            className="iconbtn" style={{ width: 32, height: 32, flexShrink: 0, opacity: startIdx + 5 >= allDays.length ? 0.25 : 1 }}>
            <Icon name="chevR" size={15} />
          </button>
        </div>
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

      {!selDay && (
        <div style={{ padding: '28px 20px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
          Seleccioná una fecha para ver los horarios disponibles
        </div>
      )}
    </div>
  );
}

// ── Confirmation ────────────────────────────────────────────────
function BookingConfirmation({ professional, day, time, sending, error, onConfirm }: {
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
              {day.dayName.charAt(0).toUpperCase() + day.dayName.slice(1)} {day.day} de {day.month} de 2026
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="clock" size={15} color="var(--muted)" />
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{time} hs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="user" size={15} color="var(--muted)" />
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>{SERVICE.name}</span>
            <span className="chip chip--emerald" style={{ padding: '3px 9px', fontSize: 11, marginLeft: 4 }}>Online</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <div className="field">
          <label className="field__label">Nombre y apellido</label>
          <input className="input" placeholder="Ej. María González" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Email</label>
          <input className="input" type="email" placeholder="tu@email.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Teléfono</label>
          <input className="input" type="tel" placeholder="+54 9 11 0000 0000" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(180,83,63,.08)', border: '1px solid rgba(180,83,63,.2)', color: 'var(--danger)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button className="btn btn--primary btn--lg btn--block"
        disabled={!canSubmit}
        style={{ opacity: canSubmit ? 1 : .38 }}
        onClick={() => onConfirm(name, email, phone)}>
        <Icon name="check" size={18} color="#fff" stroke={2.5} />
        {sending ? 'Confirmando…' : 'Confirmar turno'}
      </button>
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────
function BookingSuccess({ day, time, onClose }: { day: Day; time: string; onClose: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--emerald-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon name="checkCircle" size={36} color="var(--emerald)" />
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
        ¡Turno confirmado!
      </div>
      <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
        Tu consulta online de piel quedó agendada para el
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
  const professional: Professional = { id: 'p1', name: 'Dra. Valentina Calvo', title: 'Médica', initials: 'VC', bio: null };
  const [datetime, setDatetime] = useState<{ day: Day; time: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const onConfirm = async (name: string, email: string, phone: string) => {
    setSending(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, day: datetime?.day, time: datetime?.time }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSending(false);
        setBookingError(data.error ?? 'Ocurrió un error. Por favor intentá de nuevo.');
        return;
      }
    } catch (_) {
      setSending(false);
      setBookingError('No se pudo conectar. Verificá tu conexión e intentá de nuevo.');
      return;
    }
    setSending(false);
    setStep(3);
    onSuccess?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-tint)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: 'var(--safe-top) 16px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="iconbtn" onClick={onClose} style={{ flexShrink: 0 }}>
          <Icon name="x" size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={professional.initials} tone="emerald" size={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {professional.name}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
              NUEVO TURNO
            </div>
          </div>
        </div>
      </div>

      {step < 3 && <StepIndicator step={step} />}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {step === 1 && <DateTimePicker onSelect={setDatetime} />}
        {step === 2 && datetime && (
          <BookingConfirmation
            professional={professional}
            day={datetime.day}
            time={datetime.time}
            sending={sending}
            error={bookingError}
            onConfirm={onConfirm}
          />
        )}
        {step === 3 && datetime && (
          <BookingSuccess day={datetime.day} time={datetime.time} onClose={onClose} />
        )}
      </div>

      {/* Bottom bar */}
      {step === 1 && (
        <div style={{ padding: '12px 20px calc(12px + var(--safe-bottom))', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <button className="btn btn--primary btn--block" onClick={() => setStep(2)}
            disabled={!datetime} style={{ opacity: datetime ? 1 : .38 }}>
            Continuar <Icon name="chevR" size={16} color="#fff" />
          </button>
        </div>
      )}
      {step === 2 && (
        <div style={{ padding: '8px 20px calc(8px + var(--safe-bottom))', borderTop: '1px solid var(--line)', background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <button className="btn btn--ghost btn--block" style={{ fontSize: 13 }} onClick={() => setStep(1)}>
            <Icon name="chevL" size={15} /> Cambiar fecha u horario
          </button>
        </div>
      )}
    </div>
  );
}
