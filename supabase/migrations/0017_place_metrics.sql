-- 0017 — Métricas de un lugar para el panel del dueño (sobre `interactions`).
-- Devuelve conteo por tipo de interacción en una ventana de días. SECURITY DEFINER para
-- que el dueño pueda ver los agregados de SU lugar aunque RLS de interactions sea read-own;
-- la validación de que el usuario es dueño del place se hace en la server action antes de llamar.
create or replace function public.place_metrics(p_place_id uuid, p_days int default 30)
returns table (kind text, n bigint)
language sql stable security definer set search_path = public as $$
  select kind, count(*) as n
  from public.interactions
  where place_id = p_place_id
    and created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by kind;
$$;

grant execute on function public.place_metrics(uuid, int) to authenticated;
