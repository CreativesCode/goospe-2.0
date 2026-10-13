-- 0043 — Fase 7 "Lado usuario", parte C: feed paginado, pesos del ranking, búsqueda con ciudad,
-- perfil de gusto que aprende y analítica de producto (.claude/PRPs/prp-legacy-y-brechas.md).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Estado real leído de la BD el 12-oct-2026 (pg_get_functiondef, information_schema, pg_policies,
-- pg_trigger, cron.job): 0040 ya está aplicada; get_feed / search_places son los de 0038.
--
-- Qué hace:
--   a) feed_config          fila nueva 'feed_ranking' con los pesos que HOY están fijos en get_feed.
--                           La fila vieja 'ranking_weights' (semilla de 0005, nunca leída y con otros
--                           valores) NO se toca ni se lee: usarla habría cambiado el ranking.
--   b) taste_profiles       + learned_embedding, learned_at, learned_signals. El embedding del
--                           onboarding (`embedding`) no lo escribe nadie más que el onboarding.
--   c) get_feed             DROP + CREATE (ver "Compatibilidad"): mismos 5 parámetros y mismas 19
--                           columnas; 3 parámetros nuevos opcionales para paginar por cursor
--                           (p_after_score, p_after_dist, p_after_id); lee los pesos de feed_config
--                           con los valores actuales como respaldo; usa learned_embedding si está
--                           vigente; p_limit queda acotado a 200.
--   d) search_places        DROP + CREATE: mismos 7 parámetros y mismas 12 columnas; parámetro nuevo
--                           opcional p_city (filtra por ciudad en vez de por radio); p_limit ≤ 200.
--   e) active_cities        ciudades activas con centro (lat/lng) y nº de lugares publicados, para
--                           el selector de ciudad. Solo service_role (la sirve /api/cities).
--   f) refresh_taste_profiles  refresco conservador del perfil de gusto desde `interactions`
--                           (solo SQL + pgvector, sin llamadas de IA). Solo service_role.
--   g) interaction_actors + admin_active_users + admin_weekly_usage + admin_retention_cohorts
--                           analítica de producto. Solo service_role.
--   h) pg_cron              job diario 'goospe-taste-refresh' (re-ejecutable).
--
-- COMPATIBILIDAD con el código desplegado hoy (la migración se aplica ANTES del deploy):
--   · get_feed se llama con { p_lat, p_lng, p_radius_m, p_limit, p_offset } y search_places con
--     { p_q, p_category, p_max_price, p_lat, p_lng, p_radius_m, p_limit }. PostgREST resuelve por
--     NOMBRE de argumento y los nuevos tienen default → la llamada vieja sigue entrando.
--   · Añadir parámetros con `create or replace` crearía una SOBRECARGA (dos funciones con el mismo
--     nombre) y PostgREST respondería PGRST203 "could not choose the best candidate". Por eso se
--     hace DROP de la firma vieja + CREATE de la nueva en la misma transacción, y se vuelven a dar
--     los grants. No queda ningún instante sin función (DDL transaccional).
--   · get_feed_events NO cambia.
--   · Con p_after_* en null y sin fila 'feed_ranking' el resultado es el mismo que hoy. Comprobado
--     el 12-oct-2026 ejecutando el cuerpo viejo y el nuevo como SELECT sobre producción (mismos ids,
--     mismo orden y mismo score bit a bit; detalle en el informe de la fase). Repetir tras aplicar
--     con las consultas del final.
--   · Único cambio de comportamiento para un llamador viejo: p_limit > 200 se recorta a 200
--     (nadie pide más de 60 hoy).
--
-- LEER ANTES DE APLICAR:
--   · (f) escribe en taste_profiles (solo las 3 columnas learned_*), cada día, como mucho 200
--     usuarios por corrida. Nunca toca embedding / summary / updated_at.
--   · (c) "abierto ahora" NO entra al score: el horario es texto OSM (`hours.osm_raw`) y su parser
--     vive en TypeScript (src/lib/hours.ts). Portarlo a SQL sería una segunda implementación a
--     mantener; queda fuera a propósito.
--   · Tras aplicar: `notify pgrst, 'reload schema'` (va al final del archivo).
--
-- Permisos: get_feed y search_places siguen ABIERTAS (anon, authenticated) y solo exponen lugares
-- publicados. Todo lo nuevo es interno → revoke a public/anon/authenticated + grant a service_role.
--
-- Contrato con el código (src/):
--   · get_feed (cursor)            src/features/feed/use-feed.ts, src/features/feed/feed-cursor.ts
--   · feed_config 'feed_ranking'   src/features/feed/ranking-weights.ts, src/actions/admin-feed-config.ts
--   · search_places (p_city)       src/app/api/search/route.ts
--   · active_cities                src/lib/cities.ts → /api/cities
--   · admin_active_users / admin_weekly_usage / admin_retention_cohorts   src/app/admin/product/page.tsx
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después.

