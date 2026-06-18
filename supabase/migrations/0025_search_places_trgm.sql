-- 0025 — Búsqueda con tolerancia a errores (trigram) + ranking por relevancia.
-- Contexto: ya existe el índice GIN trigram `places_name_idx (name gin_trgm_ops)`, así que el
-- `ilike '%q%'` ya estaba respaldado por índice. Lo que faltaba era:
--   1) tolerar typos/acentos (ej. "aromacaffe" → "Aromacafe", "andes kafe" → "Andes Cafe").
--   2) ordenar por relevancia del texto cuando hay query, no solo por distancia.
-- El operador `<%` (word_similarity) usa el MISMO índice GIN, con el umbral por defecto (0.6):
-- cubre typos de una palabra (ej. word_similarity('aromacaffe','Aromacafe') = 0.75). No se baja
-- el umbral por función porque Supabase no permite el SET de la GUC `pg_trgm.*` en la definición;
-- los substrings exactos los sigue cubriendo el `ilike`.
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
    (select cat.emoji from public.place_categories pc
       join public.categories cat on cat.id = pc.category_id
       where pc.place_id = p.id limit 1) as category_emoji,
    (select cat.name from public.place_categories pc
       join public.categories cat on cat.id = pc.category_id
       where pc.place_id = p.id limit 1) as category_name,
    coalesce(st.rating, 0) as rating
  from public.places p
  left join public.place_stats st on st.place_id = p.id
  where p.is_published
    -- substring exacto (índice GIN) O similitud por palabra (typos, mismo índice GIN)
    and (p_q is null or p_q = '' or p.name ilike '%' || p_q || '%' or p_q <% p.name)
    and (p_max_price is null or p.price_level is null or p.price_level <= p_max_price)
    and (p_category is null or exists (
          select 1 from public.place_categories pc
          where pc.place_id = p.id and pc.category_id = p_category))
    and ((select g from me) is null or ST_DWithin(p.location, (select g from me), p_radius_m))
  order by
    -- con query: prefijo exacto primero, luego relevancia textual, luego cercanía.
    -- sin query (browse): relevancia = 0 → manda la distancia (comportamiento previo intacto).
    (p_q is not null and p_q <> '' and p.name ilike p_q || '%') desc,
    case when p_q is null or p_q = '' then 0 else word_similarity(p_q, p.name) end desc,
    case when (select g from me) is null then 0
         else ST_Distance(p.location, (select g from me)) end asc,
    p.name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.search_places(text, bigint, int, double precision, double precision, integer, integer) to anon, authenticated;
