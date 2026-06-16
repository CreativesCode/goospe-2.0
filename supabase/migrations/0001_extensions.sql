-- 0001 — Extensiones requeridas (doc 05 / doc 04)
-- Supabase las instala en el schema `extensions`, que ya está en el search_path.
create extension if not exists postgis    with schema extensions;
create extension if not exists vector     with schema extensions;
create extension if not exists pg_trgm    with schema extensions;
create extension if not exists unaccent   with schema extensions;
create extension if not exists pg_cron;
