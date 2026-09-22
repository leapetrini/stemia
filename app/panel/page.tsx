'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowUpRight, CalendarDays, CircleCheck, LoaderCircle, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  'en-sala': 'En sala',
  pendiente: 'Pendiente',
  completado: 'Completado',
  cancelado: 'Cancelado',
  ausente: 'No vino',
};

const STATUS_CHIP: Record<string, string> = {
  confirmado: 'bg-espresso/10 text-espresso',
  'en-sala': 'bg-champagne/40 text-moca',
  pendiente: 'bg-champagne/40 text-moca',
  completado: 'bg-espresso/10 text-espresso',
  cancelado: 'bg-terracota/10 text-terracota',
  ausente: 'bg-terracota/10 text-terracota',
};

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

function iniciales(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Dashboard() {
  const router = useRouter();
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

  // Los mismos cuatro números que antes, en el mismo orden.
  const kpis = [
    { label: 'Turnos hoy', value: appointments.length, Icon: CalendarDays, alerta: false },
    { label: 'En sala ahora', value: appointments.filter(a => a.status === 'en-sala').length, Icon: Users, alerta: false },
    { label: 'Confirmados', value: appointments.filter(a => a.status === 'confirmado').length, Icon: CircleCheck, alerta: false },
    { label: 'Stock bajo', value: lowStock.length, Icon: AlertTriangle, alerta: lowStock.length > 0 },
  ];

  const saludo = (() => {
    const h = new Date().getHours();
    return h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  })();

  return (
    <div className="h-full overflow-y-auto px-5 md:px-8 pt-4 md:pt-8 pb-8">
      <div className="flex flex-col gap-1 mb-5">
        <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">{saludo}</h1>
        <span className="text-[12px] md:text-[13px] text-moca first-letter:uppercase">
          Hoy · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-6">
        {kpis.map(({ label, value, Icon, alerta }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
            className="p-3.5 md:p-4 rounded-[1.25rem] bg-ivory border border-champagne/50 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] md:text-[12px] text-moca">{label}</span>
              <Icon className={`w-4 h-4 shrink-0 ${alerta ? 'text-terracota' : 'text-moca'}`} />
            </div>
            <span className="text-[28px] md:text-[32px] text-espresso tracking-tight leading-none">
              {loading ? '—' : value}
            </span>
          </motion.div>
        ))}
      </div>

      <Seccion titulo="Próximos turnos" accion="Ver agenda" onAccion={() => router.push('/panel/agenda')}>
        {loading ? (
          <Cargando />
        ) : upcoming.length === 0 ? (
          <Vacio texto="No hay turnos próximos agendados" />
        ) : (
          <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 px-4">
            {upcoming.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 py-3 ${i < upcoming.length - 1 ? 'border-b border-champagne/40' : ''}`}
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-espresso/10 text-espresso flex items-center justify-center text-[12px]">
                  {iniciales(a.patient?.name ?? '?')}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-espresso truncate">
                    {a.patient?.name ?? 'Paciente'}
                  </span>
                  <span className="block text-[11.5px] text-moca truncate mt-0.5">
                    {a.service?.name ?? '—'} · {dateLabel(a.date, today, tomorrow)} {a.time.slice(0, 5)}
                  </span>
                </span>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] ${STATUS_CHIP[a.status] ?? STATUS_CHIP.pendiente}`}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {!loading && lowStock.length > 0 && (
        <Seccion titulo="Stock bajo" accion="Ver todo" onAccion={() => router.push('/panel/insumos')}>
          <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 px-4">
            {lowStock.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 py-3 ${i < lowStock.length - 1 ? 'border-b border-champagne/40' : ''}`}
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-terracota/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-terracota" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] text-espresso truncate">{item.name}</span>
                  <span className="block text-[11.5px] text-moca mt-0.5">
                    Quedan {item.stock} {item.unit} · mínimo {item.min_stock}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}

function Seccion({
  titulo, accion, onAccion, children,
}: {
  titulo: string;
  accion: string;
  onAccion: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 mb-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] md:text-[15px] text-espresso">{titulo}</span>
        <button
          onClick={onAccion}
          className="pressable-soft flex items-center gap-1 text-[12px] md:text-[13px] text-moca hover:text-espresso bg-transparent border-0 cursor-pointer"
        >
          {accion}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-8 text-center text-[13px] text-moca">
      {texto}
    </div>
  );
}

function Cargando() {
  return (
    <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-8 flex items-center justify-center gap-2.5 text-moca">
      <LoaderCircle className="spinner w-4 h-4" />
      <span className="text-[13px]">Cargando…</span>
    </div>
  );
}
