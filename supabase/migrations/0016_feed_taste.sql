-- 0016 — Personalización del feed por gusto del usuario.
-- Si el usuario autenticado tiene perfil de gusto (taste_profiles.embedding), se suma un
-- término de afinidad (similitud coseno lugar↔gusto) al score. Anónimos / sin onboarding
-- caen al comportamiento previo (cercanía + trending + diversidad + boost). Firma idéntica
-- → CREATE OR REPLACE.
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
    (select cat.emoji from public.place_categories pc
       join public.categories cat on cat.id = pc.category_id
       where pc.place_id = c.id limit 1) as category_emoji,
    (select cat.name from public.place_categories pc
       join public.categories cat on cat.id = pc.category_id
       where pc.place_id = c.id limit 1) as category_name,
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
  order by score desc, c.dist_m asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(double precision, double precision, integer, integer, integer) to anon, authenticated;
