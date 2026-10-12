-- 0033 — Ola de seguridad (docs/15-analisis-brechas-y-qa.md §3.1: S1, S4, S5, S6, S7, S8, S9).
--
-- Idempotente: se puede correr dos veces sin error. Va en UNA sola transacción (begin/commit propios).
-- Estado real verificado contra la BD el 12-oct-2026 (hay drift respecto de las migraciones):
--   · PostGIS, pg_trgm, vector y unaccent viven en el schema `extensions`.
--   · is_admin/is_member/is_owner son SECURITY INVOKER (0007).
--   · anon y authenticated tienen TODOS los privilegios de tabla (default ACL de Supabase);
--     lo único que frena hoy es RLS, y RLS no restringe columnas.
--   · reviews.status tiene default 'pending' y ya existe check char_length(body) <= 500.
--   · businesses solo tiene: id, name, plan, stripe_customer_id, brand_voice, created_at.
--
-- Contrato con el código (no cambiar sin tocar src/):
--   1. Vista public.public_profiles(id, display_name, avatar_url) legible por anon/authenticated.
--   2. public.rate_limit_hit(p_key, p_window_seconds, p_max) → boolean, solo service_role.
--   3. profiles: authenticated solo actualiza display_name, avatar_url, home_city_id, birth_year.
--   4. businesses: authenticated solo actualiza name y brand_voice.
--   5. reviews: trigger que fija status, tope de largo y rate limit para roles no service_role.
--   6. Funciones internas (admin_*, recompute_*, place_metrics, …) solo service_role.
--
-- ORDEN DE DESPLIEGUE: aplicar PRIMERO esta migración y desplegar el código inmediatamente
-- después. Entre ambos pasos la versión vieja solo pierde los nombres ajenos en las reseñas.
-- Al revés (código antes que migración) no existe public_profiles ni rate_limit_hit: el
-- conserje sin sesión responde 429 (su rate limit falla cerrado) y /api/track queda sin tope.
-- Tras el deploy: revisar que en los logs no aparezca "[rate-limit] rpc falló".
-- DESPUÉS del deploy aplicar 0034_reviews_strict.sql (cierra S7 del todo).

begin;


-- =====================================================================================
-- a) PROFILES  (S1: auto-promoción a admin · S5: tabla completa legible sin sesión)
-- =====================================================================================

-- is_admin() vuelve a ser SECURITY DEFINER. Es obligatorio: la nueva política de lectura
-- de profiles la invoca, y como INVOKER leería profiles bajo esa misma política
-- (recursión infinita, 42P17). Solo devuelve el flag del propio auth.uid(), no filtra nada.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Debe seguir ejecutable por anon y authenticated: la evalúan políticas RLS de claims,
-- waitlist, region_jobs y coverage_requests con el rol del que consulta.
revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to anon, authenticated, service_role;

-- Lectura: solo el dueño de la fila o un admin (antes: using (true)).
drop policy if exists "read profiles"              on public.profiles;
drop policy if exists "read own profile or admin"  on public.profiles;
create policy "read own profile or admin" on public.profiles
  for select using (id = (select auth.uid()) or (select public.is_admin()));

-- Escritura por columnas. `revoke ... on table` quita también los privilegios por columna,
-- así que el bloque es re-ejecutable. is_admin y onboarding quedan solo para service_role
-- (src/actions/onboarding.ts y src/actions/admin-users.ts ya escriben con service role).
revoke insert, update on public.profiles from public, anon, authenticated;
grant  update (display_name, avatar_url, home_city_id, birth_year) on public.profiles to authenticated;
-- El insert propio lo hace el trigger handle_new_user; se deja la política existente pero
-- sin poder fijar is_admin/onboarding si alguna vez faltara la fila.
grant  insert (id, display_name, avatar_url, home_city_id, birth_year) on public.profiles to authenticated;

-- Vista pública mínima (nombre y avatar de los autores de reseñas aprobadas).
-- DECISIÓN security_invoker = false (a propósito): la vista se evalúa con los permisos de su
-- dueño (postgres, que no está sujeto a la RLS de profiles), porque DEBE devolver filas de
-- otros usuarios a anon y con security_invoker = true heredaría la política "dueño o admin"
-- y vendría vacía. La exposición queda acotada por la lista de columnas, no por RLS.
-- El advisor "security_definer_view" la va a marcar: es esperado.
create or replace view public.public_profiles
  with (security_invoker = false) as
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  -- Solo autores con algo publicado: no se expone el directorio completo de usuarios.
  -- Si se muestran asistentes a eventos desde el navegador, añadir el exists sobre event_rsvps.
  where exists (
    select 1 from public.reviews r where r.user_id = p.id and r.status = 'approved'
  );

