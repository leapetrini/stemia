'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function AgendaConfigPage() {
  const router = useRouter();
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [bookingUntil, setBookingUntil] = useState('');
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('professionals').select('id').limit(1).single(),
      supabase.from('blocked_dates').select('date'),
      supabase.from('settings').select('value').eq('key', 'booking_until_date').maybeSingle(),
    ]).then(([profRes, blockRes, settingRes]) => {
      if (profRes.data) setProfessionalId(profRes.data.id);
      setBlockedDates(new Set((blockRes.data ?? []).map((b: { date: string }) => b.date)));
      if (settingRes.data) setBookingUntil(settingRes.data.value);
      setLoading(false);
    });
  }, []);

  const toggleDay = async (dateISO: string, isWeekend: boolean, isPast: boolean) => {
    if (isWeekend || isPast || !professionalId || toggling) return;
    setToggling(dateISO);
    if (blockedDates.has(dateISO)) {
      await supabase.from('blocked_dates').delete()
        .eq('professional_id', professionalId).eq('date', dateISO);
      setBlockedDates(prev => { const n = new Set(prev); n.delete(dateISO); return n; });
    } else {
      await supabase.from('blocked_dates').insert({ professional_id: professionalId, date: dateISO });
      setBlockedDates(prev => new Set([...prev, dateISO]));
    }
    setToggling(null);
  };

  const saveHorizon = async () => {
    if (!bookingUntil) return;
    setSaving(true);
    await supabase.from('settings').upsert({ key: 'booking_until_date', value: bookingUntil });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

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
              background: 'transparent', color: 'var(--muted)',
              fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13 }}>
            Turnos
          </button>
          <button
            style={{ padding: '7px 16px', borderRadius: 99, border: 'none',
              background: 'var(--emerald)', color: '#fff',
              fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Configuración
          </button>
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 40 }}>
        {loading ? (
          <div style={{ paddingTop: 40, textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
        ) : (
          <>
          {/* Horizon setting */}
          <div style={{ marginBottom: 20, padding: '18px 20px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>
              Habilitar turnos hasta
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
              Los pacientes solo podrán reservar hasta esta fecha.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="date" className="input" style={{ flex: 1 }}
                value={bookingUntil} min={todayISO}
                onChange={e => setBookingUntil(e.target.value)} />
              <button className="btn btn--gold btn--sm" onClick={saveHorizon}
                disabled={saving || !bookingUntil} style={{ flexShrink: 0 }}>
                {savedOk ? <><Icon name="check" size={14} color="#fff" stroke={2.5} /> Guardado</> : saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <button onClick={prevMonth} className="iconbtn" style={{ width: 32, height: 32 }}>
                <Icon name="chevL" size={16} />
              </button>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', fontFamily: 'var(--serif)' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button onClick={nextMonth} className="iconbtn" style={{ width: 32, height: 32 }}>
                <Icon name="chevR" size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--line)' }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', letterSpacing: '.04em' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px', gap: 2 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} style={{ aspectRatio: '1' }} />;
                const dateISO = toISO(viewYear, viewMonth, day);
                const dow = new Date(viewYear, viewMonth, day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isPast = dateISO < todayISO;
                const isBlocked = blockedDates.has(dateISO);
                const isToday = dateISO === todayISO;
                const isToggling = toggling === dateISO;
                const disabled = isWeekend || isPast;

                return (
                  <button key={day}
                    onClick={() => toggleDay(dateISO, isWeekend, isPast)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 10,
                      border: isBlocked
                        ? '1.5px solid rgba(180,83,63,.3)'
                        : isToday
                        ? '1.5px solid var(--emerald)'
                        : '1.5px solid transparent',
                      background: isBlocked ? 'rgba(180,83,63,.08)' : 'transparent',
                      color: isBlocked ? 'var(--danger)'
                        : disabled ? 'var(--faint)'
                        : isToday ? 'var(--emerald)'
                        : 'var(--ink)',
                      fontSize: 13.5,
                      fontWeight: isToday ? 700 : 500,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: isToggling ? 0.4 : disabled ? 0.3 : 1,
                      fontFamily: 'var(--sans)',
                      transition: 'all .1s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ padding: '10px 20px 14px', borderTop: '1px solid var(--line)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(180,83,63,.12)', border: '1px solid rgba(180,83,63,.3)' }} />
                Bloqueado
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, border: '1.5px solid var(--emerald)' }} />
                Hoy
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginLeft: 'auto' }}>
                Tocá un día para bloquearlo
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
