-- Horario de atención configurable + bloqueo de horarios puntuales
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)

-- 1) Horario de atención (una fila por profesional).
--    Define la ventana de trabajo que se aplica a TODOS los días abiertos.
--    De estos valores se generan los turnos disponibles en la reserva.
create table if not exists schedule_settings (
  professional_id uuid primary key references professionals(id) on delete cascade,
  start_time   time not null default '10:00',
  end_time     time not null default '17:00',
  slot_minutes int  not null default 30 check (slot_minutes in (15, 20, 30, 45, 60)),
  updated_at   timestamptz not null default now()
);

-- 2) Horarios bloqueados puntuales (por día).
--    Sirve para deshabilitar un horario específico de un día abierto sin
--    cerrar el día entero (ej. un almuerzo, un compromiso personal).
create table if not exists blocked_slots (
  professional_id uuid not null references professionals(id) on delete cascade,
  date date not null,
  time time not null,
  primary key (professional_id, date, time)
);

create index if not exists blocked_slots_date_idx on blocked_slots (date);

-- RLS: la reserva pública (cliente anónimo) necesita LEER para armar los
-- horarios; solo el panel (sesión autenticada) puede modificar.
alter table schedule_settings enable row level security;
alter table blocked_slots     enable row level security;

drop policy if exists "horario lectura publica" on schedule_settings;
create policy "horario lectura publica" on schedule_settings
  for select to anon, authenticated using (true);

drop policy if exists "horario gestion panel" on schedule_settings;
create policy "horario gestion panel" on schedule_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "bloqueos lectura publica" on blocked_slots;
create policy "bloqueos lectura publica" on blocked_slots
  for select to anon, authenticated using (true);

drop policy if exists "bloqueos gestion panel" on blocked_slots;
create policy "bloqueos gestion panel" on blocked_slots
  for all to authenticated using (true) with check (true);

-- 3) Fila por defecto para el/los profesional(es) existentes, para que la
--    reserva tenga horarios desde el minuto cero (10:00–17:00, turnos de 30').
insert into schedule_settings (professional_id)
select id from professionals
on conflict (professional_id) do nothing;