comment on view public.public_profiles is
  'Proyección pública de profiles (id, display_name, avatar_url) de autores con reseña aprobada. security_invoker=false a propósito; nunca agregar columnas sensibles.';

-- CRÍTICO: el default ACL del schema da ALL a anon/authenticated sobre objetos nuevos, y una
-- vista simple es auto-actualizable. Sin este revoke, un anónimo podría hacer UPDATE/DELETE
-- de cualquier perfil A TRAVÉS de la vista (con permisos del dueño, saltando RLS).
revoke all on public.public_profiles from public, anon, authenticated, service_role;
grant  select on public.public_profiles to anon, authenticated, service_role;


-- =====================================================================================
-- b) BUSINESSES  (S6: el dueño podía cambiarse el plan)
-- =====================================================================================
-- Políticas actuales: "read own business" (is_member) y "update own business" (is_owner);
-- sin políticas de insert/delete (ya denegados por RLS). Se mantiene la política y se
-- acota por columnas: plan, stripe_customer_id, id y created_at solo service_role.
revoke update on public.businesses from public, anon, authenticated;
grant  update (name, brand_voice) on public.businesses to authenticated;


-- =====================================================================================
-- c) REVIEWS  (S7: reseña 'approved' directa por la API, sin tope ni rate limit)
-- =====================================================================================
-- Default de status. En la BD real era 'pending', pero la app desplegada inserta con el
-- cliente del usuario y status = 'approved' (auto-aprobación del piloto,
-- src/actions/reviews.ts). Como el trigger fija el status al default de la columna, con
-- 'pending' las reseñas nuevas dejarían de verse hasta moderarlas en /admin/content.
-- Se alinea el default con la política vigente del piloto para no romper el flujo.
-- MODO ESTRICTO (opcional, decisión de producto): borrar esta línea para volver a
-- 'pending'; entonces la server action debe insertar con service role tras el filtro de
-- groserías, o las reseñas quedarán pendientes de moderación.
alter table public.reviews alter column status set default 'approved';

-- El autor no puede borrar una reseña bloqueada por moderación: si pudiera, DELETE + INSERT
-- la devolvería a 'approved' con otro texto. Con esto el upsert cae en la rama UPDATE del
-- trigger, que conserva 'blocked'. (Borrar una bloqueada afecta 0 filas, sin error.)
drop policy if exists "delete review" on public.reviews;
create policy "delete review" on public.reviews for delete
  using (user_id = (select auth.uid()) and status is distinct from 'blocked');

create or replace function public.trg_reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role    text;
  v_expr    text;
  v_default text;
begin
  -- Rol del JWT que fijó PostgREST (mismo criterio que auth.role()). Al ser SECURITY
  -- DEFINER, current_user es el dueño de la función y no sirve para distinguir.
  begin
    v_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    );
  exception when others then
    v_role := 'invalid'; -- claims ilegibles: se trata como rol no confiable
  end;

  -- service_role, o sin JWT fuera de la API (postgres, pg_cron, SQL editor, migraciones):
  -- pasa sin guardas. PostgREST entra siempre con session_user = authenticator, que no cambia
  -- dentro de una función definer: una petición de la API sin rol reconocible NO es de confianza.
  if v_role = 'service_role' or (v_role is null and session_user <> 'authenticator') then
    return new;
  end if;

  if char_length(coalesce(new.body, '')) > 1000 then
    raise exception 'La reseña es muy larga' using errcode = '23514';
  end if;

  -- Default de la columna status: es el estado con que entra lo que NO pasó por el servidor.
  select pg_get_expr(d.adbin, d.adrelid) into v_expr
  from pg_catalog.pg_attrdef d
  join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.reviews'::regclass and a.attname = 'status';
  if v_expr is not null then
    execute 'select (' || v_expr || ')::text' into v_default;
  end if;
  v_default := coalesce(v_default, 'pending');

  if tg_op = 'UPDATE' then
    -- El autor no modera su propia reseña ni la mueve de lugar o de fecha. Si cambia el texto
    -- de una aprobada, vuelve al default (sin efecto mientras sea 'approved'; con 0034 queda
    -- 'pending' porque ese texto no pasó el filtro de groserías del servidor).
    if old.status = 'approved' and new.body is distinct from old.body then
      new.status   := v_default;
    else
      new.status   := old.status;
    end if;
    new.id         := old.id;
    new.user_id    := old.user_id;
    new.place_id   := old.place_id;
    new.created_at := old.created_at;
    return new;
  end if;

  -- INSERT: status = default de la columna (se ignora lo que mande el cliente).
  new.status     := v_default;
  new.created_at := now(); -- la fecha la pone el servidor

  -- Rate limit: 5 reseñas NUEVAS por usuario en 10 minutos. El upsert de la app dispara
  -- este BEFORE INSERT también al editar; si ya existe la reseña de ese lugar es una
  -- edición (unique user_id+place_id) y no cuenta.
  if not exists (
    select 1 from public.reviews r
    where r.user_id = new.user_id and r.place_id = new.place_id
  ) then
    -- Contador persistente (no filas vivas): borrar reseñas no reinicia el límite.
    -- Misma clave que usa src/actions/reviews.ts.
    if not public.rate_limit_hit('review:' || new.user_id::text, 600, 5) then
      raise exception 'Vas muy rápido. Intenta de nuevo en unos minutos.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end$$;

