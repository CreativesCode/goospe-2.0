-- 0013 — Búsqueda semántica para el conserje (Fase 3).
-- Candidatos por similitud de embedding (pgvector cosine) dentro de un radio (PostGIS).
-- El LLM recibe SOLO estos candidatos pre-filtrados (no se le pasa toda la ciudad).
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
    and p.embedding is not null
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by p.embedding <=> p_embedding
  limit greatest(p_limit, 1);
$$;

grant execute on function public.match_places(vector, double precision, double precision, integer, integer) to anon, authenticated;
