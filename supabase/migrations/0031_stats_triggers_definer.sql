-- 0031 — Fix: los triggers de agregados deben ser SECURITY DEFINER.
--
-- BUG (revisión 14-jul): "Guardados" no se almacenaba. Causa raíz:
--   `place_stats` tiene RLS activo con SOLO política de lectura (0004_rls.sql:36),
--   sin política de INSERT/UPDATE para `authenticated`. Los triggers de agregados
--   (`trg_favorites_count`, `recompute_place_stats`, `ensure_place_stats`) se
--   definieron SECURITY INVOKER (0003_triggers.sql), así que al guardar un favorito
--   el trigger intenta `insert into place_stats ... on conflict do update` como el
--   rol `authenticated` → viola RLS (42501) → se hace ROLLBACK del INSERT en
--   `favorites` completo. El cliente hace la escritura fire-and-forget (`void`, sin
--   .catch en useFavorites.ts), así que el error se traga y la UI muestra "Guardado"
--   aunque la fila nunca aterrizó → la lista /saved queda vacía.
--   (Las reseñas "funcionaban" solo porque su recompute usa INSERT ON CONFLICT DO
--    NOTHING + UPDATE, que RLS filtra a 0 filas en silencio en vez de lanzar error;
--    efecto colateral: rating/reviews_count tampoco se estaban actualizando.)
--
-- FIX: pasar las funciones de agregados a SECURITY DEFINER (como handle_new_user),
-- para que mantengan `place_stats` sin depender de una política RLS de escritura.
-- No se abre ninguna política de escritura pública sobre place_stats.

-- ensure_place_stats: crea la fila por lugar (se dispara al insertar places).
create or replace function public.ensure_place_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.place_stats (place_id) values (new.id) on conflict do nothing;
  return new;
end$$;

-- recompute_place_stats: recalcula distribución/promedio de reseñas aprobadas.
create or replace function public.recompute_place_stats(p_place uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.place_stats (place_id) values (p_place) on conflict do nothing;
  update public.place_stats s set
    votes_1 = c.v1, votes_2 = c.v2, votes_3 = c.v3, votes_4 = c.v4, votes_5 = c.v5,
    reviews_count = c.n,
    rating = case when c.n > 0 then round(c.s::numeric / c.n, 2) else 0 end
  from (
    select
      count(*) filter (where rating = 1) v1,
      count(*) filter (where rating = 2) v2,
      count(*) filter (where rating = 3) v3,
      count(*) filter (where rating = 4) v4,
      count(*) filter (where rating = 5) v5,
      count(*) n, coalesce(sum(rating), 0) s
    from public.reviews
    where place_id = p_place and status = 'approved'
  ) c
  where s.place_id = p_place;
$$;

-- trg_favorites_count: mantiene saves_count (era el que rompía los favoritos).
create or replace function public.trg_favorites_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.place_stats (place_id, saves_count) values (new.place_id, 1)
      on conflict (place_id) do update set saves_count = public.place_stats.saves_count + 1;
  elsif tg_op = 'DELETE' then
    update public.place_stats set saves_count = greatest(saves_count - 1, 0)
      where place_id = old.place_id;
  end if;
  return null;
end$$;

-- Como en 0007: al ser SECURITY DEFINER, revocar EXECUTE de anon/authenticated para
-- que el advisor no las marque. Los triggers NO necesitan EXECUTE para dispararse.
revoke execute on function public.ensure_place_stats() from anon, authenticated;
revoke execute on function public.recompute_place_stats(uuid) from anon, authenticated;
revoke execute on function public.trg_favorites_count() from anon, authenticated;