begin;

-- =====================================================================================
-- a) feed_config: pesos del ranking
-- =====================================================================================
-- Valores = los literales del get_feed vigente. `on conflict do nothing`: re-ejecutar la migración
-- no pisa lo que el equipo haya editado desde /admin/ranking.
insert into public.feed_config (key, value) values
  ('feed_ranking',
   '{"distance":0.45,"distance_decay_m":2500.0,"trending":0.25,"novelty":0.10,"affinity":0.20,"boost":1.0}'::jsonb)
on conflict (key) do nothing;

-- La tabla ya tiene RLS sin policies (nadie la lee por la API). Se cierran también los grants.
alter table public.feed_config enable row level security;
revoke all on table public.feed_config from public, anon, authenticated;
grant  all on table public.feed_config to service_role;


-- =====================================================================================
-- b) taste_profiles: perfil aprendido, separado del de onboarding
-- =====================================================================================
alter table public.taste_profiles
  add column if not exists learned_embedding extensions.vector(1024),
  add column if not exists learned_at        timestamptz,
  add column if not exists learned_signals   integer;

-- Lectura: sigue la policy "read own taste". Escritura: nunca hubo policy de write; se cierran
-- los grants para que no dependa solo de RLS.
revoke insert, update, delete on table public.taste_profiles from public, anon, authenticated;


-- =====================================================================================
-- c) get_feed: pesos desde feed_config + paginación por cursor
-- =====================================================================================
drop function if exists public.get_feed(double precision, double precision, integer, integer, integer);
drop function if exists public.get_feed(double precision, double precision, integer, integer, integer,
                                        double precision, double precision, uuid);

