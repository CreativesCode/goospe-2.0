-- 0023 — RPCs de agregación para el panel admin.
-- Antes el dashboard y /admin/stats descargaban la tabla `interactions` ENTERA (una fila por
-- view_card → crece sin techo) y agregaban en JS. Estas funciones agregan en SQL y devuelven
-- solo los totales. El admin usa service_role (bypassa RLS); aun así son SECURITY DEFINER.

-- Conteo de interacciones por tipo + ventanas 30d / 7d.
create or replace function public.admin_interaction_counts()
returns table(kind text, total bigint, d30 bigint, d7 bigint)
language sql stable security definer set search_path = public as $$
  select kind,
         count(*) as total,
         count(*) filter (where created_at >= now() - interval '30 days') as d30,
         count(*) filter (where created_at >= now() - interval '7 days')  as d7
  from interactions
  group by kind;
$$;

-- Interacciones por día (últimos p_days días), rellenando días sin datos con 0.
create or replace function public.admin_interaction_daily(p_days int default 14)
returns table(day date, n bigint)
language sql stable security definer set search_path = public as $$
  with days as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as day
  )
  select d.day, count(i.kind) as n
  from days d
  left join interactions i on i.created_at::date = d.day
  group by d.day
  order by d.day;
$$;

-- Top lugares por nº de interacciones (opcionalmente solo "de valor").
create or replace function public.admin_top_places(p_limit int default 5, p_value_only boolean default false)
returns table(id uuid, name text, slug text, n bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.slug, count(*) as n
  from interactions i
  join places p on p.id = i.place_id
  where i.place_id is not null
    and (not p_value_only or i.kind in ('view_detail','save','directions','share'))
  group by p.id, p.name, p.slug
  order by n desc
  limit p_limit;
$$;

-- Resumen de gasto IA: total / 30d / 7d.
create or replace function public.admin_ai_usage_summary()
returns table(scope text, usd numeric, tokens bigint, calls bigint)
language sql stable security definer set search_path = public as $$
  select 'total'::text, coalesce(sum(cost_usd),0), coalesce(sum(input_tokens+output_tokens),0)::bigint, count(*) from ai_usage
  union all
  select 'd30', coalesce(sum(cost_usd),0), coalesce(sum(input_tokens+output_tokens),0)::bigint, count(*) from ai_usage where created_at >= now() - interval '30 days'
  union all
  select 'd7',  coalesce(sum(cost_usd),0), coalesce(sum(input_tokens+output_tokens),0)::bigint, count(*) from ai_usage where created_at >= now() - interval '7 days';
$$;

-- Nº de lugares con al menos una foto aprobada (distinct).
create or replace function public.admin_places_with_photo()
returns bigint
language sql stable security definer set search_path = public as $$
  select count(distinct place_id) from place_photos where status = 'approved';
$$;
