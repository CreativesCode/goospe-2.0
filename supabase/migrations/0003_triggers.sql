-- 0003 — Triggers, funciones de agregados y jobs (doc 05 §2)

-- ---------- profile on-signup (doc 06 Fase 0) ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- place_stats: fila por lugar ----------
create or replace function public.ensure_place_stats()
returns trigger language plpgsql as $$
begin
  insert into public.place_stats (place_id) values (new.id) on conflict do nothing;
  return new;
end$$;

create trigger trg_place_stats_init
  after insert on public.places
  for each row execute function public.ensure_place_stats();

-- ---------- reviews → place_stats (distribución 1-5 + promedio) ----------
create or replace function public.recompute_place_stats(p_place uuid)
returns void language sql as $$
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

create or replace function public.trg_reviews_stats()
returns trigger language plpgsql as $$
begin
  perform public.recompute_place_stats(coalesce(new.place_id, old.place_id));
  return null;
end$$;

create trigger trg_reviews_stats
  after insert or update or delete on public.reviews
  for each row execute function public.trg_reviews_stats();

-- ---------- favorites → saves_count ----------
create or replace function public.trg_favorites_count()
returns trigger language plpgsql as $$
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

create trigger trg_favorites_count
  after insert or delete on public.favorites
  for each row execute function public.trg_favorites_count();

-- ---------- updated_at touch ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end$$;

create trigger trg_places_touch  before update on public.places  for each row execute function public.touch_updated_at();
create trigger trg_reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

-- ---------- trending + views_30d (pg_cron diario) ----------
create or replace function public.recompute_trending()
returns void language sql as $$
  -- vistas de los últimos 30 días desde interactions
  update public.place_stats s set views_30d = coalesce(v.cnt, 0)
  from public.places p
  left join (
    select place_id, count(*) cnt
    from public.interactions
    where kind in ('view_card', 'view_detail') and created_at > now() - interval '30 days'
    group by place_id
  ) v on v.place_id = p.id
  where s.place_id = p.id;

  -- trending bayesiano: rating de reseñas <=30 días con prior global
  with r as (
    select place_id, count(*) n, avg(rating)::numeric a
    from public.reviews
    where status = 'approved' and created_at > now() - interval '30 days'
    group by place_id
  ), prior as (
    select coalesce(avg(rating), 3.5)::numeric m from public.reviews where status = 'approved'
  )
  update public.place_stats s set trending_score =
    case when r.n is null then 0
         else (r.n::numeric / (r.n + 5)) * r.a + (5::numeric / (r.n + 5)) * (select m from prior)
    end
  from public.places p
  left join r on r.place_id = p.id
  where s.place_id = p.id;
$$;

select cron.schedule('recompute-trending-daily', '17 4 * * *', $$select public.recompute_trending();$$);

-- NOTA: el enriquecimiento IA de places (source='osm') NO usa trigger: el worker ETL
-- (Fase 1) hace polling de `where source='osm' and ai_enriched_at is null`. El batch
-- semanal de perfiles de gusto / informes B2B se programará en Fase 3-4 con pg_cron.
