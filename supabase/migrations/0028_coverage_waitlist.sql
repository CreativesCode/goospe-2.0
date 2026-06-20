-- 0028_coverage_waitlist.sql
-- Fase 1 — PRP cobertura-global-cargador-zonas:
-- cobertura espacial por ciudad, resolución de cobertura, y waitlist de demanda fuera de cobertura.

-- 1) Cobertura espacial: radio en metros desde el centro de la ciudad.
alter table public.cities
  add column if not exists coverage_radius_m integer not null default 25000;

comment on column public.cities.coverage_radius_m is
  'Radio de cobertura en metros desde center. Un usuario dentro de este radio de una ciudad is_active está cubierto.';

-- Backfill: Puerto Varas cubre el corredor Pto Varas–Llanquihue–Frutillar (~35 km).
update public.cities set coverage_radius_m = 35000 where slug = 'puerto-varas';

-- 2) resolve_coverage(lat,lng): la ciudad ACTIVA más cercana que cubre la coord (o nada).
create or replace function public.resolve_coverage(p_lat double precision, p_lng double precision)
returns table (city_id bigint, slug text, name text, distance_m double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.id, c.slug, c.name,
         st_distance(c.center, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m
  from public.cities c
  where c.is_active
    and st_dwithin(
          c.center,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          c.coverage_radius_m
        )
  order by distance_m asc
  limit 1;
$$;

revoke execute on function public.resolve_coverage(double precision, double precision) from public;
grant execute on function public.resolve_coverage(double precision, double precision) to anon, authenticated;

-- 3) waitlist: demanda fuera de cobertura. Insert público (validado con Zod en el server action),
--    select solo admin.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  lat double precision,
  lng double precision,
  detected_label text,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "insert waitlist" on public.waitlist
  for insert with check (true);

create policy "admin read waitlist" on public.waitlist
  for select using (public.is_admin());