revoke execute on function public.trg_reviews_guard() from public, anon, authenticated;

drop trigger if exists trg_reviews_guard on public.reviews;
create trigger trg_reviews_guard
  before insert or update on public.reviews
  for each row execute function public.trg_reviews_guard();


-- =====================================================================================
-- e) admin_save_place: search_path con PostGIS
-- =====================================================================================
-- Hoy falla con 'type "geography" does not exist': su search_path era solo `public` y
-- PostGIS está en `extensions`. Firma real tomada de pg_proc.
alter function public.admin_save_place(
  uuid, text, text, text, text, text, text, text, text, text,
  smallint, text[], double precision, double precision, boolean, bigint[]
) set search_path = public, extensions;


-- =====================================================================================
-- f) RATE LIMITING  (S8, S11: conserje anónimo y /api/track sin límite)
-- =====================================================================================
-- Ventana fija por clave. Solo se usa desde el servidor con service role.
create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  expires_at   timestamptz not null,
  primary key (key, window_start)
);
create index if not exists rate_limits_expires_at_idx on public.rate_limits (expires_at);

-- RLS activo y SIN políticas: nadie llega por la API; service_role hace bypass.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

-- Devuelve true si la petición está PERMITIDA (contador <= p_max tras incrementar).
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_key is null or p_key = '' or char_length(p_key) > 256 then
    raise exception 'rate_limit_hit: clave inválida' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_max is null or p_max < 0 then
    raise exception 'rate_limit_hit: parámetros inválidos' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Atómico: una sola sentencia incrementa y devuelve el contador de la ventana.
  insert into public.rate_limits as rl (key, window_start, hits, expires_at)
  values (p_key, v_window, 1, v_window + make_interval(secs => p_window_seconds * 2))
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  -- Limpieza barata: ~1 de cada 100 llamadas borra ventanas vencidas (usa el índice).
  if random() < 0.01 then
    delete from public.rate_limits where expires_at < now();
  end if;

  return v_hits <= p_max;
end$$;

-- Se cierra aquí mismo (no solo en el bloque final): por el default ACL nace ejecutable por anon.
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant  execute on function public.rate_limit_hit(text, int, int) to service_role;


-- =====================================================================================
-- d) + g) EXECUTE de funciones internas → solo service_role  (S4, S9)
-- =====================================================================================
-- Se recorre pg_proc por NOMBRE para cubrir cualquier firma/sobrecarga.
--
-- RESTRINGIDAS (toda llamada del código debe ir con createAdminClient tras validar permiso):
--   admin_*  (ai_usage_breakdown/daily/summary/totals, coverage_zones, interaction_counts,
--             interaction_daily, places_with_photo, save_place, top_places, user_activity)
--                                → páginas /admin con service role
--   assign_nearest_city          → ETL con service key (hace UPDATE masivo)
--   enqueue_event_reminders      → pg_cron como postgres (el dueño conserva EXECUTE)
--   recompute_trending           → pg_cron como postgres
--   recompute_place_stats        → src/actions/moderation.ts (admin) y trigger definer
--   increment_concierge_quota    → src/app/api/concierge/route.ts (admin) · firma (uuid, date)
--   place_metrics                → src/actions/reports.ts y panel/[placeId] (admin)
--   rate_limit_hit               → server (admin)
--   handle_new_user, ensure_place_stats, trg_favorites_count, trg_reviews_stats,
--   trg_reviews_guard            → funciones de trigger: dispararse no requiere EXECUTE
--
-- ABIERTAS a propósito (NO tocar aquí):
--   get_feed, get_feed_events    → navegador (use-feed.ts), invoker, sujetas a RLS
--   resolve_coverage             → navegador (features/coverage), definer de solo lectura
--   event_gender_stats           → navegador y páginas con cliente de usuario; solo conteos
--   is_admin, is_member, is_owner→ las evalúan políticas RLS con el rol del que consulta
--   places_lnglat                → places/[slug] con cliente de usuario, invoker
--   search_places, match_places  → invoker (RLS aplica); hoy se llaman con service role
--   ping                         → keepalive de GitHub Actions con la anon key
--   touch_updated_at             → trigger invoker, inocuo
do $$
declare
  v_names text[] := array[
    'assign_nearest_city',
    'enqueue_event_reminders',
    'recompute_trending',
    'recompute_place_stats',
    'increment_concierge_quota',
    'place_metrics',
    'rate_limit_hit',
    'handle_new_user',
    'ensure_place_stats',
    'trg_favorites_count',
    'trg_reviews_stats',
    'trg_reviews_guard'
  ];
  r record;
  v_name text;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.proname = any (v_names) or p.proname like 'admin\_%')
      -- nunca funciones propiedad de una extensión
      and not exists (select 1 from pg_catalog.pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  foreach v_name in array v_names loop
    if not exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
    ) then
      raise notice '0033: la función public.% no existe (nada que restringir)', v_name;
    end if;
  end loop;
