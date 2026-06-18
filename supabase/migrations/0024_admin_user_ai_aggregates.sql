-- 0024 — Agregados admin para Usuarios y Gastos de IA.
-- Antes /admin/users descargaba favorites + reviews + event_rsvps + business_members ENTERAS
-- (para contar por usuario en JS) y /admin/ai-costs descargaba ai_usage ENTERA (totales, desgloses,
-- serie diaria y detalle, todo en JS). Estas funciones agregan en SQL. SECURITY DEFINER.

-- Actividad por usuario: una fila por usuario con actividad (los demás → 0 en JS).
create or replace function public.admin_user_activity()
returns table(user_id uuid, favorites bigint, reviews bigint, rsvps bigint, businesses bigint)
language sql stable security definer set search_path = public as $$
  with ids as (
    select user_id from favorites where user_id is not null
    union select user_id from reviews where user_id is not null
    union select user_id from event_rsvps where user_id is not null
    union select user_id from business_members where user_id is not null
  )
  select i.user_id,
    (select count(*) from favorites f        where f.user_id = i.user_id),
    (select count(*) from reviews r          where r.user_id = i.user_id),
    (select count(*) from event_rsvps v      where v.user_id = i.user_id),
    (select count(*) from business_members b where b.user_id = i.user_id)
  from ids i;
$$;

-- Totales de gasto IA en una ventana (p_days null = todo el histórico).
create or replace function public.admin_ai_usage_totals(p_days int default null)
returns table(usd numeric, tok_in bigint, tok_out bigint, tok_cached bigint, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_usd),0),
         coalesce(sum(input_tokens),0)::bigint,
         coalesce(sum(output_tokens),0)::bigint,
         coalesce(sum(cached_tokens),0)::bigint,
         count(*)
  from ai_usage
  where p_days is null or created_at >= now() - make_interval(days => p_days);
$$;

-- Desglose por feature / modelo / usuario en una sola llamada (dimension marca el grupo).
-- En el grupo 'user' se hace join a profiles para devolver el nombre directamente.
create or replace function public.admin_ai_usage_breakdown(p_days int default null)
returns table(dimension text, key text, usd numeric, tok bigint, n bigint)
language sql stable security definer set search_path = public as $$
  with u as (
    select * from ai_usage
    where p_days is null or created_at >= now() - make_interval(days => p_days)
  )
  select 'feature'::text, coalesce(feature,'—'),
         coalesce(sum(cost_usd),0), coalesce(sum(input_tokens+output_tokens),0)::bigint, count(*)
  from u group by feature
  union all
  select 'model'::text, coalesce(model,'—'),
         coalesce(sum(cost_usd),0), coalesce(sum(input_tokens+output_tokens),0)::bigint, count(*)
  from u group by model
  union all
  select 'user'::text,
         coalesce(p.display_name, case when u.user_id is null then 'Sistema / anónimo' else left(u.user_id::text,8) end),
         coalesce(sum(u.cost_usd),0), coalesce(sum(u.input_tokens+u.output_tokens),0)::bigint, count(*)
  from u left join profiles p on p.id = u.user_id
  group by u.user_id, p.display_name;
$$;

-- Costo por día en la ventana (ordenado asc; el front toma los últimos N).
create or replace function public.admin_ai_usage_daily(p_days int default null)
returns table(day date, usd numeric)
language sql stable security definer set search_path = public as $$
  select created_at::date as day, coalesce(sum(cost_usd),0) as usd
  from ai_usage
  where p_days is null or created_at >= now() - make_interval(days => p_days)
  group by created_at::date
  order by day;
$$;