create function public.get_feed(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 20,
  p_offset integer default 0,
  -- Cursor (los tres o ninguno): score, distance_m e id de la ÚLTIMA fila de la página anterior.
  p_after_score double precision default null,
  p_after_dist double precision default null,
  p_after_id uuid default null
)
returns table (
  id uuid, slug text, name text, vibe_line text, description text, tags text[],
  price_level smallint, lat double precision, lng double precision, distance_m double precision,
  rating numeric, reviews_count integer, photo_url text, category_emoji text, category_name text,
  boosted boolean, score double precision, hours jsonb, timezone text
)
language sql stable security definer
set search_path = public, extensions
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  cfg as (
    select coalesce(
      (select fc.value from public.feed_config fc where fc.key = 'feed_ranking'),
      '{}'::jsonb) as v
  ),
  -- Un valor ausente, no numérico o fuera de rango cae al valor histórico: una fila mal editada
  -- no puede tumbar ni invertir el feed. Se leen como numeric para que la aritmética sea la
  -- misma que con los literales de antes.
  w as (
    select
      case when jsonb_typeof(v->'distance') = 'number' and (v->>'distance')::numeric between 0 and 5
           then (v->>'distance')::numeric else 0.45 end as w_distance,
      case when jsonb_typeof(v->'distance_decay_m') = 'number' and (v->>'distance_decay_m')::numeric between 100 and 100000
           then (v->>'distance_decay_m')::numeric else 2500.0 end as decay_m,
      case when jsonb_typeof(v->'trending') = 'number' and (v->>'trending')::numeric between 0 and 5
           then (v->>'trending')::numeric else 0.25 end as w_trending,
      case when jsonb_typeof(v->'novelty') = 'number' and (v->>'novelty')::numeric between 0 and 5
           then (v->>'novelty')::numeric else 0.10 end as w_novelty,
      case when jsonb_typeof(v->'affinity') = 'number' and (v->>'affinity')::numeric between 0 and 5
           then (v->>'affinity')::numeric else 0.20 end as w_affinity,
      case when jsonb_typeof(v->'boost') = 'number' and (v->>'boost')::numeric between 0 and 5
           then (v->>'boost')::numeric else 1.0 end as w_boost
    from cfg
  ),
  -- Perfil aprendido solo si es posterior al último onboarding; si no, el de onboarding.
  taste as (
    select case when tp.learned_embedding is not null and tp.learned_at >= tp.updated_at
                then tp.learned_embedding else tp.embedding end as embedding
    from public.taste_profiles tp where tp.user_id = auth.uid()
  ),
  active_boosts as (
    select distinct place_id from public.boosts
    where status = 'active' and now() between starts_at and coalesce(ends_at, now())
      and place_id is not null
  ),
  cand as (
    select p.id, p.slug, p.name, p.vibe_line, p.description, p.tags, p.price_level,
           p.embedding, p.hours, p.city_id, p.cover_url,
           ST_Y(p.location::geometry) as lat,
           ST_X(p.location::geometry) as lng,
           ST_Distance(p.location, (select g from me)) as dist_m
    from public.places p
    where p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and ST_DWithin(p.location, (select g from me), p_radius_m)
  ),
  scored as (
    select
      c.id, c.slug, c.name, c.vibe_line, c.description, c.tags, c.price_level,
      c.lat, c.lng, c.dist_m as distance_m,
      coalesce(st.rating, 0) as rating,
      coalesce(st.reviews_count, 0) as reviews_count,
      c.cover_url,
      (c.id in (select place_id from active_boosts)) as boosted,
      ( w.w_distance * exp(-c.dist_m / w.decay_m)
      + w.w_trending * coalesce(st.trending_score, 0) / 5.0
      + w.w_novelty * (hashtextextended(c.id::text, 0) & 1023)::double precision / 1023.0
      + case when (select embedding from taste) is not null and c.embedding is not null
             then w.w_affinity * (1 - (c.embedding <=> (select embedding from taste)))
             else 0.0 end
      + case when c.id in (select place_id from active_boosts) then w.w_boost else 0.0 end
      ) as score,
      c.hours, c.city_id
    from cand c
    cross join w
    left join public.place_stats st on st.place_id = c.id
  )
  select
    s.id, s.slug, s.name, s.vibe_line, s.description, s.tags, s.price_level,
    s.lat, s.lng, s.distance_m, s.rating, s.reviews_count,
    coalesce(
      nullif(s.cover_url, ''),
      (select pp.url from public.place_photos pp
         where pp.place_id = s.id and pp.status = 'approved'
         order by (pp.source = 'google') desc, pp.id
         limit 1)
    ) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    s.boosted, s.score, s.hours,
    ci.timezone
  from scored s
  left join public.cities ci on ci.id = s.city_id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = s.id
    order by pc.category_id
    limit 1
  ) cc on true
  -- Cursor: estrictamente DESPUÉS de la última fila vista, en el mismo orden total del order by.
  where p_after_score is null or p_after_dist is null or p_after_id is null
     or s.score < p_after_score
     or (s.score = p_after_score
         and (s.distance_m > p_after_dist
              or (s.distance_m = p_after_dist and s.id > p_after_id)))
  order by s.score desc, s.distance_m asc, s.id
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_feed(double precision, double precision, integer, integer, integer,
                                           double precision, double precision, uuid) from public;
grant  execute on function public.get_feed(double precision, double precision, integer, integer, integer,
                                           double precision, double precision, uuid)
  to anon, authenticated, service_role;


-- =====================================================================================
-- d) search_places: filtro por ciudad
-- =====================================================================================
-- Con p_city el filtro es la ciudad (places.city_id) y el radio NO aplica; lat/lng solo sirven
-- para medir y ordenar por distancia. Sin p_city, comportamiento idéntico al de 0038.
drop function if exists public.search_places(text, bigint, integer, double precision, double precision, integer, integer);
drop function if exists public.search_places(text, bigint, integer, double precision, double precision, integer, integer, bigint);

create function public.search_places(
  p_q text default null,
  p_category bigint default null,
  p_max_price integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 25000,
  p_limit integer default 40,
  p_city bigint default null
)
returns table (
  id uuid, slug text, name text, vibe_line text, price_level smallint,
  distance_m double precision, hours jsonb, photo_url text,
  category_emoji text, category_name text, rating numeric, timezone text
)
language sql stable
set search_path = public, extensions
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
      and case when p_city is not null then p.city_id = p_city
               else ((select g from me) is null or ST_DWithin(p.location, (select g from me), p_radius_m))
          end
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
  limit least(greatest(p_limit, 1), 200);
