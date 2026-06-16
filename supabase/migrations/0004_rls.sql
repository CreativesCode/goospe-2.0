-- 0004 — Row Level Security (doc 05 §3)
-- service_role siempre hace bypass de RLS; estas políticas son para anon/authenticated.

-- ---------- helpers (security definer para evitar recursión en políticas) ----------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_member(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = b and user_id = auth.uid());
$$;

create or replace function public.is_owner(b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.business_members
                 where business_id = b and user_id = auth.uid() and role = 'owner');
$$;

-- ---------- habilitar RLS en todas las tablas ----------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end$$;

-- ---------- lectura pública ----------
create policy "read cities"          on public.cities          for select using (true);
create policy "read categories"      on public.categories      for select using (true);
create policy "read place_categories" on public.place_categories for select using (true);
create policy "read place_stats"     on public.place_stats     for select using (true);
create policy "read profiles"        on public.profiles        for select using (true);
create policy "read places"          on public.places          for select using (is_published = true);
create policy "read place_photos"    on public.place_photos     for select using (status = 'approved');
create policy "read events"          on public.events          for select using (status = 'approved');

-- ---------- profiles ----------
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid());

-- ---------- favoritos / interacciones / rsvp / quota (propias) ----------
create policy "own favorites"     on public.favorites     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rsvps"         on public.event_rsvps   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "insert own inter"  on public.interactions  for insert with check (user_id = auth.uid());
create policy "read own inter"    on public.interactions  for select using (user_id = auth.uid());
create policy "read own quota"    on public.concierge_quota for select using (user_id = auth.uid());
create policy "own devices"       on public.devices       for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- reseñas ----------
create policy "read reviews"   on public.reviews for select using (status = 'approved' or user_id = auth.uid());
create policy "insert review"  on public.reviews for insert with check (user_id = auth.uid());
create policy "update review"  on public.reviews for update using (user_id = auth.uid())  with check (user_id = auth.uid());
create policy "delete review"  on public.reviews for delete using (user_id = auth.uid());

-- ---------- taste_profiles (lee el dueño; lo escribe la IA / service role) ----------
create policy "read own taste" on public.taste_profiles for select using (user_id = auth.uid());

-- ---------- B2B (por membresía) ----------
create policy "read own business"   on public.businesses       for select using (public.is_member(id));
create policy "update own business" on public.businesses       for update using (public.is_owner(id));
create policy "read own membership" on public.business_members for select using (user_id = auth.uid());
create policy "read biz reports"    on public.business_reports for select using (public.is_member(business_id));
create policy "read biz boosts"     on public.boosts           for select using (public.is_member(business_id));
create policy "read biz subs"       on public.subscriptions    for select using (public.is_member(business_id));

-- ---------- claims ----------
create policy "read own claims"   on public.claims for select using (user_id = auth.uid() or public.is_admin());
create policy "insert own claim"  on public.claims for insert with check (user_id = auth.uid());
create policy "admin update claim" on public.claims for update using (public.is_admin());

-- NOTA: ai_usage, feed_config, moderation_queue, audit_log, category_mappings y las
-- escrituras de subscriptions/boosts/business_reports/places/events quedan sin política
-- para anon/authenticated → accesibles solo vía service_role (route handlers / ETL).
