-- 0011 — Fotos persistidas en Supabase Storage (no hotlinks externos).
-- source: de dónde vino (mapillary | foursquare | osm | business | user)
-- storage_path: ruta dentro del bucket 'places' (para poder borrar el objeto al eliminar la foto)
alter table public.place_photos add column if not exists source       text;
alter table public.place_photos add column if not exists storage_path text;

-- Bucket público para servir las fotos por CDN.
insert into storage.buckets (id, name, public)
values ('places', 'places', true)
on conflict (id) do nothing;
