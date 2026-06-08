-- ============================================================
-- STEMIA — Schema de base de datos (Supabase / PostgreSQL)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ── Profesionales ─────────────────────────────────────────────
create table professionals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  title text,
  initials text not null,
  bio text,
  email text unique,
  created_at timestamptz default now()
);

insert into professionals (name, title, initials, email)
values ('Dra. Sofía Herrera', 'Médica especialista en medicina estética', 'SH', 'sofia@stemia.com.ar');

-- ── Servicios ─────────────────────────────────────────────────
create table services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  description text,
  price integer not null,
  duration_min integer not null default 30,
  active boolean default true,
  created_at timestamptz default now()
);

insert into services (name, category, description, price, duration_min) values
  ('Toxina botulínica · tercio superior', 'Toxina botulínica', 'Frente, entrecejo y patas de gallo', 85000, 30),
  ('Toxina botulínica · completo', 'Toxina botulínica', 'Tercio superior, cuello y mentón', 120000, 45),
  ('Relleno labial con ácido hialurónico', 'Rellenos', 'Volumen y definición labial', 180000, 60),
  ('Rellenos faciales', 'Rellenos', 'Surcos nasogenianos, pómulos y mentón', 210000, 60),
  ('Bioestimulador de colágeno', 'Bioestimuladores', 'Sculptra / Radiesse · firmeza profunda', 350000, 60),
  ('Hilos tensores PDO', 'Hilos', 'Lifting no quirúrgico, resultado natural', 280000, 90),
  ('Peeling químico medio', 'Peelings', 'Renovación celular y luminosidad', 55000, 45),
  ('Microneedling con PRP', 'Peelings', 'Rejuvenecimiento con plasma propio', 95000, 60),
  ('Consulta de valoración', 'Consultas', 'Primera consulta y plan de tratamiento', 20000, 30);

-- ── Pacientes ─────────────────────────────────────────────────
create table patients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  age integer,
  skin_type text,
  alerts text[] default '{}',
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

-- ── Turnos ────────────────────────────────────────────────────
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete set null,
  professional_id uuid references professionals(id),
  service_id uuid references services(id),
  date date not null,
  time time not null,
  duration_min integer not null default 30,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'en-sala', 'completado', 'cancelado')),
  notes text,
  deposit_paid boolean default false,
  deposit_amount integer,
  created_at timestamptz default now()
);

create index on appointments(date);
create index on appointments(patient_id);

-- ── Inventario ────────────────────────────────────────────────
create table inventory (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  stock integer not null default 0,
  min_stock integer not null default 0,
  unit text not null default 'unidades',
  lot text,
  expiry text,
  updated_at timestamptz default now()
);

insert into inventory (name, category, stock, min_stock, unit, lot, expiry) values
  ('Toxina botulínica 100U', 'Inyectables', 6, 4, 'viales', 'BTX-2451', '11/2026'),
  ('Ácido hialurónico — Volumen', 'Inyectables', 3, 5, 'jeringas', 'AH-7782', '08/2026'),
  ('Ácido hialurónico — Labios', 'Inyectables', 8, 4, 'jeringas', 'AH-3390', '03/2027'),
  ('Hilos tensores PDO', 'Hilos', 24, 10, 'unidades', 'PDO-118', '05/2027'),
  ('Anestésico tópico EMLA', 'Tópicos', 2, 3, 'tubos', 'EM-9921', '01/2026'),
  ('Agujas 30G', 'Descartables', 140, 50, 'unidades', 'AG-30-22', '12/2027');

-- ── Historial médico ──────────────────────────────────────────
create table medical_history (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  date date not null,
  treatment text not null,
  area text,
  product text,
  quantity text,
  notes text,
  professional_id uuid references professionals(id),
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table professionals enable row level security;
alter table services enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table inventory enable row level security;
alter table medical_history enable row level security;

-- Servicios: lectura pública (para el flujo de reserva)
create policy "Servicios públicos" on services for select using (active = true);

-- Profesionales: lectura pública
create policy "Profesionales públicos" on professionals for select using (true);

-- El resto requiere auth (ajustar según roles)
create policy "Pacientes solo autenticados" on patients for all using (auth.role() = 'authenticated');
create policy "Turnos solo autenticados" on appointments for all using (auth.role() = 'authenticated');
create policy "Inventario solo autenticados" on inventory for all using (auth.role() = 'authenticated');
create policy "Historia solo autenticados" on medical_history for all using (auth.role() = 'authenticated');
