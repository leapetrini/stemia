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
}

export interface Professional {
  id: string;
  name: string;
  title: string;
  initials: string;
  bio: string | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  professional_id: string;
  service_id: string;
  date: string;
  time: string;
  duration_min: number;
  status: 'pendiente' | 'confirmado' | 'en-sala' | 'completado' | 'cancelado';
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

export type AppointmentStatus = Appointment['status'];