$$;

-- SECURITY INVOKER, igual que antes: lo que se ve lo decide la RLS de places (solo publicados).
revoke execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer, bigint) from public;
grant  execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer, bigint)
  to anon, authenticated, service_role;


-- =====================================================================================
-- e) active_cities: ciudades para el selector
-- =====================================================================================
create or replace function public.active_cities()
returns table (
  id bigint, slug text, name text, region text, country text, timezone text,
  lat double precision, lng double precision, places integer
)
language sql stable security definer
set search_path = public, extensions
as $$
  select c.id, c.slug, c.name, c.region, c.country, c.timezone,
         ST_Y(c.center::geometry) as lat,
         ST_X(c.center::geometry) as lng,
         (select count(*)::integer from public.places p
           where p.city_id = c.id and p.is_published
             and p.business_status is distinct from 'CLOSED_PERMANENTLY') as places
  from public.cities c
  where c.is_active
  order by c.country, c.name;
$$;

revoke execute on function public.active_cities() from public, anon, authenticated;
grant  execute on function public.active_cities() to service_role;


-- =====================================================================================
-- f) refresh_taste_profiles: el perfil de gusto aprende del comportamiento
-- =====================================================================================
-- Diseño (conservador a propósito):
--   · Solo usuarios CON perfil de onboarding (fila con `embedding`). No se crean perfiles.
--   · Señales positivas con sesión de los últimos 90 días, como mucho las 200 más recientes por
--     usuario: guardar / cómo llego / llamar / WhatsApp / email (peso 3), compartir (2), ver la
--     ficha (1). Por lugar cuenta la señal más fuerte. Se descartan los lugares que el usuario
--     descartó ("Paso") o cuyo último guardar/quitar fue quitar.
--   · Centroide = promedio ponderado de los embeddings YA existentes de esos lugares.
--   · learned = normalizar((1 − a)·onboarding + a·centroide), con a = min(0,35; 0,05 × nº de
--     lugares) y un mínimo de 3 lugares. El onboarding pesa siempre ≥ 65 %.
--   · Es una función de (onboarding, señales): recalcular no acumula deriva.
--   · Con menos de 3 lugares learned_embedding queda en null (el feed usa el de onboarding) y
--     learned_at se marca igual, para no reevaluar al usuario hasta que tenga señales nuevas.
--   · Coste acotado: p_max_users usuarios por corrida (máx. 1000), 200 interacciones cada uno.
create or replace function public.refresh_taste_profiles(p_max_users integer default 200)
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_done integer := 0;
begin
  with due as (
    select tp.user_id, tp.embedding as base
    from public.taste_profiles tp
    where tp.embedding is not null
      and (
        -- onboarding rehecho después del último aprendizaje
        (tp.learned_embedding is not null and tp.updated_at > tp.learned_at)
        -- o señales positivas nuevas desde el último aprendizaje
        or exists (
          select 1 from public.interactions i
          where i.user_id = tp.user_id
            and i.place_id is not null
            and i.kind in ('save', 'directions', 'call', 'whatsapp', 'email', 'share', 'view_detail')
            and i.created_at > greatest(coalesce(tp.learned_at, '-infinity'::timestamptz), now() - interval '90 days')
        )
      )
    order by tp.learned_at asc nulls first, tp.user_id
    limit least(greatest(coalesce(p_max_users, 200), 1), 1000)
  ),
  recent as (
    select d.user_id, r.place_id, r.kind, r.created_at
    from due d
    cross join lateral (
      select i.place_id, i.kind, i.created_at
      from public.interactions i
      where i.user_id = d.user_id
        and i.place_id is not null
        and i.kind in ('save', 'unsave', 'dismiss', 'directions', 'call', 'whatsapp', 'email', 'share', 'view_detail')
        and i.created_at > now() - interval '90 days'
      order by i.created_at desc
      limit 200
    ) r
  ),
  per_place as (
    select r.user_id, r.place_id,
           max(case r.kind
                 when 'save' then 3 when 'directions' then 3 when 'call' then 3
                 when 'whatsapp' then 3 when 'email' then 3
                 when 'share' then 2 when 'view_detail' then 1 else 0 end) as weight,
           bool_or(r.kind = 'dismiss') as dismissed,
           (array_agg(r.kind order by r.created_at desc) filter (where r.kind in ('save', 'unsave')))[1] as last_save
    from recent r
    group by r.user_id, r.place_id
  ),
  centroid as (
    select pp.user_id,
           count(distinct pp.place_id)::integer as n_places,
           l2_normalize(avg(p.embedding)) as c
    from per_place pp
    join public.places p on p.id = pp.place_id and p.is_published and p.embedding is not null
    cross join lateral generate_series(1, pp.weight) g
    where pp.weight > 0
      and not pp.dismissed
      and pp.last_save is distinct from 'unsave'
    group by pp.user_id
    having count(distinct pp.place_id) >= 3
  ),
  blended as (
    select d.user_id, c.n_places,
           case when c.c is null then null
                else l2_normalize(
                  l2_normalize(d.base) * array_fill((1 - least(0.35, 0.05 * c.n_places))::real, array[vector_dims(d.base)])::vector
                  + c.c            * array_fill(least(0.35, 0.05 * c.n_places)::real,       array[vector_dims(d.base)])::vector
                ) end as learned
    from due d
    left join centroid c on c.user_id = d.user_id
  ),
  upd as (
    update public.taste_profiles tp
    set learned_embedding = b.learned,
        learned_at        = now(),
        learned_signals   = coalesce(b.n_places, 0)
    from blended b
    where tp.user_id = b.user_id
    returning 1
  )
  select count(*) into v_done from upd;
  return v_done;
