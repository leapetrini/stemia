// Generación de horarios de turno a partir del horario de atención configurable.
// Usado por la reserva del cliente y por el panel para que todos muestren los
// mismos slots. Si no hay configuración guardada se usan los valores por defecto
// (10:00 a 17:00, turnos de 30 min → último turno 16:30).

export interface ScheduleSettings {
  start_time: string;   // "HH:MM" o "HH:MM:SS"
  end_time: string;     // "HH:MM" o "HH:MM:SS"
  slot_minutes: number;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  start_time: '10:00',
  end_time: '17:00',
  slot_minutes: 30,
};

export const SLOT_MINUTES_OPTIONS = [15, 20, 30, 45, 60] as const;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Devuelve los horarios de inicio de turno disponibles dentro de la ventana.
// El último turno empieza de forma que termine antes o justo en end_time.
export function generateSlots(schedule?: Partial<ScheduleSettings> | null): string[] {
  const s = { ...DEFAULT_SCHEDULE, ...(schedule ?? {}) };
  const start = toMinutes(s.start_time);
  const end = toMinutes(s.end_time);
  const step = s.slot_minutes > 0 ? s.slot_minutes : DEFAULT_SCHEDULE.slot_minutes;
  const slots: string[] = [];
  for (let t = start; t + step <= end; t += step) {
    slots.push(toHHMM(t));
  }
  return slots;
}
