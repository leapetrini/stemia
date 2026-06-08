'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';

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
  cancelado: 'Cancelado',
};
const STATUS_CHIP: Record<string, string> = {
  confirmado: 'chip--emerald',
  pendiente: 'chip--gold',
  'en-sala': 'chip--silver',
  cancelado: 'chip--danger',
};

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .from('appointments')
      .select('id, time, duration_min, status, notes, deposit_paid, patient:patients(id, name, phone), service:services(id, name)')
      .eq('date', selectedDate)
      .order('time')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setAppointments((data as unknown as AppointmentRow[]) ?? []);
        setLoading(false);
      });
  }, [selectedDate]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i - 0);
    return { iso: toISO(d), label: d.toLocaleDateString('es-AR', { weekday: 'short' }), day: d.getDate() };
  });

  const selectedLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <div>
            <h1 className="scrhead__title">Agenda</h1>
            <p className="scrhead__sub" style={{ textTransform: 'capitalize' }}>{selectedLabel}</p>
          </div>
          <button className="btn btn--gold btn--sm">
            <Icon name="plus" size={15} color="#fff" /> Nuevo
          </button>
        </div>

        {/* Date strip */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {days.map(d => {
            const active = d.iso === selectedDate;
            return (
              <button key={d.iso} onClick={() => setSelectedDate(d.iso)}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--emerald)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--muted)',
                  fontFamily: 'var(--sans)', transition: 'background .15s',
                }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{d.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{d.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <div style={{ fontSize: 13 }}>Cargando…</div>
          </div>
        )}
        {error && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
            Error al cargar: {error}
          </div>
        )}
        {!loading && !error && appointments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <Icon name="calendar" size={40} color="var(--faint)" />
            <p style={{ marginTop: 12, fontSize: 14 }}>No hay turnos para este día</p>
          </div>
        )}
        {!loading && !error && appointments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appointments.map(a => (
              <div key={a.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--ink)', lineHeight: 1 }}>{a.time}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>hs</div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', flexShrink: 0 }} />
                <Avatar
                  initials={(a.patient?.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  tone="gold"
                  size={38}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.patient?.name ?? 'Paciente'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.service?.name ?? '—'} · {a.duration_min} min
                  </div>
                </div>
                <span className={`chip ${STATUS_CHIP[a.status] ?? ''}`} style={{ fontSize: 11, padding: '4px 9px', flexShrink: 0 }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