end$$;

revoke execute on function public.refresh_taste_profiles(integer) from public, anon, authenticated;
grant  execute on function public.refresh_taste_profiles(integer) to service_role;


-- =====================================================================================
-- g) Analítica de producto
-- =====================================================================================
-- IDENTIDAD ("actor"). interactions guarda user_id (si había sesión) y SIEMPRE el id anónimo del
-- dispositivo en context->>'anon_id' (lo pone /api/track también con sesión). Regla:
--   1. fila con user_id                         → actor 'u:<user_id>'
--   2. fila anónima cuyo anon_id aparece alguna vez junto a un user_id
--                                               → se atribuye a ese usuario (el que más filas
--                                                 tenga con ese dispositivo; empate: el primero)
--   3. fila anónima sin vínculo                 → actor 'a:<anon_id>'
--   4. sin user_id ni anon_id                   → no se puede identificar: se excluye
-- Así una persona que navega anónima y luego inicia sesión en el mismo dispositivo cuenta UNA
-- vez. Límite conocido: el mismo usuario anónimo en dos dispositivos cuenta dos veces, y borrar
-- el almacenamiento del navegador crea un actor nuevo (infla usuarios y baja la retención anónima).
create or replace function public.interaction_actors(p_since timestamptz default null)
returns table (actor text, is_user boolean, kind text, created_at timestamptz)
language sql stable security definer
set search_path = public, extensions
as $$
  with pairs as (
    select nullif(btrim(i.context->>'anon_id'), '') as anon_id, i.user_id,
           count(*) as n, min(i.created_at) as first_at
    from public.interactions i
    where i.user_id is not null
    group by 1, 2
  ),
  stitch as (
    select distinct on (anon_id) anon_id, user_id
    from pairs
    where anon_id is not null
    order by anon_id, n desc, first_at asc, user_id
  ),
  rows as (
    select coalesce(i.user_id, s.user_id) as uid,
           nullif(btrim(i.context->>'anon_id'), '') as anon_id,
           i.kind, i.created_at
    from public.interactions i
    left join stitch s
      on i.user_id is null and s.anon_id = nullif(btrim(i.context->>'anon_id'), '')
    where p_since is null or i.created_at >= p_since
  )
  select case when r.uid is not null then 'u:' || r.uid::text else 'a:' || r.anon_id end as actor,
         r.uid is not null as is_user,
         r.kind, r.created_at
  from rows r
  where r.uid is not null or r.anon_id is not null;
$$;

revoke execute on function public.interaction_actors(timestamptz) from public, anon, authenticated;
grant  execute on function public.interaction_actors(timestamptz) to service_role;

