-- 0020 — Eventos próximos cercanos para intercalar como cards en el feed (doc 02, Pilar 3).
-- Devuelve eventos aprobados a futuro dentro del radio, con su lugar, foto y flag de boost.
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
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by (e.id in (select event_id from active_boosts)) desc, e.starts_at asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_feed_events(double precision, double precision, integer, integer) to anon, authenticated;
