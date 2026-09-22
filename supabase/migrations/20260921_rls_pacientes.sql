-- ⚠️ ARREGLO DE SEGURIDAD — LEER ENTERO ANTES DE EJECUTAR
--
-- Problema verificado el 21 sep 2026 contra la base de PRODUCCIÓN, usando la
-- anon key (la que viaja dentro del JavaScript público de stemia.com.ar):
--
--   GET    /rest/v1/patients?select=*        → devolvió filas (10 columnas)
--   GET    /rest/v1/clinical_notes?select=*  → devolvió filas (7 columnas)
--   GET    /rest/v1/appointments?select=*    → devolvió filas (12 columnas)
--   GET    /rest/v1/inventory?select=*       → devolvió filas (9 columnas)
--   DELETE /rest/v1/patients?id=eq.<uuid>    → HTTP 204 (permitido)
--   DELETE /rest/v1/clinical_notes?...       → HTTP 204 (permitido)
--   DELETE /rest/v1/appointments?...         → HTTP 204 (permitido)
--
-- Es decir: cualquiera puede leer los datos de las pacientes y las evoluciones
-- clínicas, y además borrarlos. La migración 20260805_rls_lockdown.sql apuntaba
-- a esto pero nunca se ejecutó, y además no cubría `patients` ni `inventory`.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ NO ALCANZA CON CERRAR `appointments`
-- ─────────────────────────────────────────────────────────────
-- La reserva pública necesita saber qué horarios están tomados, y hoy lo
-- resuelve leyendo `appointments`. RLS trabaja por FILA, no por columna: si se
-- le da lectura a anon, se le dan las 12 columnas, incluido `patient_id` y las
-- notas. Por eso acá se crea una VISTA que expone únicamente fecha y hora, y
-- la reserva pasa a leer esa vista.
--
-- ─────────────────────────────────────────────────────────────
-- ORDEN DE EJECUCIÓN — IMPORTANTE
-- ─────────────────────────────────────────────────────────────
--   1. Ejecutar el BLOQUE A. No rompe nada: solo agrega la vista y las
--      políticas. RLS sigue apagado, así que todo sigue funcionando igual.
--   2. Desplegar el código que lee `slots_ocupados` en vez de `appointments`
--      (components/booking/BookingFlow.tsx). Verificar que la reserva online
--      muestre horarios.
--   3. Recién entonces ejecutar el BLOQUE B, que enciende RLS y cierra la
--      lectura pública de `appointments`.
--
-- Al revés quedaría un rato con la reserva rota.


-- ═════════════════════════════════════════════════════════════
-- BLOQUE A — vista y políticas (seguro, no rompe nada)
-- ═════════════════════════════════════════════════════════════

-- Solo fecha y hora de los turnos que efectivamente ocupan el horario. Un
-- turno cancelado o ausente lo libera, así que no aparece acá.
-- security_invoker = false: la vista corre con los permisos de su dueño, así
-- que puede leer `appointments` aunque anon ya no pueda.
create or replace view public.slots_ocupados
with (security_invoker = false) as
  select date, time
    from public.appointments
   where status in ('pendiente', 'confirmado', 'en-sala', 'completado');

grant select on public.slots_ocupados to anon, authenticated;

-- ── Lo que la reserva pública SÍ necesita leer ──────────────────

drop policy if exists "servicios lectura publica" on public.services;
create policy "servicios lectura publica" on public.services
  for select to anon, authenticated using (active = true);

drop policy if exists "servicios gestion panel" on public.services;
create policy "servicios gestion panel" on public.services
  for all to authenticated using (true) with check (true);

drop policy if exists "profesionales lectura publica" on public.professionals;
create policy "profesionales lectura publica" on public.professionals
  for select to anon, authenticated using (true);

drop policy if exists "profesionales gestion panel" on public.professionals;
create policy "profesionales gestion panel" on public.professionals
  for all to authenticated using (true) with check (true);

drop policy if exists "dias lectura publica" on public.available_dates;
create policy "dias lectura publica" on public.available_dates
  for select to anon, authenticated using (true);

drop policy if exists "dias gestion panel" on public.available_dates;
create policy "dias gestion panel" on public.available_dates
  for all to authenticated using (true) with check (true);

drop policy if exists "bloqueos lectura publica" on public.blocked_slots;
create policy "bloqueos lectura publica" on public.blocked_slots
  for select to anon, authenticated using (true);

drop policy if exists "bloqueos gestion panel" on public.blocked_slots;
create policy "bloqueos gestion panel" on public.blocked_slots
  for all to authenticated using (true) with check (true);

drop policy if exists "horario lectura publica" on public.schedule_settings;
create policy "horario lectura publica" on public.schedule_settings
  for select to anon, authenticated using (true);

drop policy if exists "horario gestion panel" on public.schedule_settings;
create policy "horario gestion panel" on public.schedule_settings
  for all to authenticated using (true) with check (true);

-- ── Lo que anon no debe tocar ni para leer ──────────────────────
-- Las reservas entran por /api/booking, que usa el service role y saltea RLS,
-- así que anon no necesita escribir en ninguna de estas.

drop policy if exists "pacientes gestion panel" on public.patients;
create policy "pacientes gestion panel" on public.patients
  for all to authenticated using (true) with check (true);

drop policy if exists "evoluciones gestion panel" on public.clinical_notes;
create policy "evoluciones gestion panel" on public.clinical_notes
  for all to authenticated using (true) with check (true);

drop policy if exists "insumos gestion panel" on public.inventory;
create policy "insumos gestion panel" on public.inventory
  for all to authenticated using (true) with check (true);

drop policy if exists "turnos gestion panel" on public.appointments;
create policy "turnos gestion panel" on public.appointments
  for all to authenticated using (true) with check (true);


-- ═════════════════════════════════════════════════════════════
-- BLOQUE B — encender RLS (ejecutar DESPUÉS de desplegar el código)
-- ═════════════════════════════════════════════════════════════

-- La política vieja le daba a anon las 12 columnas de la tabla. La reemplaza
-- la vista `slots_ocupados`.
drop policy if exists "turnos lectura publica" on public.appointments;

alter table public.patients        enable row level security;
alter table public.clinical_notes  enable row level security;
alter table public.appointments    enable row level security;
alter table public.inventory       enable row level security;
alter table public.services        enable row level security;
alter table public.professionals   enable row level security;
alter table public.available_dates enable row level security;
alter table public.blocked_slots   enable row level security;
alter table public.schedule_settings enable row level security;


-- ═════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr después del BLOQUE B
-- ═════════════════════════════════════════════════════════════
--
-- 1) Que no quede ninguna tabla con RLS apagado:
--
--    select tablename, rowsecurity
--      from pg_tables
--     where schemaname = 'public'
--     order by rowsecurity, tablename;
--
-- 2) Desde afuera, con la anon key, estas tres tienen que devolver [] :
--
--    curl "$URL/rest/v1/patients?select=*"       -H "apikey: $ANON"
--    curl "$URL/rest/v1/clinical_notes?select=*" -H "apikey: $ANON"
--    curl "$URL/rest/v1/appointments?select=*"   -H "apikey: $ANON"
--
--    y el DELETE tiene que dejar de responder 204.
--
-- 3) Y esta tiene que seguir devolviendo filas, porque la reserva la necesita:
--
--    curl "$URL/rest/v1/slots_ocupados?select=date,time" -H "apikey: $ANON"
--
-- 4) Abrir stemia.com.ar y comprobar que la reserva muestra días y horarios.
