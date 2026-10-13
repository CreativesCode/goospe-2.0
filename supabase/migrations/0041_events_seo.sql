-- 0041 — Fase 7 (lado usuario, parte A): eventos con página propia, cartelera y listados SEO.
--
-- ORDEN: migración primero, código después. Todo es aditivo y compatible con el código ya
-- desplegado:
--   · event_rsvps.status pasa a tener CHECK ('going' | 'interested'). La columna ya existía
--     (text, default 'going') y el código desplegado solo escribe esos dos valores. Las filas
--     existentes ('going') cuentan como "asistiré".
--   · event_gender_stats gana la columna `interested` (drop + create: cambia el retorno). El
--     código desplegado lee going/male/female por nombre y sigue funcionando.
--   · city_places, city_category_counts, related_places: funciones nuevas, solo service_role.
--   · enqueue_event_reminders (pg_cron): mismo cuerpo, ahora rellena notifications.link.
--
-- DECISIÓN — qué cuenta cada número:
--   · going / male / female → SOLO status = 'going' ("asistiré"). Es el aforo que ve el público
--     y el desglose por género; "me interesa" no infla la asistencia.
--   · interested → SOLO status = 'interested'. Se muestra aparte ("N interesados").
--   Se conserva la definición REAL de producción del desglose (male = declaró 'male', female =
--   declaró 'female'; quien no declaró no entra en ninguno), que difiere del archivo 0032.
--
-- ABIERTA A PROPÓSITO (anon/authenticated): event_gender_stats. La llama el navegador (feed) y
-- devuelve EXCLUSIVAMENTE conteos. A partir de esta versión solo responde por eventos
-- aprobados de lugares publicados (antes contaba cualquier evento cuyo id se conociera).
--
-- REVISAR ANTES DE APLICAR:
--   1. Que no existan filas con otro status: select status, count(*) from event_rsvps group by 1;
--      (al 12-oct-2026: una sola fila, 'going'). Si hubiera otro valor, el CHECK falla y la
--      transacción entera se revierte.
--   2. `drop function event_gender_stats` deja la función inexistente solo dentro de la
--      transacción; no hay ventana visible para el código desplegado.
--   3. Que `enqueue_event_reminders` de producción siga siendo la de la sección 6 (comparar con
--      pg_get_functiondef): si otra migración la cambió después, esta la pisaría.

begin;

-- ───────────────────────── 1. RSVP: "me interesa" vs "asistiré" ─────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_rsvps'::regclass and conname = 'event_rsvps_status_check'
  ) then
    alter table public.event_rsvps
      add constraint event_rsvps_status_check check (status in ('going', 'interested'));
  end if;
end $$;

-- La PK es (user_id, event_id): contar por evento recorría la tabla entera.
create index if not exists event_rsvps_event_status_idx on public.event_rsvps (event_id, status);
-- Cartelera y sitemap filtran por estado y fecha.
create index if not exists events_status_starts_idx on public.events (status, starts_at);
-- Listados por categoría (la PK empieza por place_id).
create index if not exists place_categories_category_idx on public.place_categories (category_id);

-- ───────────────────────── 2. Conteos públicos por evento ─────────────────────────
drop function if exists public.event_gender_stats(uuid[]);

