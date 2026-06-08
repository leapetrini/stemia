import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getPatients() {
  const { data, error } = await supabase.from('patients').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function getAppointmentsByDate(date: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patient:patients(*), service:services(*)')
    .eq('date', date)
    .order('time');
  if (error) throw error;
  return data;
}

export async function createAppointment(payload: {
  patient_id: string;
  professional_id: string;
  service_id: string;
  date: string;
  time: string;
  duration_min: number;
  notes?: string;
}) {
  const { data, error } = await supabase.from('appointments').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function getServices() {
  const { data, error } = await supabase.from('services').select('*').eq('active', true).order('category');
  if (error) throw error;
  return data;
}

export async function getInventory() {
  const { data, error } = await supabase.from('inventory').select('*').order('name');
  if (error) throw error;
  return data;
}
