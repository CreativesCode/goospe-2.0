-- 0034 — Reseñas en modo estricto (cierra S7, docs/15-analisis-brechas-y-qa.md §3.1).
--
-- NO APLICAR JUNTO CON 0033. Aplicar SOLO DESPUÉS de desplegar el código en que
-- src/actions/reviews.ts escribe con service role (tras validar sesión, groserías y rate
-- limit). Con la versión anterior desplegada, las reseñas nuevas quedarían en 'pending' y
-- dejarían de verse hasta moderarlas en /admin/content.
--
-- Efecto: lo que entre por la API directa (sin pasar por el servidor) queda pendiente de
-- moderación. El trigger trg_reviews_guard (0033) fija el status al default de la columna
-- en los INSERT y también al editar el texto de una reseña aprobada; service_role no pasa
-- por esas guardas. Idempotente.
alter table public.reviews alter column status set default 'pending';

/*
-- Verificación (solo lectura). Esperado: 'pending'::text
select column_default from information_schema.columns
where table_schema = 'public' and table_name = 'reviews' and column_name = 'status';
*/