end$$;

commit;


-- =====================================================================================
-- VERIFICACIÓN (solo lectura; correr tras aplicar)
-- =====================================================================================
/*
-- 1) Funciones: ninguna SECURITY DEFINER interna ejecutable por anon/authenticated.
--    Esperado con anon/auth = true SOLO: event_gender_stats, is_admin, resolve_coverage.
select p.oid::regprocedure as sig, p.prosecdef,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth,
       has_function_privilege('service_role', p.oid, 'execute')  as srv
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by p.prosecdef desc, 1;

-- 2) Las que usa el navegador siguen abiertas (todas deben dar true).
select f, has_function_privilege('anon', f, 'execute') as anon,
          has_function_privilege('authenticated', f, 'execute') as auth
from unnest(array[
  'public.get_feed(double precision,double precision,integer,integer,integer)',
  'public.get_feed_events(double precision,double precision,integer,integer)',
  'public.resolve_coverage(double precision,double precision)',
  'public.event_gender_stats(uuid[])',
  'public.places_lnglat(uuid[])',
  'public.is_admin()', 'public.is_member(uuid)', 'public.is_owner(uuid)', 'public.ping()'
]) f;

-- 3) Columnas actualizables por rol.
--    Esperado: profiles/authenticated = avatar_url,birth_year,display_name,home_city_id;
--              businesses/authenticated = brand_voice,name; ninguna fila para anon.
select table_name, grantee, privilege_type, string_agg(column_name, ',' order by column_name) as cols
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('profiles', 'businesses')
  and grantee in ('anon', 'authenticated') and privilege_type in ('UPDATE', 'INSERT')
group by 1, 2, 3 order by 1, 2, 3;

-- 4) Políticas de profiles (select = dueño o admin) y vista pública.
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'profiles';
select c.relname, c.reloptions, pg_get_userbyid(c.relowner) as owner
from pg_class c where c.oid = 'public.public_profiles'::regclass;
--    Esperado: SOLO SELECT para anon, authenticated y service_role.
select grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'public_profiles' group by 1;

-- 5) is_admin es definer (evita recursión en la política de profiles).
select prosecdef, proconfig from pg_proc where oid = 'public.is_admin()'::regprocedure;

-- 6) Prueba de RLS como anónimo (se revierte sola). Esperado: profiles 0 filas,
--    public_profiles = nº de autores con reseña aprobada, y los dos últimos fallan con 42501.
begin;
  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) as profiles_visibles from public.profiles;
  select count(*) as public_profiles_visibles from public.public_profiles;
  -- select * from public.admin_user_activity();                         -- debe fallar
  -- select public.increment_concierge_quota(gen_random_uuid(), now()::date); -- debe fallar
rollback;

-- 7) Reviews: trigger presente, antes del touch, y default de status.
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.reviews'::regclass and not tgisinternal order by tgname;
select column_default from information_schema.columns
where table_schema = 'public' and table_name = 'reviews' and column_name = 'status';

-- 8) admin_save_place con PostGIS en el search_path. Esperado: {search_path=public, extensions}
select proconfig from pg_proc where proname = 'admin_save_place';

-- 9) Rate limit: tabla con RLS y sin políticas; función solo service_role.
select relrowsecurity,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'rate_limits') as policies
from pg_class where oid = 'public.rate_limits'::regclass;
select has_function_privilege('anon', 'public.rate_limit_hit(text,integer,integer)', 'execute') as anon,
       has_function_privilege('service_role', 'public.rate_limit_hit(text,integer,integer)', 'execute') as srv;
--    Prueba funcional (se revierte): t, t, f
begin;
  select public.rate_limit_hit('verif:0033', 60, 2), public.rate_limit_hit('verif:0033', 60, 2),
         public.rate_limit_hit('verif:0033', 60, 2);
rollback;
*/
