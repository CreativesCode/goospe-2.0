-- 0022 — Índice de cobertura para la foto de portada de cada lugar.
-- Cada RPC de feed/búsqueda/match resuelve la foto con un subquery correlacionado:
--   select pp.url from place_photos pp
--     where pp.place_id = c.id and pp.status = 'approved'
--     order by (pp.source = 'google') desc, pp.id limit 1
-- (ver 0012_get_feed, 0013_match_places, 0014_feed_boosts, 0015_search_places,
--  0016_feed_taste, 0020_get_feed_events). Sin índice, cada candidato hace un seq scan
-- sobre place_photos → N seq scans por request del feed.
--
-- El índice cubre el filtro (place_id, status) y deja source+id disponibles para el
-- order by, evitando el scan y el sort por candidato.
create index if not exists idx_place_photos_place_status
  on public.place_photos (place_id, status, source, id);
