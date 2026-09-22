'use client';

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Check, ChevronRight, Clock, LoaderCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateSlots, type ScheduleSettings } from '@/lib/slots';
import type { Professional, Service } from '@/lib/types';

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CABECERA_SEMANA = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

interface Day {
  date: Date;
  dateISO: string;
  day: number;
  dayName: string;
  month: string;
}

interface MesCalendario {
  label: string;
  celdas: (Day | null)[];
}

function genDays(n: number): Day[] {
  const days: Day[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    days.push({
      date: new Date(cursor),
      dateISO: `${y}-${m}-${d}`,
      day: cursor.getDate(),
      dayName: DAY_NAMES[cursor.getDay()],
      month: MONTH_NAMES[cursor.getMonth()],
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function fmtPrice(n: number) {
  return '$ ' + n.toLocaleString('es-AR');
}

// Resorte en vez de curva fija: entre cajas de tamaños distintos una bezier
// fuerte arranca y frena de golpe, y se lee tosco.
const MORFEO = {
  layout: { type: 'spring' as const, duration: 0.5, bounce: 0.12 },
  opacity: { duration: 0.22 },
};
const SUAVE = { duration: 0.28, ease: [0.23, 1, 0.32, 1] as const };
// El calendario se pliega como un acordeón en vez de morfear: morfear entre
// una tarjeta alta y una fila de una línea deforma todo el contenido.
const PLEGADO = {
  height: { duration: 0.34, ease: [0.23, 1, 0.32, 1] as const },
  opacity: { duration: 0.16 },
};

const TITULOS: Record<number, string> = {
  1: 'Elegí el tratamiento',
  2: 'Elegí profesional',
  3: 'Elegí fecha y hora',
  4: 'Confirmá tus datos',
};

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
  const [day, setDay] = useState<Day | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [calendarioAbierto, setCalendarioAbierto] = useState(true);

  // ── Disponibilidad ────────────────────────────────────────────
  // Todo este bloque es el de siempre: sale de Supabase y manda sobre qué
  // días y horarios se pueden elegir.
  const allDays = useMemo(() => genDays(126), []); // 18 semanas justas
  const [bookedByDay, setBookedByDay] = useState<Record<string, string[]>>({});
  const [blockedByDay, setBlockedByDay] = useState<Record<string, string[]>>({});
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(null);
  const [availSet, setAvailSet] = useState<Set<string> | null>(null);

  const baseSlots = useMemo(() => generateSlots(schedule), [schedule]);

  const todayISO = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);
  const nowHHMM = useMemo(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name, category, description, price, duration_min, deposit_amount, active, professional_id')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setServices((data as Service[]) ?? []));

    supabase
      .from('professionals')
      .select('id, name, title, initials, bio')
      .order('name')
      .then(({ data }) => setProfessionals((data as Professional[]) ?? []));
  }, []);

  useEffect(() => {
    const startISO = allDays[0]?.dateISO;
    const endISO = allDays[allDays.length - 1]?.dateISO;
    if (!startISO || !endISO) return;

    Promise.all([
      // Vista que expone SOLO fecha y hora de los turnos que ocupan horario.
      // No se lee la tabla directo: RLS filtra por fila, no por columna,
      // así que darle lectura a anon le daría también paciente y notas.
      supabase.from('slots_ocupados').select('date, time')
        .gte('date', startISO).lte('date', endISO),
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

      const withRoom = allDays.filter((d) => {
        if (d.dateISO < todayISO) return false;
        if (!openDays.has(d.dateISO)) return false;
        const dayBooked = byDay[d.dateISO] ?? [];
        const dayBlocked = blocked[d.dateISO] ?? [];
        return daySlots.some((t) => {
          if (dayBooked.includes(t) || dayBlocked.includes(t)) return false;
          if (d.dateISO === todayISO && t <= nowHHMM) return false;
          return true;
        });
      });

      setAvailSet(new Set(withRoom.map((d) => d.dateISO)));
    });
  }, [allDays, todayISO, nowHHMM]);

  // El calendario llega hasta la semana del último día con lugar. Más allá
  // sería todo tachado.
  const meses = useMemo<MesCalendario[]>(() => {
    if (!availSet || availSet.size === 0) return [];
    let last = 0;
    allDays.forEach((d, i) => { if (availSet.has(d.dateISO)) last = i; });
    const hasta = allDays.slice(0, Math.min(allDays.length, last + 1));
    // Completar hasta el sábado de la última semana, para que la grilla cierre.
    const ultimo = hasta[hasta.length - 1];
    const extra = ultimo ? 6 - ultimo.date.getDay() : 0;
    const celdas = allDays.slice(0, hasta.length + extra);

    const out: MesCalendario[] = [];
    for (const d of celdas) {
      const label = `${d.month} ${d.date.getFullYear()}`;
      let mes = out.find((m) => m.label === label);
      if (!mes) {
        mes = { label, celdas: Array.from({ length: d.date.getDay() }, () => null) };
        out.push(mes);
      }
      mes.celdas.push(d);
    }
    return out;
  }, [allDays, availSet]);

  const slots = day
    ? baseSlots.filter((t) => {
        const dayBooked = bookedByDay[day.dateISO] ?? [];
        const dayBlocked = blockedByDay[day.dateISO] ?? [];
        if (dayBooked.includes(t) || dayBlocked.includes(t)) return false;
        if (day.dateISO === todayISO && t <= nowHHMM) return false;
        return true;
      })
    : [];

  // ── Navegación ────────────────────────────────────────────────
  // Volver no borra lo ya elegido: solo se limpia lo que dejó de tener sentido.
  const pickService = (s: Service) => {
    if (s.id !== service?.id) {
      setProfessional(null);
      setDay(null);
      setTime(null);
      setCalendarioAbierto(true);
    }
    setService(s);
    setStep(2);
  };

  const pickProfessional = (p: Professional) => {
    if (p.id !== professional?.id) {
      setDay(null);
      setTime(null);
      setCalendarioAbierto(true);
    }
    setProfessional(p);
    setStep(3);
  };

  const elegirDia = (d: Day) => {
    setDay(d);
    setTime(null);
    // Un respiro antes de plegar: si la tarjeta desaparece en el mismo frame,
    // nunca se ve el círculo lleno y la elección queda sin confirmación.
    setTimeout(() => setCalendarioAbierto(false), 260);
  };

  const volverAFecha = () => {
    setDay(null);
    setTime(null);
    setCalendarioAbierto(true);
    setStep(3);
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !professional || !day || !time) return;
    setSending(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone,
          day, time,
          service_id: service.id,
          professional_id: professional.id,
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

  // ── Pantalla final ────────────────────────────────────────────
  if (step === 5) {
    return (
      <Marco onClose={onClose}>
        <motion.div
          initial={{ opacity: 0, transform: 'translateY(16px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={SUAVE}
          className="max-w-[560px] mx-auto text-center flex flex-col items-center gap-4 pt-6 md:pt-10"
        >
          {/* Reservar un turno pasa una vez: acá vive el presupuesto de delight. */}
          <motion.div
            initial={{ opacity: 0, transform: 'scale(0.9)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.25, delay: 0.1 }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-ivory border border-champagne/50 flex items-center justify-center"
          >
            <Check className="check-draw w-7 h-7 md:w-9 md:h-9 text-espresso" />
          </motion.div>
          <h3 className="text-2xl md:text-3xl text-espresso tracking-tight">Turno solicitado</h3>
          <p className="text-[14px] md:text-[15px] text-moca leading-relaxed">
            {service?.name} con {professional?.name}, el {day?.day} de {day?.month?.toLowerCase()} a
            las {time} hs. Queda pendiente de confirmación desde la clínica.
          </p>
          <button
            onClick={onClose}
            className="pressable flex items-center bg-espresso/90 text-ivory rounded-full pl-2 pr-6 py-2 gap-3 hover:bg-espresso mt-2 border-0 cursor-pointer"
          >
            <span className="bg-ivory/20 p-1.5 rounded-full flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-ivory" />
            </span>
            <span className="text-sm">Volver al inicio</span>
          </button>
        </motion.div>
      </Marco>
    );
  }

  const cargando = services === null || professionals === null;

  return (
    <Marco onClose={onClose}>
      <div className="max-w-[860px] flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] md:text-[12px] text-moca uppercase tracking-wider">
            Paso {step} de 4
          </span>
          <span className="text-[11px] md:text-[12px] text-moca">{TITULOS[step]}</span>
        </div>

        {/* Lo ya elegido, apilándose. Tocarlo vuelve a ese paso. */}
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {service && step > 1 && (
              <Elegido
                key="svc"
                layoutId={`svc-${service.id}`}
                etiqueta="Tratamiento"
                titulo={service.name}
                detalle={`${service.duration_min} min · ${service.price === 0 ? 'Sin cargo' : fmtPrice(service.price)}`}
                onChange={() => setStep(1)}
              />
            )}
            {professional && step > 2 && (
              <Elegido
                key="prof"
                layoutId={`prof-${professional.id}`}
                etiqueta="Profesional"
                titulo={professional.name}
                detalle={professional.title}
                onChange={() => setStep(2)}
              />
            )}
            {day && !calendarioAbierto && step >= 3 && (
              <Elegido
                key="fecha"
                etiqueta="Fecha"
                titulo={`${day.dayName} ${day.day} de ${day.month.toLowerCase()}`}
                detalle=""
                onChange={volverAFecha}
              />
            )}
            {time && step >= 3 && (
              <Elegido
                key="hora"
                etiqueta="Hora"
                titulo={`${time} hs`}
                detalle={service ? `${service.duration_min} min` : ''}
                onChange={() => { setTime(null); setStep(3); }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Paso 1 · tratamiento */}
        <AnimatePresence initial={false}>
          {step === 1 && (
            <div key="lista-svc" className="flex flex-col gap-2.5">
              {cargando && <Cargando texto="Buscando tratamientos…" />}
              {services?.map((s) => (
                <motion.button
                  key={s.id}
                  layoutId={`svc-${s.id}`}
                  exit={{ opacity: 0, transform: 'scale(0.98)' }}
                  transition={MORFEO}
                  type="button"
                  onClick={() => pickService(s)}
                  className="pressable w-full text-left p-4 md:p-5 rounded-[1.2rem] md:rounded-[1.5rem] bg-ivory hover:bg-porcelain border border-champagne/50 flex items-center gap-4 cursor-pointer"
                >
                  <span className="flex-1 min-w-0 block">
                    <span className="block text-[15px] md:text-[17px] text-espresso">{s.name}</span>
                    {s.description && (
                      <span className="text-[12px] md:text-[13px] text-moca leading-relaxed mt-1 line-clamp-3">
                        {s.description}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-porcelain text-moca">
                        <Clock className="w-3 h-3" />
                        {s.duration_min} min
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-espresso/10 text-espresso">
                        {(s.price ?? 0) === 0 ? 'Sin cargo' : fmtPrice(s.price)}
                      </span>
                      {(s.price ?? 0) > 0 && (s.deposit_amount ?? 0) > 0 && (
                        <span className="text-[11px] text-moca">Seña {fmtPrice(s.deposit_amount)}</span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-taupe" />
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Paso 2 · profesional */}
        <AnimatePresence initial={false}>
          {step === 2 && (
            <div key="lista-prof" className="flex flex-col gap-2.5">
              {professionals
                ?.filter((p) => !service?.professional_id || p.id === service.professional_id)
                .map((p) => (
                  <motion.button
                    key={p.id}
                    layoutId={`prof-${p.id}`}
                    exit={{ opacity: 0, transform: 'scale(0.98)' }}
                    transition={MORFEO}
                    type="button"
                    onClick={() => pickProfessional(p)}
                    className="pressable w-full text-left p-4 md:p-5 rounded-[1.2rem] md:rounded-[1.5rem] bg-ivory hover:bg-porcelain border border-champagne/50 flex items-center gap-4 cursor-pointer"
                  >
                    <span className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full bg-espresso/10 border border-espresso/10 flex items-center justify-center text-[15px] md:text-[17px] text-espresso">
                      {p.initials}
                    </span>
                    <span className="flex-1 min-w-0 block">
                      <span className="block text-[15px] md:text-[17px] text-espresso">{p.name}</span>
                      <span className="block text-[11px] md:text-[12px] text-moca uppercase tracking-wider mt-0.5">
                        {p.title}
                      </span>
                      {p.bio && (
                        <span className="block text-[12px] md:text-[13px] text-moca leading-relaxed mt-2">
                          {p.bio}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-taupe" />
                  </motion.button>
                ))}
            </div>
          )}
        </AnimatePresence>

        {/* Paso 3a · fecha */}
        <AnimatePresence initial={false}>
          {step === 3 && calendarioAbierto && (
            <motion.div
              key="calendario"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={PLEGADO}
              className="overflow-hidden"
            >
              <div className="w-full max-w-[440px] lg:max-w-[760px] rounded-[1.5rem] md:rounded-[2rem] bg-porcelain border border-champagne/40 p-4 md:p-5 flex flex-col gap-4 mt-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] md:text-[16px] text-espresso">Fecha</span>
                  <span className="text-[12px] md:text-[13px] text-moca">
                    {availSet === null ? 'Buscando lugares…' : 'Días con lugar'}
                  </span>
                </div>

                {availSet !== null && meses.length === 0 && (
                  <p className="text-[13px] text-moca leading-relaxed py-4">
                    No hay lugares disponibles por ahora. Escribinos y te avisamos apenas se libere
                    un horario.
                  </p>
                )}

                {/* En pantalla ancha los meses van de a dos: baja el alto a la mitad. */}
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-8">
                  {meses.map((mes) => (
                    <div key={mes.label} className="flex flex-col gap-2">
                      <span className="text-[11px] md:text-[12px] text-espresso uppercase tracking-[0.14em]">
                        {mes.label}
                      </span>
                      <div className="grid grid-cols-7 gap-y-1">
                        {CABECERA_SEMANA.map((c) => (
                          <span key={c} className="text-center text-[11px] md:text-[12px] text-moca pb-1">
                            {c}
                          </span>
                        ))}
                        {mes.celdas.map((d, i) =>
                          d === null ? (
                            <span key={`hueco-${i}`} />
                          ) : (
                            <button
                              key={d.dateISO}
                              type="button"
                              disabled={!availSet?.has(d.dateISO)}
                              onClick={() => elegirDia(d)}
                              className={`pressable-soft aspect-square w-full max-w-[44px] mx-auto rounded-full flex items-center justify-center text-[15px] md:text-[16px] border-0 bg-transparent ${
                                day?.dateISO === d.dateISO
                                  ? 'bg-espresso text-ivory'
                                  : availSet?.has(d.dateISO)
                                    ? 'text-espresso hover:bg-espresso/8 cursor-pointer'
                                    : 'text-moca/40 line-through cursor-default'
                              }`}
                            >
                              {d.day}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paso 3b · hora. Elegir ya avanza. */}
        <AnimatePresence initial={false}>
          {step === 3 && day && !calendarioAbierto && (
            <motion.div
              key="horarios"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={PLEGADO}
              className="overflow-hidden"
            >
              <div className="w-full max-w-[440px] lg:max-w-[760px] rounded-[1.5rem] md:rounded-[2rem] bg-porcelain border border-champagne/40 p-4 md:p-5 flex flex-col gap-3 mt-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px] md:text-[16px] text-espresso">Hora</span>
                  <span className="text-[12px] md:text-[13px] text-moca">
                    {day.dayName} {day.day}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTime(t); setStep(4); }}
                      className="pressable-soft py-2.5 rounded-full text-[13px] md:text-[14px] border border-champagne/50 bg-ivory text-espresso hover:bg-porcelain cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paso 4 · confirmar */}
        {step === 4 && service && professional && day && time && (
          <motion.form
            initial={{ opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={SUAVE}
            className="flex flex-col gap-3 mt-1 max-w-[440px]"
            onSubmit={onConfirm}
          >
            {(service.deposit_amount ?? 0) > 0 && (
              <p className="text-[11px] md:text-[12px] text-moca leading-relaxed px-1">
                Para reservar se abona una seña de {fmtPrice(service.deposit_amount)}.
              </p>
            )}

            <input
              required
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full px-5 py-3 rounded-full bg-ivory border border-champagne/50 text-[14px] text-espresso placeholder:text-moca outline-none focus:border-espresso/30"
            />
            <input
              required
              name="email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-5 py-3 rounded-full bg-ivory border border-champagne/50 text-[14px] text-espresso placeholder:text-moca outline-none focus:border-espresso/30"
            />
            <input
              required
              name="tel"
              autoComplete="tel"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              className="w-full px-5 py-3 rounded-full bg-ivory border border-champagne/50 text-[14px] text-espresso placeholder:text-moca outline-none focus:border-espresso/30"
            />

            {bookingError && (
              <p className="text-[13px] text-terracota leading-relaxed px-1">{bookingError}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="pressable flex items-center bg-espresso/90 text-ivory rounded-full pl-2 pr-6 py-2 gap-3 hover:bg-espresso self-start min-w-[200px] border-0 cursor-pointer"
            >
              <span className="bg-ivory/20 p-1.5 rounded-full flex items-center justify-center">
                {sending ? (
                  <LoaderCircle className="spinner w-5 h-5 text-ivory" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-ivory" />
                )}
              </span>
              <span className="text-sm">{sending ? 'Confirmando…' : 'Confirmar turno'}</span>
            </button>
          </motion.form>
        )}
      </div>
    </Marco>
  );
}

// Marco de pantalla completa, con el mismo contenedor redondeado del hero.
function Marco({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 w-full h-dvh flex items-center justify-center p-3 md:p-5 bg-ivory">
      <section className="relative w-full min-w-0 max-w-[1536px] h-full rounded-[1.5rem] md:rounded-[3rem] overflow-hidden bg-porcelain flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 md:px-10 pt-8 md:pt-10 pb-3 md:pb-4 shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] md:text-[12px] text-moca uppercase tracking-wider">
              Nuevo turno
            </span>
            <h2 className="text-2xl md:text-4xl text-espresso tracking-tight leading-[1.05]">
              Reservar turno
            </h2>
          </div>
          <button
            onClick={onClose}
            title="Cerrar"
            className="pressable shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-ivory hover:bg-champagne/40 border border-champagne/50 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5 text-espresso" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-8 md:pb-10">{children}</div>
      </section>
    </div>
  );
}

function Elegido({
  layoutId, etiqueta, titulo, detalle, onChange,
}: {
  // Sin layoutId cuando no hay tarjeta de la que venir: fecha y hora se
  // pliegan en vez de morfear.
  layoutId?: string;
  etiqueta: string;
  titulo: string;
  detalle: string;
  onChange: () => void;
}) {
  return (
    <motion.button
      layoutId={layoutId}
      initial={layoutId ? undefined : { opacity: 0, transform: 'translateY(-6px)' }}
      animate={layoutId ? undefined : { opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'scale(0.98)' }}
      transition={layoutId ? MORFEO : SUAVE}
      type="button"
      onClick={onChange}
      className="pressable-soft w-full text-left px-4 py-2.5 rounded-[1.2rem] bg-espresso/5 border border-champagne/50 flex items-center gap-3 group/fila cursor-pointer"
    >
      <span className="flex-1 min-w-0 flex items-baseline gap-2.5">
        <span className="text-[10px] text-moca uppercase tracking-wider shrink-0">{etiqueta}</span>
        <span className="text-[14px] text-espresso truncate">{titulo}</span>
      </span>
      {detalle && <span className="text-[11px] text-moca shrink-0 hidden sm:block">{detalle}</span>}
      <span className="text-[11px] text-moca shrink-0 opacity-0 group-hover/fila:opacity-100 transition-opacity">
        Cambiar
      </span>
    </motion.button>
  );
}

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 justify-center text-moca">
      <LoaderCircle className="spinner w-4 h-4" />
      <span className="text-[13px]">{texto}</span>
    </div>
  );
}
