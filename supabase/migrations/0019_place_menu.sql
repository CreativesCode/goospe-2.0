-- 0019 — Carta/menú estructurado del lugar (lo extrae la IA de una foto de la carta).
-- Forma: { "sections": [ { "name": "...", "items": [ { "name", "price", "description" } ] } ] }
alter table public.places add column if not exists menu jsonb;
alter table public.places add column if not exists menu_updated_at timestamptz;
