'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { NewAppointmentModal } from '@/components/panel/NewAppointmentModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const ALL_SLOTS = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30',
];

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
  const [showNew, setShowNew] = useState(false);
  const [newDefaultSlot, setNewDefaultSlot] = useState<string | undefined>(undefined);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ appt: AppointmentRow; status: 'completado' | 'ausente' } | null>(null);

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    if (newStatus === 'ausente') {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (!error) setAppointments(prev => prev.filter(a => a.id !== id));
    } else {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
      if (!error) setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
    setUpdatingId(null);
    setConfirmAction(null);
  };

  const openNew = (slot?: string) => {
    setNewDefaultSlot(slot);
    setShowNew(true);
  };

  const days = useMemo(() => {
    const result: { iso: string; label: string; day: number }[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (result.length < 14) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        result.push({
          iso: toISO(cursor),
          label: cursor.toLocaleDateString('es-AR', { weekday: 'short' }),
          day: cursor.getDate(),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, []);

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
          <button className="btn btn--gold btn--sm" onClick={() => openNew()}>
            <Icon name="plus" size={15} color="#fff" /> Nuevo
          </button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          <button
            style={{ padding: '7px 16px', borderRadius: 99, border: 'none',
              background: 'var(--emerald)', color: '#fff',
              fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Turnos
          </button>
          <button onClick={() => router.push('/panel/agenda/configuracion')}
            style={{ padding: '7px 16px', borderRadius: 99, border: '1.5px solid var(--line)',
              background: 'transparent', color: 'var(--muted)',
              fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13 }}>
            Configuración
          </button>
        </div>

        {/* Date strip — 14 working days, no sticky hover */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {days.map(d => {
            const active = d.iso === selectedDate;
            return (
              <button key={d.iso} onClick={() => setSelectedDate(d.iso)}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, padding: '8px 11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--emerald)' : 'transparent',
                  color: active ? '#fff' : 'var(--muted)',
                  fontFamily: 'var(--sans)', transition: 'background .15s, color .15s',
                  outline: 'none',
                }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{d.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{d.day}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 32 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {ALL_SLOTS.map(s => (
              <div key={s} style={{ display: 'flex', gap: 14, alignItems: 'center', minHeight: 52 }}>
                <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--faint)' }}>{s}</span>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', flexShrink: 0 }} />
                <div style={{ flex: 1, height: 14, background: 'var(--surface-2)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {ALL_SLOTS.map(slot => {
              const appt = appointments.find(a => a.time.slice(0, 5) === slot);
              const isUpdating = appt && updatingId === appt.id;
              const isDone = appt && (appt.status === 'completado' || appt.status === 'ausente' || appt.status === 'cancelado');

              return (
                <div key={slot} style={{ display: 'flex', gap: 14, alignItems: 'stretch', minHeight: 52 }}>
                  {/* Hora */}
                  <div style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingTop: 15, paddingBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: appt ? 'var(--ink)' : 'var(--faint)', fontFamily: 'var(--sans)' }}>
                      {slot}
                    </span>
                  </div>

                  {/* Línea vertical */}
                  <div style={{ width: 1, background: appt ? 'var(--emerald)' : 'var(--line)', flexShrink: 0, borderRadius: 1 }} />

                  {/* Contenido */}
                  <div style={{ flex: 1, padding: '6px 0' }}>
                    {appt ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 12,
                        background: appt.status === 'ausente' ? 'rgba(180,83,63,.05)' : 'var(--surface)',
                        border: `1px solid ${appt.status === 'completado' ? 'rgba(154,124,58,.25)' : appt.status === 'ausente' ? 'rgba(180,83,63,.2)' : 'var(--line)'}`,
                        boxShadow: 'var(--sh)',
                        opacity: appt.status === 'ausente' ? 0.75 : 1,
                      }}>
                        <div
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => appt.patient?.id && router.push(`/panel/pacientes/${appt.patient.id}`)}
                        >
                          <Avatar
                            initials={(appt.patient?.name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            tone="gold" size={36}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                            onClick={() => appt.patient?.id && router.push(`/panel/pacientes/${appt.patient.id}`)}
                          >
                            {appt.patient?.name ?? 'Paciente'}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {appt.service?.name ?? '—'} · {appt.duration_min} min
                          </div>
                        </div>

                        {isDone ? (
                          <span className={`chip ${STATUS_CHIP[appt.status] ?? ''}`} style={{ fontSize: 11, padding: '4px 9px', flexShrink: 0 }}>
                            {STATUS_LABEL[appt.status] ?? appt.status}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              title="Vino"
                              disabled={!!isUpdating}
                              onClick={() => setConfirmAction({ appt, status: 'completado' })}
                              style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid var(--emerald)', background: 'var(--emerald-tint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="check" size={15} color="var(--emerald)" stroke={2.2} />
                            </button>
                            <button
                              title="No vino"
                              disabled={!!isUpdating}
                              onClick={() => setConfirmAction({ appt, status: 'ausente' })}
                              style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid var(--danger)', background: 'rgba(180,83,63,.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="x" size={15} color="var(--danger)" stroke={2.2} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button className="slot-free" onClick={() => openNew(slot)}>
                        <Icon name="plus" size={13} color="currentColor" /> Disponible
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
          message={`El turno de ${confirmAction.appt.patient?.name ?? 'la paciente'} de las ${confirmAction.appt.time.slice(0, 5)} hs se eliminará de la agenda. Esta acción no se puede deshacer.`}
          confirmLabel="Sí, eliminar"
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
