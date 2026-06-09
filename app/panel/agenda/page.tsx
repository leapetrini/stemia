'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NewAppointmentModal } from '@/components/panel/NewAppointmentModal';

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
  confirmado: 'chip--gold',
  pendiente: 'chip--silver',
  'en-sala': 'chip--silver',
  completado: 'chip--emerald',
  ausente: 'chip--danger',
  cancelado: 'chip--danger',
};

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function AgendaPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAppointments = (date: string) => {
    setLoading(true);
    setError(null);
    supabase
      .from('appointments')
      .select('id, time, duration_min, status, notes, deposit_paid, patient:patients(id, name, phone), service:services(id, name)')
      .eq('date', date)
      .order('time')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setAppointments((data as unknown as AppointmentRow[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAppointments(selectedDate);
  }, [selectedDate]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error: err } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (!err) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
    setUpdatingId(null);
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { iso: toISO(d), label: d.toLocaleDateString('es-AR', { weekday: 'short' }), day: d.getDate() };
  });

  const selectedLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <div>
            <h1 className="scrhead__title">Agenda</h1>
            <p className="scrhead__sub" style={{ textTransform: 'capitalize' }}>{selectedLabel}</p>
          </div>
          <button className="btn btn--gold btn--sm" onClick={() => setShowNew(true)}>
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
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
        )}
        {error && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && appointments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <Icon name="calendar" size={40} color="var(--faint)" />
            <p style={{ marginTop: 12, fontSize: 14 }}>No hay turnos para este día</p>
            <button className="btn btn--gold btn--sm" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}>
              <Icon name="plus" size={14} color="#fff" /> Agregar turno
            </button>
          </div>
        )}
        {!loading && !error && appointments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appointments.map(a => {
              const isUpdating = updatingId === a.id;
              const isDone = a.status === 'completado' || a.status === 'ausente' || a.status === 'cancelado';
              return (
                <div key={a.id} className="card" style={{ padding: '14px 16px', opacity: a.status === 'ausente' ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Hora */}
                    <div style={{ textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--serif)', color: 'var(--ink)', lineHeight: 1 }}>
                        {a.time.slice(0, 5)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>hs</div>
                    </div>
                    <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', flexShrink: 0 }} />

                    {/* Paciente (clickeable → detalle) */}
                    <div
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => a.patient?.id && router.push(`/panel/pacientes/${a.patient.id}`)}
                    >
                      <Avatar
                        initials={(a.patient?.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        tone="gold" size={38}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                        onClick={() => a.patient?.id && router.push(`/panel/pacientes/${a.patient.id}`)}
                      >
                        {a.patient?.name ?? 'Paciente'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.service?.name ?? '—'} · {a.duration_min} min
                      </div>
                    </div>

                    {/* Status chip or action buttons */}
                    {isDone ? (
                      <span className={`chip ${STATUS_CHIP[a.status] ?? ''}`} style={{ fontSize: 11, padding: '4px 9px', flexShrink: 0 }}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          title="Vino"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(a.id, 'completado')}
                          style={{
                            width: 34, height: 34, borderRadius: 10, border: '1.5px solid var(--emerald)',
                            background: 'var(--emerald-tint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          <Icon name="check" size={16} color="var(--emerald)" stroke={2.2} />
                        </button>
                        <button
                          title="No vino"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(a.id, 'ausente')}
                          style={{
                            width: 34, height: 34, borderRadius: 10, border: '1.5px solid var(--danger)',
                            background: 'rgba(180,83,63,.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          <Icon name="x" size={16} color="var(--danger)" stroke={2.2} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {showNew && (
      <NewAppointmentModal
        date={selectedDate}
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
