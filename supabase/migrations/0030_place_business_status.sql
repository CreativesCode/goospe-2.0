-- 0030 — Estado de negocio de Google Places (businessStatus).
-- Google devuelve por lugar uno de: OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY.
-- Es la señal autoritativa de "¿sigue abierto?" — mucho más fiable que inferir por antigüedad
-- de reseñas. Se captura en la carga (etl) y se refresca con el backfill (etl/business-status.mjs).
--
-- Regla de producto: los CLOSED_PERMANENTLY NO se muestran en descubrimiento (feed, búsqueda,
-- conserje, eventos, grid /places, sitemap). Se filtran DENTRO de las RPCs porque el feed y la
-- búsqueda se llaman con el cliente service-role (bypassa RLS), así que la política no bastaría.
-- Usamos `is distinct from` para que los NULL (lugares OSM sin match en Google) sigan visibles.

alter table public.places add column if not exists business_status text;
comment on column public.places.business_status is
  'Google Places businessStatus: OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY (NULL = sin dato).';

-- Índice parcial: acelera el filtro "no cerrado" sin pesar en las filas normales (solo indexa cerrados).
create index if not exists places_permanently_closed_idx
  on public.places (id) where business_status = 'CLOSED_PERMANENTLY';

-- ── get_feed (0026 + filtro de cerrado permanente) ────────────────────────────────────────
create or replace function public.get_feed(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, vibe_line text, description text,
  tags text[], price_level smallint,
  lat double precision, lng double precision, distance_m double precision,
  rating numeric, reviews_count integer, photo_url text,
  category_emoji text, category_name text, boosted boolean, score double precision
)
language sql stable
set search_path = public, extensions
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  taste as (
    select embedding from public.taste_profiles where user_id = auth.uid()
  ),
  active_boosts as (
    select distinct place_id from public.boosts
    where status = 'active' and now() between starts_at and coalesce(ends_at, now())
      and place_id is not null
  ),
  cand as (
    select p.id, p.slug, p.name, p.vibe_line, p.description, p.tags, p.price_level,
           p.embedding,
           ST_Y(p.location::geometry) as lat,
           ST_X(p.location::geometry) as lng,
           ST_Distance(p.location, (select g from me)) as dist_m
    from public.places p
    where p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and ST_DWithin(p.location, (select g from me), p_radius_m)
  )
  select
    c.id, c.slug, c.name, c.vibe_line, c.description, c.tags, c.price_level,
    c.lat, c.lng, c.dist_m as distance_m,
    coalesce(st.rating, 0) as rating,
    coalesce(st.reviews_count, 0) as reviews_count,
    (select pp.url from public.place_photos pp
       where pp.place_id = c.id and pp.status = 'approved'
       order by (pp.source = 'google') desc, pp.id
       limit 1) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    (c.id in (select place_id from active_boosts)) as boosted,
    ( 0.45 * exp(-c.dist_m / 2500.0)
    + 0.25 * coalesce(st.trending_score, 0) / 5.0
    + 0.10 * (hashtextextended(c.id::text, 0) & 1023)::double precision / 1023.0
    + case when (select embedding from taste) is not null and c.embedding is not null
           then 0.20 * (1 - (c.embedding <=> (select embedding from taste)))
           else 0.0 end
    + case when c.id in (select place_id from active_boosts) then 1.0 else 0.0 end
    ) as score
  from cand c
  left join public.place_stats st on st.place_id = c.id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = c.id
    limit 1
  ) cc on true
  order by score desc, c.dist_m asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(double precision, double precision, integer, integer, integer) to anon, authenticated;

-- ── search_places (0026 + filtro de cerrado permanente) ───────────────────────────────────
create or replace function public.search_places(
  p_q text default null,
  p_category bigint default null,
  p_max_price int default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 25000,
  p_limit integer default 40
)
returns table (
  id uuid, slug text, name text, vibe_line text, price_level smallint,
  distance_m double precision, hours jsonb, photo_url text,
  category_emoji text, category_name text, rating numeric
)
language sql stable
set search_path = public, extensions
as $$
  with me as (
    select case when p_lat is null or p_lng is null then null
                else ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography end as g
  )
  select
    p.id, p.slug, p.name, p.vibe_line, p.price_level,
    case when (select g from me) is null then null
         else ST_Distance(p.location, (select g from me)) end as distance_m,
    p.hours,
    (select pp.url from public.place_photos pp
       where pp.place_id = p.id and pp.status = 'approved'
       order by (pp.source = 'google') desc, pp.id limit 1) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    coalesce(st.rating, 0) as rating
  from public.places p
  left join public.place_stats st on st.place_id = p.id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = p.id
    limit 1
  ) cc on true
  where p.is_published
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
    and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%' or p_q <% p.name)
    and (p_max_price is null or p.price_level is null or p.price_level <= p_max_price)
    and (p_category is null or exists (
          select 1 from public.place_categories pc
          where pc.place_id = p.id and pc.category_id = p_category))
    and ((select g from me) is null or ST_DWithin(p.location, (select g from me), p_radius_m))
  order by
    (p_q is not null and p_q <> '' and p.name ilike p_q || '%') desc,
    case when p_q is null or p_q = '' then 0 else word_similarity(p_q, p.name) end desc,
    case when (select g from me) is null then 0
         else ST_Distance(p.location, (select g from me)) end asc,
    p.name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.search_places(text, bigint, int, double precision, double precision, integer, integer) to anon, authenticated;

-- ── match_places (0013 + filtro de cerrado permanente) ────────────────────────────────────
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
    (select pp.url from public.place_photos pp
       where pp.place_id = p.id and pp.status = 'approved'
       order by (pp.source = 'google') desc, pp.id limit 1) as photo_url,
    1 - (p.embedding <=> p_embedding) as similarity
  from public.places p
  where p.is_published
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
    and p.embedding is not null
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by p.embedding <=> p_embedding
  limit greatest(p_limit, 1);
$$;

grant execute on function public.match_places(vector, double precision, double precision, integer, integer) to anon, authenticated;

-- ── get_feed_events (0020 + filtro de cerrado permanente en el lugar anfitrión) ────────────
create or replace function public.get_feed_events(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 10
)
returns table (
  id uuid, name text, description text, image_url text, starts_at timestamptz,
  place_id uuid, place_slug text, place_name text,
  lat double precision, lng double precision, distance_m double precision,
  photo_url text, boosted boolean
)
language sql stable
set search_path = public, extensions
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  active_boosts as (
    select distinct event_id from public.boosts
    where status = 'active' and now() between starts_at and coalesce(ends_at, now())
      and event_id is not null
  )
  select
    e.id, e.name, e.description, e.image_url, e.starts_at,
    p.id as place_id, p.slug as place_slug, p.name as place_name,
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng,
    ST_Distance(p.location, (select g from me)) as distance_m,
    coalesce(
      e.image_url,
      (select pp.url from public.place_photos pp
        where pp.place_id = p.id and pp.status = 'approved'
        order by (pp.source = 'google') desc, pp.id limit 1)
    ) as photo_url,
    (e.id in (select event_id from active_boosts)) as boosted
  from public.events e
  join public.places p on p.id = e.place_id
  where e.status = 'approved'
    and e.starts_at >= now() - interval '3 hours'
    and p.is_published
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by (e.id in (select event_id from active_boosts)) desc, e.starts_at asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_feed_events(double precision, double precision, integer, integer) to anon, authenticated;
