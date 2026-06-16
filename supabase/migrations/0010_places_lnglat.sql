-- 0010 — Helper para extraer lat/lng de places.location (geography) en clientes JS/ETL.
-- También reutilizable por el RPC del feed (Fase 2). SECURITY INVOKER: service_role/owner
-- ya pueden leer places; anon/authenticated no necesitan esta función (coords son públicas igual).
create or replace function public.places_lnglat(ids uuid[])
returns table(id uuid, lat double precision, lng double precision)
language sql stable set search_path = public, extensions as $$
  select p.id,
         extensions.ST_Y(p.location::geometry) as lat,
         extensions.ST_X(p.location::geometry) as lng
  from public.places p
  where p.id = any(ids);
$$;

revoke execute on function public.places_lnglat(uuid[]) from anon, authenticated;
