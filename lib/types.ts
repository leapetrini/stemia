export interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  skin_type: string | null;
  alerts: string[];
  tags: string[];
  notes: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration_min: number;
  deposit_amount: number;
  active: boolean;
  // Profesional que realiza el servicio. Null = servicio viejo sin asignar.
  professional_id: string | null;
}

export interface Professional {
  id: string;
  name: string;
  title: string;
  initials: string;
  bio: string | null;
}

// 'ausente' = la paciente no vino. El turno NO se borra: queda registrado en la
// historia clínica (y con él, el registro del pago de la seña si la hubo).
export type AppointmentStatus =
  | 'pendiente' | 'confirmado' | 'en-sala' | 'completado' | 'ausente' | 'cancelado';

// Estados que ocupan el horario. Un turno cancelado o ausente lo libera: si no,
// el horario quedaría bloqueado para siempre y nadie podría volver a reservarlo.
export const BLOCKING_STATUSES: AppointmentStatus[] =
  ['pendiente', 'confirmado', 'en-sala', 'completado'];

export function blocksSlot(status: string): boolean {
  return (BLOCKING_STATUSES as string[]).includes(status);
}

export interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  service_id: string;
  date: string;
  time: string;
  duration_min: number;
  status: AppointmentStatus;
  notes: string | null;
  deposit_paid: boolean;
  created_at: string;
  patient?: Patient;
  service?: Service;
  professional?: Professional;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  lot: string | null;
  expiry: string | null;
}