create function public.event_gender_stats(p_event_ids uuid[])
returns table (event_id uuid, going bigint, male bigint, female bigint, interested bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  select r.event_id,
         count(*) filter (where r.status = 'going')                                          as going,
         count(*) filter (where r.status = 'going' and (p.onboarding->>'gender') = 'male')   as male,
         count(*) filter (where r.status = 'going' and (p.onboarding->>'gender') = 'female') as female,
         count(*) filter (where r.status = 'interested')                                     as interested
  from public.event_rsvps r
  join public.events e on e.id = r.event_id and e.status = 'approved'
  join public.places pl on pl.id = e.place_id and pl.is_published
  left join public.profiles p on p.id = r.user_id
  where r.event_id = any(p_event_ids)
  group by r.event_id;
$$;

revoke execute on function public.event_gender_stats(uuid[]) from public;
grant  execute on function public.event_gender_stats(uuid[]) to anon, authenticated, service_role;

-- ───────────────────────── 3. Listado de lugares por ciudad (y categoría) ─────────────────────────
-- Solo service_role: lo llama el servidor al renderizar /c/[ciudad] y /c/[ciudad]/[categoria].
-- p_sort: 'name' (alfabético, estable entre páginas) | 'popular' (bloque "Populares en …").
-- `total` = filas que cumplen el filtro (para la paginación) repetido en cada fila.
create or replace function public.city_places(
  p_city_id bigint,
  p_category_id bigint default null,
  p_sort text default 'name',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, vibe_line text, description text, price_level smallint,
  photo_url text, category_slug text, category_name text, category_emoji text,
  rating numeric, reviews_count integer, total bigint
)
language sql stable
set search_path = public, extensions
as $$
  with base as (
    select p.id, p.slug, p.name, p.vibe_line, p.description, p.price_level, p.cover_url,
           cc.slug as category_slug, cc.name as category_name, cc.emoji as category_emoji,
           coalesce(st.rating, 0)         as rating,
           coalesce(st.reviews_count, 0)  as reviews_count,
           coalesce(st.trending_score, 0) as trending,
           coalesce(st.views_30d, 0) + 3 * coalesce(st.saves_count, 0) as activity
    from public.places p
    left join public.place_stats st on st.place_id = p.id
    left join lateral (
      select cat.slug, cat.name, cat.emoji
      from public.place_categories pc
      join public.categories cat on cat.id = pc.category_id
      where pc.place_id = p.id
      order by pc.category_id
      limit 1
    ) cc on true
    where p.city_id = p_city_id
      and p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and (p_category_id is null or exists (
        select 1 from public.place_categories pc
        where pc.place_id = p.id and pc.category_id = p_category_id))
  )
  select b.id, b.slug, b.name, b.vibe_line, b.description, b.price_level,
         coalesce(
           nullif(b.cover_url, ''),
           (select pp.url from public.place_photos pp
             where pp.place_id = b.id and pp.status = 'approved'
             order by (pp.source = 'google') desc, pp.id
             limit 1)
         ) as photo_url,
         b.category_slug, b.category_name, b.category_emoji,
         b.rating, b.reviews_count,
         count(*) over () as total
  from base b
  order by
    case when p_sort = 'popular' then b.trending end desc nulls last,
    case when p_sort = 'popular' then b.activity end desc nulls last,
    case when p_sort = 'popular' then b.rating end desc nulls last,
    case when p_sort = 'popular' then b.reviews_count end desc nulls last,
    case when p_sort = 'popular' then (b.vibe_line is not null)::int end desc nulls last,
    -- Sin actividad aún (piloto): orden estable pero no alfabético, para no repetir el listado.
    case when p_sort = 'popular' then hashtextextended(b.id::text, 0) end,
    lower(b.name), b.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

revoke execute on function public.city_places(bigint, bigint, text, integer, integer) from public, anon, authenticated;
grant  execute on function public.city_places(bigint, bigint, text, integer, integer) to service_role;

-- ───────────────────────── 4. Cuántos lugares publicados hay por ciudad y categoría ─────────────────────────
-- Solo service_role: índice de ciudades (/places), chips de categoría y sitemap.
create or replace function public.city_category_counts()
returns table (city_id bigint, category_id bigint, places bigint)
language sql stable
set search_path = public, extensions
as $$
  select p.city_id, pc.category_id, count(*) as places
  from public.places p
  join public.place_categories pc on pc.place_id = p.id
  where p.is_published
    and p.city_id is not null
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
  group by p.city_id, pc.category_id;
$$;

revoke execute on function public.city_category_counts() from public, anon, authenticated;
grant  execute on function public.city_category_counts() to service_role;

-- ───────────────────────── 5. Lugares relacionados ─────────────────────────
-- Solo service_role: bloque "Lugares relacionados" de la ficha. Misma categoría a menos de
-- 8 km, ordenados por parecido (embedding ya calculado, sin llamar a la IA) corregido por
-- distancia: ~0,03 de distancia coseno por km. Sin embedding se trata como parecido medio.
create or replace function public.related_places(p_place_id uuid, p_limit integer default 6)
returns table (
  id uuid, slug text, name text, vibe_line text, price_level smallint, photo_url text,
  category_name text, category_emoji text, distance_m double precision, rating numeric
)
language sql stable
set search_path = public, extensions
as $$
  with src as (
    select p.id, p.location, p.embedding from public.places p where p.id = p_place_id
  ),
  src_cats as (
    select pc.category_id from public.place_categories pc where pc.place_id = p_place_id
  ),
  cand as (
    select p.id, p.slug, p.name, p.vibe_line, p.price_level, p.cover_url,
           ST_Distance(p.location, s.location) as dist_m,
           case when p.embedding is not null and s.embedding is not null
                then (p.embedding <=> s.embedding)::double precision end as emb_dist
    from src s
    join public.places p
      on p.id <> s.id
     and p.is_published
     and p.business_status is distinct from 'CLOSED_PERMANENTLY'
     and ST_DWithin(p.location, s.location, 8000)
    where exists (
      select 1 from public.place_categories pc
      where pc.place_id = p.id and pc.category_id in (select category_id from src_cats))
  )
  select c.id, c.slug, c.name, c.vibe_line, c.price_level,
         coalesce(
           nullif(c.cover_url, ''),
           (select pp.url from public.place_photos pp
             where pp.place_id = c.id and pp.status = 'approved'
             order by (pp.source = 'google') desc, pp.id
             limit 1)
         ) as photo_url,
         cc.name as category_name, cc.emoji as category_emoji,
         c.dist_m as distance_m,
         coalesce(st.rating, 0) as rating
  from cand c
  left join public.place_stats st on st.place_id = c.id
  left join lateral (
    select cat.name, cat.emoji
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = c.id
    order by pc.category_id
    limit 1
  ) cc on true
  order by coalesce(c.emb_dist, 0.6) + (c.dist_m / 1000.0) * 0.03, c.dist_m, c.id
  limit least(greatest(p_limit, 1), 24);
$$;

revoke execute on function public.related_places(uuid, integer) from public, anon, authenticated;
grant  execute on function public.related_places(uuid, integer) to service_role;

-- ───────────────────────── 6. Recordatorio del día: enlace a la página del evento ─────────────────────────
-- Mismo cuerpo que tiene producción (leído con pg_get_functiondef el 12-oct-2026) más la
-- columna `link` (existe desde 0037): la campana lleva a /events/<id> en vez de no llevar a
-- ningún sitio. Sigue avisando SOLO a quien marcó "asistiré"; "me interesa" no recibe
-- recordatorio. `create or replace` conserva los permisos (solo postgres/pg_cron y service_role).
create or replace function public.enqueue_event_reminders()
returns void
language sql security definer
set search_path = public
as $$
  insert into public.notifications (user_id, kind, title, body, event_id, link)
  select r.user_id, 'event_reminder',
         'Hoy: ' || e.name,
         'En ' || p.name || ' · ' || to_char(e.starts_at at time zone c.timezone, 'HH24:MI') || ' h',
         e.id,
         '/events/' || e.id::text
  from public.events e
  join public.event_rsvps r on r.event_id = e.id and r.status = 'going'
  join public.places p on p.id = e.place_id
  join public.cities c on c.id = p.city_id
  where e.status = 'approved'
    and e.starts_at between now() and now() + interval '14 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r.user_id and n.event_id = e.id and n.kind = 'event_reminder'
    );
$$;

revoke execute on function public.enqueue_event_reminders() from public, anon, authenticated;
grant  execute on function public.enqueue_event_reminders() to service_role;

commit;

notify pgrst, 'reload schema';

-- ───────────────────────── Verificación (correr después de aplicar) ─────────────────────────
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.event_rsvps'::regclass and contype = 'c';
-- select proname, prosecdef, proacl::text from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('event_gender_stats', 'city_places', 'city_category_counts', 'related_places');
--   → event_gender_stats: anon, authenticated y service_role; las otras tres: solo service_role.
-- select * from public.city_places((select id from cities where slug = 'puerto-varas'), null, 'name', 5, 0);
-- select count(*), sum(places) from public.city_category_counts();
-- select name, round(distance_m) from public.related_places((select id from places where is_published limit 1), 6);
