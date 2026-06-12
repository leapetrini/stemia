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
  patient: { name: string } | null;
};

type UpcomingRow = {
  id: string;
  date: string;
  time: string;
  duration_min: number;
  status: string;
  patient: { name: string } | null;
  service: { name: string } | null;
};

type InventoryRow = {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
};

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  confirmado: { label: 'Confirmado', cls: 'chip--emerald' },
  'en-sala': { label: 'En sala', cls: 'chip--gold' },
  pendiente: { label: 'Pendiente', cls: 'chip--silver' },
  completado: { label: 'Completado', cls: 'chip--emerald' },
  cancelado: { label: 'Cancelado', cls: 'chip--danger' },
};

const TONES: Array<'emerald' | 'gold' | 'silver'> = ['gold', 'silver', 'gold', 'silver', 'gold'];

function dateLabel(iso: string, today: string, tomorrow: string) {
  if (iso === today) return 'Hoy';
  if (iso === tomorrow) return 'Mañana';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [lowStock, setLowStock] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toLocalISO(new Date());
  const tomorrow = toLocalISO(new Date(Date.now() + 24 * 60 * 60 * 1000));

  useEffect(() => {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    Promise.all([
      supabase
        .from('appointments')
        .select('id, time, duration_min, status, patient:patients(name)')
        .eq('date', today)
        .order('time'),
      // próximos 5 turnos de cualquier día (futuros, no cancelados ni cerrados)
      supabase
        .from('appointments')
        .select('id, date, time, duration_min, status, patient:patients(name), service:services(name)')
        .or(`date.gt.${today},and(date.eq.${today},time.gte.${nowTime})`)
        .not('status', 'in', '("cancelado","completado","ausente")')
        .order('date')
        .order('time')
        .limit(5),
      supabase
        .from('inventory')
        .select('id, name, stock, min_stock, unit')
        .order('name'),
    ]).then(([apptRes, upcomingRes, invRes]) => {
      setAppointments((apptRes.data as unknown as AppointmentRow[]) ?? []);
      setUpcoming((upcomingRes.data as unknown as UpcomingRow[]) ?? []);
      const inv = (invRes.data as InventoryRow[]) ?? [];
      setLowStock(inv.filter(i => i.stock <= i.min_stock));
      setLoading(false);
    });
  }, [today]);

  const kpis = [
    { label: 'Turnos hoy', value: appointments.length, icon: 'calendar', color: 'var(--emerald)' },
    { label: 'En sala ahora', value: appointments.filter(a => a.status === 'en-sala').length, icon: 'users', color: 'var(--gold)' },
    { label: 'Confirmados', value: appointments.filter(a => a.status === 'confirmado').length, icon: 'checkCircle', color: 'var(--emerald)' },
    { label: 'Stock bajo', value: lowStock.length, icon: 'alert', color: lowStock.length > 0 ? 'var(--warn)' : 'var(--faint)' },
  ];

  return (
    <div className="page scr-anim" style={{ paddingBottom: 24 }}>
      <header className="scrhead">
        <div className="scrhead__row">
          <div>
            <div className="scrhead__title">Buenos días</div>
            <div className="scrhead__sub" style={{ textTransform: 'capitalize' }}>
              Hoy · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </header>

      <div className="px">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {kpis.map((k, i) => (
            <div key={i} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 600 }}>{k.label}</span>
                <Icon name={k.icon} size={16} color={k.color} />
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 600, color: loading ? 'var(--faint)' : 'var(--ink)', lineHeight: 1 }}>
                {loading ? '—' : k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Próximos turnos (de cualquier día) */}
        <div style={{ marginBottom: 20 }}>
          <div className="between" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Próximos turnos</div>
            <a href="/panel/agenda" style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 600, textDecoration: 'none' }}>Ver agenda</a>
          </div>
          {!loading && upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--faint)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)' }}>
              No hay turnos próximos agendados
            </div>
          ) : (
            <div className="card" style={{ padding: '2px 14px' }}>
              {(loading ? Array(3).fill(null) : upcoming).map((appt, i) => (
                <div key={appt?.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: i < (loading ? 2 : upcoming.length - 1) ? '1px solid var(--line)' : 'none' }}>
                  {loading ? (
                    <>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 13, width: '60%', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 6 }} />
                        <div style={{ height: 11, width: '35%', background: 'var(--surface-2)', borderRadius: 4 }} />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* fecha */}
                      <div style={{
                        width: 56, flexShrink: 0, textAlign: 'center', padding: '6px 2px', borderRadius: 10,
                        background: appt.date === today ? 'var(--emerald-tint)' : 'var(--surface-2)',
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: appt.date === today ? 'var(--emerald)' : 'var(--muted)', lineHeight: 1.3 }}>
                          {dateLabel(appt.date, today, tomorrow)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: appt.date === today ? 'var(--emerald)' : 'var(--ink)', marginTop: 1 }}>
                          {appt.time.slice(0, 5)}
                        </div>
                      </div>
                      <Avatar
                        initials={(appt.patient?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        tone={TONES[i % TONES.length]}
                        size={40}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.patient?.name ?? 'Paciente'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {appt.service?.name ?? 'Consulta'} · {appt.duration_min} min
                        </div>
                      </div>
                      <span className={`chip chip--dot ${(STATUS_STYLE[appt.status] ?? STATUS_STYLE.pendiente).cls}`} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                        {(STATUS_STYLE[appt.status] ?? STATUS_STYLE.pendiente).label}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock bajo */}
        {!loading && lowStock.length > 0 && (
          <div>
            <div className="between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Insumos con stock bajo</div>
              <a href="/panel/insumos" style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 600, textDecoration: 'none' }}>Ver todo</a>
            </div>
            <div className="card" style={{ padding: '2px 14px' }}>
              {lowStock.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < lowStock.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(180,83,63,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="alert" size={16} color="var(--danger)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.stock} {item.unit} · mín. {item.min_stock}</div>
                  </div>
                  <span className="chip chip--danger" style={{ fontSize: 11, padding: '4px 10px' }}>Stock bajo</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
