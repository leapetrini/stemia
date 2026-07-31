-- Servicios por profesional + credenciales de Mercado Pago de la doctora
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
-- Es idempotente: se puede correr más de una vez sin romper nada.

-- ─────────────────────────────────────────────────────────────
-- 1) Vincular cada profesional con su usuario del panel
-- ─────────────────────────────────────────────────────────────
alter table professionals add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists professionals_user_idx on professionals (user_id) where user_id is not null;

-- Si hay exactamente un profesional y un usuario, se vinculan solos.
do $$
declare v_user uuid; v_prof uuid;
begin
  if (select count(*) from professionals where user_id is null) = 1
     and (select count(*) from auth.users) = 1 then
    select id into v_user from auth.users limit 1;
    select id into v_prof from professionals where user_id is null limit 1;
    update professionals set user_id = v_user where id = v_prof;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2) Servicios por profesional
-- ─────────────────────────────────────────────────────────────
alter table services add column if not exists professional_id uuid references professionals(id) on delete cascade;

-- Backfill: si hay un solo profesional, todos los servicios existentes son suyos.
update services
   set professional_id = (select id from professionals limit 1)
 where professional_id is null
   and (select count(*) from professionals) = 1;

create index if not exists services_professional_idx on services (professional_id);

-- RLS: la reserva pública (anon) solo ve los servicios activos; el panel
-- (sesión autenticada) gestiona los suyos.
alter table services enable row level security;

drop policy if exists "servicios lectura publica" on services;
create policy "servicios lectura publica" on services
  for select to anon using (active is true);

drop policy if exists "servicios lectura panel" on services;
create policy "servicios lectura panel" on services
  for select to authenticated using (true);

drop policy if exists "servicios gestion panel" on services;
create policy "servicios gestion panel" on services
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- 3) Credenciales de Mercado Pago por profesional
-- ─────────────────────────────────────────────────────────────
-- Los tokens se guardan cifrados (AES-256-GCM, ver lib/crypto.ts) y NUNCA
-- salen del servidor: el panel los lee/escribe por /api/panel/mercadopago
-- con el service role. Por eso esta tabla tiene RLS activo y CERO políticas:
-- ni anon ni authenticated pueden tocarla desde el navegador.
create table if not exists payment_settings (
  professional_id  uuid primary key references professionals(id) on delete cascade,
  mp_access_token  text,
  mp_public_key    text,
  mp_webhook_secret text,
  mp_user_id       text,
  mp_account       text,
  mp_mode          text check (mp_mode in ('test', 'prod')),
  connected_at     timestamptz,
  updated_at       timestamptz not null default now()
);

alter table payment_settings enable row level security;

drop policy if exists "pagos config lectura panel" on payment_settings;
drop policy if exists "pagos config gestion panel" on payment_settings;
