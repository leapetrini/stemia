-- Turnos ausentes: "No vino" deja de borrar el turno
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
-- Es idempotente: se puede correr más de una vez sin romper nada.
--
-- Hasta ahora, marcar un turno como "No vino" hacía DELETE sobre appointments.
-- Eso borraba el turno de la historia clínica y, por el ON DELETE CASCADE de
-- payments, tambien borraba el registro del pago: una sena cobrada quedaba sin
-- rastro. A partir de acá el turno se conserva con status = 'ausente'.

-- ─────────────────────────────────────────────────────────────
-- 1) El CHECK de status tiene que aceptar 'ausente'
-- ─────────────────────────────────────────────────────────────
-- El esquema base se creó a mano desde el dashboard, así que no sabemos con
-- qué nombre quedó el constraint. Se buscan todos los CHECK de la tabla que
-- mencionen status y se reemplazan por uno con nombre conocido.
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.appointments'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.appointments drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pendiente', 'confirmado', 'en-sala', 'completado', 'ausente', 'cancelado'));

-- ─────────────────────────────────────────────────────────────
-- 2) Índice para buscar los turnos de un día
-- ─────────────────────────────────────────────────────────────
-- La pantalla de configuración de la agenda ahora consulta los turnos activos
-- de todo el período visible para no dejar cerrar un día que ya tiene gente.
create index if not exists appointments_date_status_idx
  on public.appointments (date, status);
