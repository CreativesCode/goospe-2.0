-- 0018 — Incremento atómico de la cuota mensual del conserje.
-- concierge_quota tiene PK user_id (una fila por usuario); `month` guarda el mes vigente.
-- Si es el mismo mes → used+1; si cambió de mes → reinicia a 1 y actualiza el mes.
create or replace function public.increment_concierge_quota(p_user uuid, p_month date)
returns void
language sql security definer set search_path = public as $$
  insert into public.concierge_quota (user_id, month, used)
  values (p_user, p_month, 1)
  on conflict (user_id) do update set
    used  = case when public.concierge_quota.month = excluded.month
                 then public.concierge_quota.used + 1 else 1 end,
    month = excluded.month;
$$;

grant execute on function public.increment_concierge_quota(uuid, date) to authenticated, anon, service_role;
