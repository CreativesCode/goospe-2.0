-- 0005 — Seed: taxonomía propia + mapeo OSM→propia + pesos del feed (doc 06 Fase 0)
-- Vertical de lanzamiento: comida / bares / café / nightlife / eventos.

insert into public.categories (name, slug, emoji, sort) values
  ('Comer',   'comer',   '🍽️', 1),
  ('Café',    'cafe',    '☕',  2),
  ('Beber',   'beber',   '🍸',  3),
  ('Noche',   'noche',   '🌙',  4),
  ('Eventos', 'eventos', '🎫',  5)
on conflict (slug) do nothing;

insert into public.category_mappings (osm_tag, category_id)
select m.tag, c.id
from (values
  ('amenity=restaurant', 'comer'),
  ('amenity=fast_food',  'comer'),
  ('amenity=food_court', 'comer'),
  ('amenity=cafe',       'cafe'),
  ('amenity=ice_cream',  'cafe'),
  ('shop=bakery',        'cafe'),
  ('shop=pastry',        'cafe'),
  ('amenity=bar',        'beber'),
  ('amenity=pub',        'beber'),
  ('amenity=biergarten', 'beber'),
  ('amenity=nightclub',  'noche')
) as m(tag, slug)
join public.categories c on c.slug = m.slug
on conflict (osm_tag) do nothing;

-- Pesos del ranking del feed, ajustables sin deploy (doc 04 §4).
insert into public.feed_config (key, value) values
  ('ranking_weights', '{"distance":0.30,"trending":0.20,"affinity":0.25,"open_now":0.10,"recency":0.05,"diversity":0.10}'::jsonb),
  ('boost',           '{"max_per_n_cards":8}'::jsonb)
on conflict (key) do nothing;