-- DAU / WAU (7 días móviles) / MAU (30 días móviles) por día, en la zona horaria indicada.
create or replace function public.admin_active_users(p_days integer default 60, p_tz text default 'America/Santiago')
returns table (day date, dau integer, wau integer, mau integer)
language sql stable security definer
set search_path = public, extensions
as $$
  with lim as (
    select least(greatest(coalesce(p_days, 60), 1), 180) as n,
           (now() at time zone p_tz)::date as today
  ),
  days as (
    select distinct a.actor, (a.created_at at time zone p_tz)::date as day
    from lim, public.interaction_actors(now() - make_interval(days => (select n from lim) + 31)) a
  ),
  series as (
    select generate_series(l.today - (l.n - 1), l.today, interval '1 day')::date as day from lim l
  )
  select s.day,
         (select count(distinct d.actor) from days d where d.day = s.day)::integer,
         (select count(distinct d.actor) from days d where d.day between s.day - 6 and s.day)::integer,
         (select count(distinct d.actor) from days d where d.day between s.day - 29 and s.day)::integer
  from series s
  order by s.day;
$$;

revoke execute on function public.admin_active_users(integer, text) from public, anon, authenticated;
grant  execute on function public.admin_active_users(integer, text) to service_role;

-- Uso por semana (lunes a domingo). "Visita" = un actor en un día (no hay id de sesión).
-- "Decisión" = guardar, cómo llego, llamar, WhatsApp, email o RSVP: la métrica norte del doc 02
-- ("% de sesiones que terminan en una decisión") se lee como decided_visits / visits.
create or replace function public.admin_weekly_usage(p_weeks integer default 12, p_tz text default 'America/Santiago')
returns table (
  week date, actors integer, signed_in integer, anonymous integer,
  visits integer, deciders integer, decided_visits integer, decisions integer
)
language sql stable security definer
set search_path = public, extensions
as $$
  with lim as (
    select date_trunc('week', (now() at time zone p_tz))::date
             - (least(greatest(coalesce(p_weeks, 12), 1), 52) - 1) * 7 as first_week
  ),
  ev as (
    select a.actor, a.is_user,
           (a.created_at at time zone p_tz)::date as day,
           a.kind in ('save', 'directions', 'call', 'whatsapp', 'email', 'rsvp') as decision
    from lim, public.interaction_actors((select first_week from lim)::timestamp at time zone p_tz) a
  )
  select date_trunc('week', e.day)::date as week,
         count(distinct e.actor)::integer,
         count(distinct e.actor) filter (where e.is_user)::integer,
         count(distinct e.actor) filter (where not e.is_user)::integer,
         count(distinct (e.actor, e.day))::integer,
         count(distinct e.actor) filter (where e.decision)::integer,
         count(distinct (e.actor, e.day)) filter (where e.decision)::integer,
         count(*) filter (where e.decision)::integer
  from ev e
  where e.day >= (select first_week from lim)
  group by 1
  order by 1;
$$;

revoke execute on function public.admin_weekly_usage(integer, text) from public, anon, authenticated;
grant  execute on function public.admin_weekly_usage(integer, text) to service_role;

-- Retención por cohorte semanal (semana de la PRIMERA actividad del actor, de toda la historia).
-- dN = actores que volvieron N días después de su primer día O MÁS TARDE (retención "no acotada":
-- la clásica de día exacto es ruido en un producto de uso ocasional). dN_eligible = actores cuyo
-- primer día fue hace N días o más: es el denominador correcto (el resto aún no pudo volver).
-- La tasa de una cohorte puede seguir subiendo con el tiempo; el código la muestra con su base.
create or replace function public.admin_retention_cohorts(p_weeks integer default 12, p_tz text default 'America/Santiago')
returns table (
  cohort_week date, actors integer, signed_in integer,
  d1_eligible integer, d1 integer,
  d7_eligible integer, d7 integer,
  d30_eligible integer, d30 integer
)
language sql stable security definer
set search_path = public, extensions
as $$
  with firsts as (
    select a.actor, bool_or(a.is_user) as is_user,
           min((a.created_at at time zone p_tz)::date) as first_day,
           max((a.created_at at time zone p_tz)::date) as last_day
    from public.interaction_actors() a
    group by a.actor
  ),
  t as (select (now() at time zone p_tz)::date as today)
  select date_trunc('week', f.first_day)::date as cohort_week,
         count(*)::integer,
         count(*) filter (where f.is_user)::integer,
         count(*) filter (where f.first_day + 1  <= t.today)::integer,
         count(*) filter (where f.first_day + 1  <= t.today and f.last_day >= f.first_day + 1)::integer,
         count(*) filter (where f.first_day + 7  <= t.today)::integer,
         count(*) filter (where f.first_day + 7  <= t.today and f.last_day >= f.first_day + 7)::integer,
         count(*) filter (where f.first_day + 30 <= t.today)::integer,
         count(*) filter (where f.first_day + 30 <= t.today and f.last_day >= f.first_day + 30)::integer
  from firsts f cross join t
  where f.first_day >= date_trunc('week', t.today)::date - (least(greatest(coalesce(p_weeks, 12), 1), 52) - 1) * 7
  group by 1
  order by 1 desc;
