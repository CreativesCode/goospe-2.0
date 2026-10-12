-- 0036 — Versionar las RPC que existían en la BD sin archivo en el repo (doc 15 §2.2, §4.1).
--
-- Idempotente y SIN efecto sobre la BD actual: el cuerpo es el de pg_get_functiondef leído de
-- producción el 12-oct-2026 y los permisos son los que ya dejó 0033. Su único fin es que una
-- base vacía se pueda levantar solo con `supabase/migrations`.
--
-- Revisión hecha ese día: se comparó pg_proc (schema public, sin funciones de extensiones)
-- contra los `create function` de este directorio. La única función sin archivo era
-- assign_nearest_city (admin_save_place ya quedó versionada en 0035).
--
-- Historia: se creó el 20-jun-2026 desde el panel de Supabase con el nombre de migración
-- `0030_assign_nearest_city` (ver README.md de este directorio, sección "Drift").

begin;

-- Autocorrección de solape entre ciudades al cargar una zona (etl/lib/pipeline.mjs, paso
-- posterior al import): dentro del bbox recién cargado, mueve a `p_city_id` los lugares cuyo
-- centro de ciudad MÁS CERCANO es esa ciudad. Solo jala, nunca expulsa. Los lugares movidos
-- se marcan para re-enriquecer (ai_enriched_at = null, enrich_tier = 'full').
-- Devuelve cuántos lugares movió.
-- search_path incluye `extensions`: ahí viven PostGIS y el operador <->.
create or replace function public.assign_nearest_city(
  p_city_id bigint,
  p_s double precision,
  p_w double precision,
  p_n double precision,
  p_e double precision
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare moved integer;
begin
  with cand as (
    select id, center from cities where is_active or id = p_city_id
  ),
  env as (
    select ST_MakeEnvelope(p_w, p_s, p_e, p_n, 4326)::geography as g
  ),
  upd as (
    update places p set
      city_id = p_city_id,
      ai_enriched_at = null,
      enrich_tier = 'full'
    where p.city_id is distinct from p_city_id
      and ST_Intersects(p.location, (select g from env))
      and (select c.id from cand c order by p.location <-> c.center limit 1) = p_city_id
    returning 1
  )
  select count(*) into moved from upd;
  return moved;
end $function$;

-- Convención de 0033: función definer interna → solo service_role. Hace UPDATE masivo y la
-- llama únicamente el ETL con la service key. En una base nueva nacería ejecutable por anon
-- (default ACL de Supabase), por eso el revoke va aquí y no se confía en el bloque de 0033.
revoke execute on function public.assign_nearest_city(bigint, double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.assign_nearest_city(bigint, double precision, double precision, double precision, double precision)
  to service_role;

commit;


-- =====================================================================================
-- VERIFICACIÓN (solo lectura; correr tras aplicar)
-- =====================================================================================
/*
-- 1) Permisos. Esperado: {postgres=X/postgres,service_role=X/postgres}
select proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'assign_nearest_city';

-- 2) Funciones de public sin archivo en el repo. Comparar la lista con:
--      grep -rhoiE "create (or replace )?function +(public\.)?[a-z_0-9]+" supabase/migrations
--    Esperado: ninguna de más.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
*/
