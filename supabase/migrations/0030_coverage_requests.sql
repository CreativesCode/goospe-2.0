-- 0030_coverage_requests.sql
-- Demanda PASIVA fuera de cobertura: cada vez que alguien abre el feed con ubicación real pero
-- cae fuera de toda ciudad activa, registramos la zona (sin pedirle nada al usuario, a diferencia
-- de `waitlist` que exige email). Sirve para el panel admin: saber DESDE DÓNDE están abriendo la
-- app zonas que aún no están en el sistema, y decidir si vale la pena cargarlas.

create table if not exists public.coverage_requests (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  tz text,        -- zona horaria del navegador (Intl) → pista de región sin geocoding (ej "Atlantic/Canary")
  locale text,    -- idioma del navegador (ej "es-ES")
  created_at timestamptz not null default now()
);

alter table public.coverage_requests enable row level security;

-- Insert público anónimo (igual que waitlist); la lectura queda solo para admin.
create policy "insert coverage_requests" on public.coverage_requests
  for insert with check (true);

create policy "admin read coverage_requests" on public.coverage_requests
  for select using (public.is_admin());

create index if not exists coverage_requests_created_idx on public.coverage_requests (created_at desc);

-- Agregado por celda ~0.1° (~11 km) para el panel: zonas ordenadas por nº de aperturas.
-- SECURITY DEFINER + se llama con service_role desde el admin (mismo patrón que las RPC 0023).
create or replace function public.admin_coverage_zones(p_days int default 90, p_limit int default 100)
returns table (lat numeric, lng numeric, hits bigint, last_seen timestamptz, tz text, locale text)
language sql stable security definer set search_path = public, extensions as $$
  select
    round(lat::numeric, 1) as lat,
    round(lng::numeric, 1) as lng,
    count(*) as hits,
    max(created_at) as last_seen,
    mode() within group (order by tz) as tz,
    mode() within group (order by locale) as locale
  from public.coverage_requests
  where created_at >= now() - make_interval(days => p_days)
  group by round(lat::numeric, 1), round(lng::numeric, 1)
  order by hits desc, last_seen desc
  limit p_limit;
$$;
