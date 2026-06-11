-- Fase 1: Mercado Pago
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)

-- Seña por servicio. 0 = servicio sin cargo, no pasa por Mercado Pago.
alter table services add column if not exists deposit_amount numeric(10,2) not null default 0;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  mp_preference_id text,
  mp_payment_id text,
  amount numeric(10,2) not null,
  type text not null default 'seña' check (type in ('seña','total')),
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado','reembolsado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_appointment_idx on payments (appointment_id);
create unique index if not exists payments_mp_payment_idx on payments (mp_payment_id) where mp_payment_id is not null;

-- Solo el panel (usuarios autenticados) puede leer; escribe únicamente el
-- service role desde la API (bypasea RLS), nunca el navegador.
alter table payments enable row level security;

drop policy if exists "panel lee pagos" on payments;
create policy "panel lee pagos" on payments
  for select to authenticated using (true);
