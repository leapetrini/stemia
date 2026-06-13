'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { generateSlots, type ScheduleSettings } from '@/lib/slots';

type Patient = { id: string; name: string; phone: string | null; email: string | null };

type NewAppointment = {
  id: string;
  time: string;
  duration_min: number;
  status: string;
  notes: string | null;
  deposit_paid: boolean;
  patient: { id: string; name: string; phone: string | null } | null;
  service: { id: string; name: string } | null;
};

interface Props {
  date: string;
  defaultSlot?: string;
  onSave: (appt: NewAppointment) => void;
  onClose: () => void;
}

export function NewAppointmentModal({ date, defaultSlot, onSave, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(defaultSlot ?? null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('appointments').select('time').eq('date', date).then(({ data }) => {
      setBookedSlots((data ?? []).map((a: { time: string }) => a.time.slice(0, 5)));
    });
  }, [date]);

  useEffect(() => {
    supabase.from('schedule_settings').select('start_time, end_time, slot_minutes').limit(1).maybeSingle()
      .then(({ data }) => setSchedule((data as ScheduleSettings | null) ?? null));
  }, []);

  // Slots del horario de atención + el preseleccionado + los ya reservados,
  // para que el panel pueda agendar sin ocultar horarios existentes.
  const slots = [...new Set([
    ...generateSlots(schedule),
    ...(defaultSlot ? [defaultSlot] : []),
    ...bookedSlots,
  ])].sort();

  useEffect(() => {
    if (!query.trim() || selectedPatient) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      supabase.from('patients').select('id, name, phone, email')
        .ilike('name', `%${query.trim()}%`).limit(8)
        .then(({ data }) => { setResults(data ?? []); setSearching(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [query, selectedPatient]);

  const handleSave = async () => {
    if (!selectedPatient || !selectedSlot) return;
    setSaving(true);
    setError(null);

    const [profRes, svcRes] = await Promise.all([
      supabase.from('professionals').select('id').limit(1).single(),
      supabase.from('services').select('id').eq('active', true).limit(1).single(),
    ]);

    if (profRes.error || svcRes.error) {
      setError('Error de configuración.');
      setSaving(false);
      return;
    }

    const { data, error: err } = await supabase
      .from('appointments')
      .insert({
        patient_id: selectedPatient.id,
        professional_id: profRes.data.id,
        service_id: svcRes.data.id,
        date,
        time: selectedSlot + ':00',
        duration_min: 30,
        status: 'confirmado',
        notes: null,
        deposit_paid: false,
      })
      .select('id, time, duration_min, status, notes, deposit_paid, patient:patients(id, name, phone), service:services(id, name)')
      .single();

    if (err) { setError('No se pudo guardar el turno.'); setSaving(false); return; }
    onSave(data as unknown as NewAppointment);
  };

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div
      className="anim-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,16,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="anim-sheet" style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', borderRadius: '20px 20px 0 0', maxHeight: '92dvh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>Nuevo turno</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{dateLabel}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={20} color="var(--muted)" />
          </button>
        </div>

        <div style={{ padding: '18px 20px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Paciente */}
          <div>
            <label className="form-label">Paciente</label>
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--emerald-tint)', borderRadius: 'var(--r)', border: '1.5px solid var(--emerald)' }}>
                <Avatar initials={selectedPatient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} tone="gold" size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{selectedPatient.name}</div>
                  {selectedPatient.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedPatient.phone}</div>}
                </div>
                <button onClick={() => { setSelectedPatient(null); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Icon name="x" size={16} color="var(--muted)" />
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre…"
                  autoComplete="off"
                />
                {query.trim() && (
                  <div style={{ marginTop: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
                    {searching && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--faint)' }}>Buscando…</div>}
                    {!searching && results.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--faint)' }}>Sin resultados para "{query}"</div>}
                    {results.map(p => (
                      <div key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line)', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <Avatar initials={p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} tone="gold" size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{p.name}</div>
                          {p.phone && <div style={{ fontSize: 12, color: 'var(--faint)' }}>{p.phone}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Horarios */}
          <div>
            <label className="form-label">Horario</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {slots.map(slot => {
                const booked = bookedSlots.includes(slot);
                const active = selectedSlot === slot;
                return (
                  <button key={slot} disabled={booked} onClick={() => setSelectedSlot(active ? null : slot)}
                    style={{
                      padding: '10px 4px', borderRadius: 10,
                      border: active ? '2px solid var(--emerald)' : '1.5px solid var(--line)',
                      background: booked ? 'var(--surface-2)' : active ? 'var(--emerald-tint)' : 'var(--surface)',
                      color: booked ? 'var(--faint)' : active ? 'var(--emerald)' : 'var(--ink)',
                      fontSize: 13.5, fontWeight: active ? 700 : 500,
                      cursor: booked ? 'default' : 'pointer',
                      textDecoration: booked ? 'line-through' : 'none',
                      fontFamily: 'var(--sans)',
                    }}>
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: 'rgba(180,83,63,.07)', borderRadius: 'var(--r)' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn--gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}
              disabled={!selectedPatient || !selectedSlot || saving}>
              {saving ? 'Guardando…' : 'Confirmar turno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
