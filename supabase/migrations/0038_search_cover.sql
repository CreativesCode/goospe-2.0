-- 0038 — La portada del dueño tambien manda en la busqueda y en el conserje (QA fase 5).
--
-- 0037 hizo que get_feed / get_feed_events usen places.cover_url; search_places y match_places
-- seguian devolviendo solo la primera foto aprobada, asi que la card de /search ignoraba la
-- portada que el dueño subio desde su panel.
--
-- Idempotente (create or replace) y en UNA transaccion. Requiere places.cover_url (ya existe).
-- MISMA firma y MISMAS columnas: no hay drop, asi que los permisos se conservan; aun asi se
-- reafirman al final.
--
-- Unico cambio en ambas funciones:
--   photo_url = coalesce(nullif(p.cover_url, ''), <primera foto aprobada, como antes>)
--
-- Origen de cada cuerpo:
--   · search_places: copia de 0035_phase2_fixes.sql (definicion vigente en produccion).
--   · match_places:  copia de 0030_place_business_status.sql, la ULTIMA definicion que hay en
--     el repo (0033 la lista como abierta sin redefinirla; sus columnas coinciden con
--     src/lib/database.types.ts). ANTES DE APLICAR conviene compararla con
--     pg_get_functiondef('public.match_places(vector,double precision,double precision,integer,integer)'::regprocedure)
--     por el drift conocido entre repo y BD (ver README.md).
--
-- No cambia ningun contrato con el codigo: src/app/api/search/route.ts y
-- src/app/api/concierge/route.ts siguen leyendo photo_url igual.

begin;

-- =====================================================================================
-- search_places
-- =====================================================================================
create or replace function public.search_places(
  p_q text default null,
  p_category bigint default null,
  p_max_price integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 25000,
  p_limit integer default 40
)
returns table(
  id uuid, slug text, name text, vibe_line text, price_level smallint, distance_m double precision,
  hours jsonb, photo_url text, category_emoji text, category_name text, rating numeric,
  timezone text
)
language sql stable set search_path = public, extensions
as $$
  with me as (
    select case when p_lat is null or p_lng is null then null
                else ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography end as g
  ),
  q as (
    select t.v,
           '%' || replace(replace(replace(t.v, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from (select nullif(lower(extensions.unaccent(btrim(coalesce(p_q, '')))), '') as v) t
  ),
  base as (
    select p.*, lower(extensions.unaccent(p.name)) as name_n
    from public.places p
    where p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and (p_max_price is null or p.price_level <= p_max_price)
      and (p_category is null or exists (
            select 1 from public.place_categories pc
            where pc.place_id = p.id and pc.category_id = p_category))
      and ((select g from me) is null or ST_DWithin(p.location, (select g from me), p_radius_m))
  )
  select
    p.id, p.slug, p.name, p.vibe_line, p.price_level,
    case when (select g from me) is null then null
         else ST_Distance(p.location, (select g from me)) end as distance_m,
    p.hours,
    coalesce(
      nullif(p.cover_url, ''),
      (select pp.url from public.place_photos pp
         where pp.place_id = p.id and pp.status = 'approved'
         order by (pp.source = 'google') desc, pp.id limit 1)
    ) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    coalesce(st.rating, 0) as rating,
    ci.timezone
  from base p
  cross join q
  left join public.cities ci on ci.id = p.city_id
  left join public.place_stats st on st.place_id = p.id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = p.id
    order by pc.category_id
    limit 1
  ) cc on true
  where q.v is null
     or p.name_n like q.pat
     or q.v <% p.name_n
     or lower(extensions.unaccent(coalesce(p.vibe_line, ''))) like q.pat
     or exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) tg
          where lower(extensions.unaccent(tg)) like q.pat)
     or exists (
          select 1 from public.place_categories pc
          join public.categories cat on cat.id = pc.category_id
          where pc.place_id = p.id and lower(extensions.unaccent(cat.name)) like q.pat)
  order by
    (q.v is not null and left(p.name_n, length(q.v)) = q.v) desc,
    (q.v is not null and p.name_n like q.pat) desc,
    case when q.v is null then 0 else word_similarity(q.v, p.name_n) end desc,
    case when (select g from me) is null then 0
         else ST_Distance(p.location, (select g from me)) end asc,
    p.name, p.id
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer) from public;
grant  execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer)
  to anon, authenticated, service_role;


-- =====================================================================================
-- match_places
-- =====================================================================================
create or replace function public.match_places(
  p_embedding vector(1024),
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 12
)
returns table (
  id uuid, slug text, name text, vibe_line text, description text,
  tags text[], price_level smallint,
  lat double precision, lng double precision, distance_m double precision,
  category_name text, photo_url text, similarity double precision
)
language sql stable
set search_path = public, extensions
as $$
  with me as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g)
  select
    p.id, p.slug, p.name, p.vibe_line, p.description, p.tags, p.price_level,
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng,
    ST_Distance(p.location, (select g from me)) as distance_m,
    (select cat.name from public.place_categories pc
       join public.categories cat on cat.id = pc.category_id
       where pc.place_id = p.id limit 1) as category_name,
    coalesce(
      nullif(p.cover_url, ''),
      (select pp.url from public.place_photos pp
         where pp.place_id = p.id and pp.status = 'approved'
         order by (pp.source = 'google') desc, pp.id limit 1)
    ) as photo_url,
    1 - (p.embedding <=> p_embedding) as similarity
  from public.places p
  where p.is_published
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
    and p.embedding is not null
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by p.embedding <=> p_embedding
  limit greatest(p_limit, 1);
$$;

grant execute on function public.match_places(vector, double precision, double precision, integer, integer)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;


-- =====================================================================================
-- VERIFICACION (solo lectura; correr tras aplicar)
-- =====================================================================================
/*
-- 1) Una sola firma de cada una, invoker, con search_path fijado y abiertas a los tres roles.
select p.oid::regprocedure as sig, p.prosecdef, p.provolatile, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth,
       has_function_privilege('service_role', p.oid, 'execute')  as srv
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('search_places', 'match_places')
order by 1;

-- 2) Los lugares con portada la devuelven como photo_url. Esperado: 0.
select count(*)
from public.search_places(null, null, null, null, null, 25000, 1000) s
join public.places p on p.id = s.id
where nullif(p.cover_url, '') is not null and s.photo_url is distinct from p.cover_url;

-- 3) Los que no tienen portada siguen trayendo su foto aprobada (mismo conteo que antes).
select count(*) filter (where photo_url is not null) as con_foto, count(*) as total
from public.search_places(null, null, null, null, null, 25000, 1000);
*/
