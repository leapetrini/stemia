import type { Service, Professional, Patient, Appointment, InventoryItem } from './types';

export const SERVICES: Service[] = [
  { id: 's1', name: 'Consulta online de piel', category: 'Consultas online', description: 'Evaluación dermatológica por videollamada', price: 0, duration_min: 30, active: true },
];

export const PROFESSIONALS: Professional[] = [
  { id: 'p1', name: 'Dra. Valentina Calvo', title: 'Médica', initials: 'VC', bio: null },
];

export const MOCK_PATIENTS: Patient[] = [
  { id: '1', name: 'Valentina Ríos', age: 38, phone: '+54 9 11 5567 2210', email: 'valen.rios@gmail.com', skin_type: 'Fototipo III', tags: ['Tox. botulínica', 'Skincare'], alerts: ['Alergia a lidocaína'], notes: null, created_at: '2023-01-01' },
  { id: '2', name: 'Camila Ferrer', age: 45, phone: '+54 9 11 4421 8890', email: 'cami.ferrer@gmail.com', skin_type: 'Fototipo II', tags: ['Relleno labial', 'Bioestimulador'], alerts: [], notes: null, created_at: '2022-01-01' },
  { id: '3', name: 'Lucía Mendoza', age: 31, phone: '+54 9 11 6678 1145', email: 'lucia.m@gmail.com', skin_type: 'Fototipo IV', tags: ['Peeling', 'Hidratación'], alerts: [], notes: null, created_at: '2024-01-01' },
  { id: '4', name: 'Martina Vega', age: 52, phone: '+54 9 11 3390 6677', email: 'martina.vega@gmail.com', skin_type: 'Fototipo III', tags: ['Hilos tensores', 'Tox. botulínica'], alerts: ['Hipertensión'], notes: null, created_at: '2021-01-01' },
  { id: '5', name: 'Sofía Aguirre', age: 29, phone: '+54 9 11 2245 9981', email: 'sofi.aguirre@gmail.com', skin_type: 'Fototipo II', tags: ['Microneedling'], alerts: [], notes: null, created_at: '2024-01-01' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 't1', patient_id: '1', professional_id: 'p1', service_id: 's1', date: '2026-06-08', time: '09:30', duration_min: 45, status: 'confirmado', notes: null, deposit_paid: true, created_at: '2026-06-01' },
  { id: 't2', patient_id: '2', professional_id: 'p1', service_id: 's3', date: '2026-06-08', time: '10:15', duration_min: 30, status: 'en-sala', notes: null, deposit_paid: true, created_at: '2026-06-01' },
  { id: 't3', patient_id: '3', professional_id: 'p1', service_id: 's7', date: '2026-06-08', time: '11:30', duration_min: 60, status: 'confirmado', notes: null, deposit_paid: false, created_at: '2026-06-01' },
  { id: 't4', patient_id: '4', professional_id: 'p1', service_id: 's6', date: '2026-06-08', time: '13:00', duration_min: 90, status: 'pendiente', notes: null, deposit_paid: false, created_at: '2026-06-01' },
  { id: 't5', patient_id: '5', professional_id: 'p1', service_id: 's8', date: '2026-06-08', time: '15:30', duration_min: 45, status: 'confirmado', notes: null, deposit_paid: true, created_at: '2026-06-01' },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'i1', name: 'Toxina botulínica 100U', category: 'Inyectables', stock: 6, min_stock: 4, unit: 'viales', lot: 'BTX-2451', expiry: '11/2026' },
  { id: 'i2', name: 'Ácido hialurónico — Volumen', category: 'Inyectables', stock: 3, min_stock: 5, unit: 'jeringas', lot: 'AH-7782', expiry: '08/2026' },
  { id: 'i3', name: 'Ácido hialurónico — Labios', category: 'Inyectables', stock: 8, min_stock: 4, unit: 'jeringas', lot: 'AH-3390', expiry: '03/2027' },
  { id: 'i4', name: 'Hilos tensores PDO', category: 'Hilos', stock: 24, min_stock: 10, unit: 'unidades', lot: 'PDO-118', expiry: '05/2027' },
  { id: 'i5', name: 'Anestésico tópico EMLA', category: 'Tópicos', stock: 2, min_stock: 3, unit: 'tubos', lot: 'EM-9921', expiry: '01/2026' },
  { id: 'i6', name: 'Agujas 30G', category: 'Descartables', stock: 140, min_stock: 50, unit: 'unidades', lot: 'AG-30-22', expiry: '12/2027' },
];

export function fmtPrice(n: number): string {
  return '$ ' + n.toLocaleString('es-AR');
}