$$;

revoke execute on function public.admin_retention_cohorts(integer, text) from public, anon, authenticated;
grant  execute on function public.admin_retention_cohorts(integer, text) to service_role;


-- =====================================================================================
-- h) pg_cron: refresco diario del perfil de gusto
-- =====================================================================================
-- Re-ejecutable: se desagenda si existe y se vuelve a agendar. El rastro queda en job_runs
-- (job = 'taste_refresh'); si la función falla, el error queda en cron.job_run_details.
do $$ begin
  perform cron.unschedule('goospe-taste-refresh');
exception when others then null; end $$;

select cron.schedule(
  'goospe-taste-refresh',
  '41 4 * * *',
  $cron$
    insert into public.job_runs (job, started_at, finished_at, ok, counts)
    select 'taste_refresh', now(), clock_timestamp(), true,
           jsonb_build_object('profiles', public.refresh_taste_profiles(200));
  $cron$
);

commit;

notify pgrst, 'reload schema';


-- =====================================================================================
-- VERIFICACIÓN (correr a mano tras aplicar)
-- =====================================================================================
-- 1. Una sola get_feed y una sola search_places (sin sobrecargas), abiertas a anon/authenticated.
-- select p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef, p.proacl::text
-- from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('get_feed', 'search_places');
--
-- 2. La llamada VIEJA sigue funcionando (mismos 5 / 7 argumentos con nombre):
-- select count(*), max(score) from public.get_feed(p_lat => -41.3195, p_lng => -72.9854, p_radius_m => 25000, p_limit => 40, p_offset => 0);
-- select count(*) from public.search_places(p_q => 'cafe', p_category => null, p_max_price => null, p_lat => -41.3195, p_lng => -72.9854, p_radius_m => 25000, p_limit => 60);
--    Y por la API, con la anon key:  POST /rest/v1/rpc/get_feed  {"p_lat":-41.3195,"p_lng":-72.9854,"p_radius_m":25000,"p_limit":40,"p_offset":0}
--
-- 3. Cursor = offset: la página 2 por cursor coincide con la página 2 por offset.
-- with p1 as (select * from public.get_feed(-41.3195, -72.9854, 25000, 40, 0)),
--      last as (select score, distance_m, id from p1 order by score asc, distance_m desc, id desc limit 1),
--      a as (select array_agg(id) ids from (select id from public.get_feed(-41.3195, -72.9854, 25000, 40, 40)) x),
--      b as (select array_agg(id) ids from (select f.id from last l, public.get_feed(-41.3195, -72.9854, 25000, 40, 0, l.score, l.distance_m, l.id) f) x)
-- select a.ids = b.ids as igual from a, b;
--
-- 4. Los pesos guardados son los históricos.
-- select value from public.feed_config where key = 'feed_ranking';
--
-- 5. Funciones internas: solo service_role.
-- select p.proname, p.proacl::text from pg_proc p where p.pronamespace = 'public'::regnamespace
--   and p.proname in ('active_cities', 'refresh_taste_profiles', 'interaction_actors', 'admin_active_users', 'admin_weekly_usage', 'admin_retention_cohorts');
--
-- 6. Job agendado y analítica con datos.
-- select jobname, schedule, active from cron.job where jobname = 'goospe-taste-refresh';
-- select * from public.admin_weekly_usage(8);
-- select * from public.admin_retention_cohorts(12);
--
-- 7. Tras la primera corrida del refresco: nadie perdió su embedding de onboarding.
-- select count(*) filter (where embedding is null) as sin_onboarding, count(learned_embedding) as aprendidos from public.taste_profiles;
