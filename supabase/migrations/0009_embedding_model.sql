-- 0009 — Procedencia del embedding (para poder cambiar de proveedor sin ambigüedad).
-- Los embeddings de distintos proveedores no son comparables: si se migra de OpenAI a Voyage
-- hay que re-embeddear todo lo que no coincida con el modelo objetivo. Esta columna lo registra.
alter table public.places         add column if not exists embedding_model text;
alter table public.taste_profiles add column if not exists embedding_model text;
