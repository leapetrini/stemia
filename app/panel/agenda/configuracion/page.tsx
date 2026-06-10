'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';

const FULL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_ABBR = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

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
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingHalf, setTogglingHalf] = useState<string | null>(null);
  const [togglingDay, setTogglingDay] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('professionals').select('id').limit(1).single(),
      supabase.from('available_dates').select('date'),
    ]).then(([profRes, availRes]) => {
      if (profRes.data) setProfessionalId(profRes.data.id);
      setOpenDates(new Set((availRes.data ?? []).map((r: { date: string }) => r.date)));
      setLoading(false);
    });
  }, []);

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const total = today.getMonth() + i;
      result.push({ year: today.getFullYear() + Math.floor(total / 12), month: total % 12 });
    }
    return result;
  }, []);

  const toggleHalf = useCallback(async (year: number, month: number, half: 1 | 2) => {
    if (!professionalId) return;
    const key = `${year}-${month}-${half}`;
    if (togglingHalf === key) return;
    setTogglingHalf(key);
    const weekdays = getWeekdaysInHalf(year, month, half);
    const openCount = weekdays.filter(d => openDates.has(d)).length;
    const isFullyOpen = openCount === weekdays.length && weekdays.length > 0;
    if (isFullyOpen) {
      await supabase.from('available_dates').delete()
        .eq('professional_id', professionalId).in('date', weekdays);
      setOpenDates(prev => { const n = new Set(prev); weekdays.forEach(d => n.delete(d)); return n; });
    } else {
      const toAdd = weekdays.filter(d => !openDates.has(d));
      if (toAdd.length > 0) {
        await supabase.from('available_dates').upsert(toAdd.map(date => ({ professional_id: professionalId, date })));
        setOpenDates(prev => new Set([...prev, ...toAdd]));
      }
    }
    setTogglingHalf(null);
  }, [openDates, professionalId, togglingHalf]);

  const toggleDay = useCallback(async (dateISO: string) => {
    if (!professionalId || togglingDay || dateISO < todayISO) return;
    const [y, m, d] = dateISO.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) return;
    setTogglingDay(dateISO);
    if (openDates.has(dateISO)) {
      await supabase.from('available_dates').delete()
        .eq('professional_id', professionalId).eq('date', dateISO);
      setOpenDates(prev => { const n = new Set(prev); n.delete(dateISO); return n; });
    } else {
      await supabase.from('available_dates').upsert({ professional_id: professionalId, date: dateISO });
      setOpenDates(prev => new Set([...prev, dateISO]));
    }
    setTogglingDay(null);
  }, [openDates, professionalId, togglingDay, todayISO]);

  // Compact calendar data
  const firstDayOfCal = new Date(calYear, calMonth, 1).getDay();
  const daysInCal = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDayOfCal).fill(null),
    ...Array.from({ length: daysInCal }, (_, i) => i + 1),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);

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
          {/* ── Habilitar por períodos ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontFamily: 'var(--serif)', fontWeight: 600, color: 'var(--ink)' }}>
                Habilitar por períodos
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                Por defecto la agenda está cerrada. Activá las quincenas que querés abrir.
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
                Tocá un día para abrirlo o cerrarlo individualmente.
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--line)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                  className="iconbtn" style={{ width: 30, height: 30, flexShrink: 0 }}>
                  <Icon name="chevL" size={14} />
                </button>
                <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                  {FULL_MONTHS[calMonth]} {calYear}
                </div>
                <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
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
                  const isToggling = togglingDay === dateISO;
                  const canClick = !isWeekend && !isPast;

                  return (
                    <button key={day}
                      onClick={() => canClick && toggleDay(dateISO)}
                      style={{
                        aspectRatio: '1', borderRadius: '50%', border: 'none',
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
                        opacity: isToggling ? 0.4 : (isWeekend || isPast) ? 0.3 : 1,
                        transition: 'background .15s, color .15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        outline: 'none',
                        fontFamily: 'var(--sans)',
                      }}>
                      {day}
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
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>

    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
    </>
  );
}
