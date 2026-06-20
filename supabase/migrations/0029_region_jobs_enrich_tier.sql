-- 0029_region_jobs_enrich_tier.sql
-- Fase 2 — PRP cobertura-global-cargador-zonas:
-- jobs del cargador de zonas (progreso/log en vivo) + niveles de enriquecimiento en places.

-- 1) Niveles de enriquecimiento (docs/09): anchor = completo+verificado, full = IA completa,
--    tail = básico / on-demand al primer view.
alter table public.places
  add column if not exists enrich_tier text not null default 'tail'
  check (enrich_tier in ('anchor', 'full', 'tail'));

-- Backfill: lo ya enriquecido (Puerto Varas) cuenta como 'full'.
update public.places set enrich_tier = 'full' where ai_enriched_at is not null;

-- 2) region_jobs: un job por carga de zona, con progreso/etapa/log para la vista admin en vivo.
create table if not exists public.region_jobs (
  id uuid primary key default gen_random_uuid(),
  city_id bigint references public.cities(id) on delete set null,
  country text,
  region text,
  city_name text,
  bbox jsonb,                                    -- { s, w, n, e } resuelto vía Nominatim
  status text not null default 'queued'          -- queued | running | done | error
    check (status in ('queued', 'running', 'done', 'error')),
  stage text,                                     -- osm | dedupe | insert | enrich_anchors | photos | enrich_tail
  progress numeric not null default 0,            -- 0..1
  counts jsonb not null default '{}'::jsonb,      -- { osm, inserted, enriched, photos }
  log jsonb not null default '[]'::jsonb,         -- líneas de log para el monitor en vivo
  error text,
  created_by uuid,                                -- admin que lo lanzó (auth.users.id)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.region_jobs enable row level security;

-- Solo admins leen/escriben desde el cliente; el runner local usa service_role (bypassa RLS).
create policy "admin read region_jobs"  on public.region_jobs for select using (public.is_admin());
create policy "admin write region_jobs" on public.region_jobs for all
  using (public.is_admin()) with check (public.is_admin());

-- Realtime: el monitor admin se suscribe a updates del job. replica identity full → payload completo.
alter table public.region_jobs replica identity full;
alter publication supabase_realtime add table public.region_jobs;
