-- Fotos clínicas por consulta + campo tratamiento en evoluciones
-- Ejecutar en el SQL Editor de Supabase

-- 1) Tabla de fotos por paciente y fecha de consulta
create table if not exists clinical_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  date date not null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists clinical_photos_patient_idx on clinical_photos (patient_id, date);

alter table clinical_photos enable row level security;

drop policy if exists "panel gestiona fotos" on clinical_photos;
create policy "panel gestiona fotos" on clinical_photos
  for all to authenticated using (true) with check (true);

-- 2) Campo opcional "tratamiento realizado" en las evoluciones
alter table clinical_notes add column if not exists treatment text;

-- 3) Bucket PRIVADO para las fotos (solo se accede con sesión del panel,
--    vía URLs firmadas con vencimiento — nunca públicas)
insert into storage.buckets (id, name, public)
values ('clinical-photos', 'clinical-photos', false)
on conflict (id) do nothing;

drop policy if exists "panel lee fotos clinicas" on storage.objects;
create policy "panel lee fotos clinicas" on storage.objects
  for select to authenticated using (bucket_id = 'clinical-photos');

drop policy if exists "panel sube fotos clinicas" on storage.objects;
create policy "panel sube fotos clinicas" on storage.objects
  for insert to authenticated with check (bucket_id = 'clinical-photos');

drop policy if exists "panel borra fotos clinicas" on storage.objects;
create policy "panel borra fotos clinicas" on storage.objects
  for delete to authenticated using (bucket_id = 'clinical-photos');
