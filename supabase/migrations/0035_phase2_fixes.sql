-- 0035 — Fase 2 "que lo que hay funcione" (docs/15-analisis-brechas-y-qa.md §3.2–§3.4).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Las funciones se redefinen partiendo de su definición REAL en la BD (pg_get_functiondef,
-- 12-oct-2026), no de los archivos del repo (hay drift).
--
-- Qué hace:
--   a) P1/P6  FKs con `on delete`: borrar un evento con RSVP/boost y des-reclamar sin residuos.
--   b) P2     enqueue_event_reminders usa la zona de la CIUDAD del lugar (no America/Santiago).
--   c) P3+F5  get_feed / get_feed_events: SECURITY DEFINER (el boost lo ve todo el mundo),
--             orden estable entre páginas y columnas nuevas `hours` / `timezone`.
--   d) F12    search_places: sin tildes, busca también en tags, vibe_line y categoría; el
--             filtro de precio excluye los lugares sin precio; devuelve `timezone`.
--   e) F2     admin_save_place versionada: ciudad por parámetro o la más cercana (no city_id = 1).
--   f)        cities.timezone: default neutro.
--
-- Contrato con el código (src/):
--   · get_feed            + columnas `hours jsonb`, `timezone text`   (use-feed.ts las trata como opcionales)
--   · get_feed_events     + columna  `timezone text`                  (EventFeedCard: opcional)
--   · search_places       + columna  `timezone text`                  (api/search: opcional)
--   · admin_save_place    + parámetro `p_city_id bigint default null` (admin-places.ts solo lo
--                           envía si el admin eligió ciudad)
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después. El código nuevo funciona sin la
-- migración salvo: boost visible para todos, "abierto ahora" en el feed, búsqueda sin tildes /
-- por etiquetas, hora de recordatorios por ciudad y elegir ciudad al crear un lugar en /admin.
-- El código VIEJO sigue funcionando con la migración aplicada (solo se añaden columnas y un
-- parámetro con default).

begin;


-- =====================================================================================
-- a) CLAVES FORÁNEAS  (P1: evento con RSVP no se podía eliminar · P6: des-reclamar)
-- =====================================================================================
-- Estado real: interactions.event_id, boosts.event_id, boosts.business_id, boosts.place_id,
-- business_reports.business_id y events.business_id NO tenían `on delete`.

-- La telemetría sobrevive al evento (sigue contando para el lugar), sin apuntar a él.
alter table public.interactions drop constraint if exists interactions_event_id_fkey;
alter table public.interactions
  add constraint interactions_event_id_fkey
  foreign key (event_id) references public.events(id) on delete set null;

-- Un boost de un evento / lugar / negocio borrado no tiene sentido: se va con él.
alter table public.boosts drop constraint if exists boosts_event_id_fkey;
alter table public.boosts
  add constraint boosts_event_id_fkey
  foreign key (event_id) references public.events(id) on delete cascade;

alter table public.boosts drop constraint if exists boosts_place_id_fkey;
alter table public.boosts
  add constraint boosts_place_id_fkey
  foreign key (place_id) references public.places(id) on delete cascade;

alter table public.boosts drop constraint if exists boosts_business_id_fkey;
alter table public.boosts
  add constraint boosts_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete cascade;

-- Los informes IA son del negocio: se borran con él (antes dejaban el negocio huérfano).
alter table public.business_reports drop constraint if exists business_reports_business_id_fkey;
alter table public.business_reports
  add constraint business_reports_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete cascade;

-- Un evento no bloquea el borrado del negocio (unclaimPlace ya borra los del lugar; esto
-- cubre cualquier otro que quedara apuntando).
alter table public.events drop constraint if exists events_business_id_fkey;
alter table public.events
  add constraint events_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete set null;

-- subscriptions.business_id se deja SIN `on delete` a propósito: un negocio con suscripción
-- no debe poder borrarse en silencio.


-- =====================================================================================
-- f) cities.timezone: default neutro
-- =====================================================================================
-- El default era 'America/Havana' (herencia del legacy). Las 28 ciudades ya tienen su zona
-- real (America/Santiago, Atlantic/Canary, Europe/Madrid) y los cargadores la fijan con
-- tz-lookup; 'UTC' es el mismo valor que usan ellos cuando no pueden resolverla.
alter table public.cities alter column timezone set default 'UTC';


-- =====================================================================================
-- b) RECORDATORIOS DE EVENTO con la hora de la ciudad  (P2)
-- =====================================================================================
create or replace function public.enqueue_event_reminders()
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, event_id)
  select r.user_id, 'event_reminder',
         'Hoy: ' || e.name,
         'En ' || p.name || ' · ' || to_char(e.starts_at at time zone c.timezone, 'HH24:MI') || ' h',
         e.id
  from public.events e
  join public.event_rsvps r on r.event_id = e.id and r.status = 'going'
  join public.places p on p.id = e.place_id
  join public.cities c on c.id = p.city_id
  where e.status = 'approved'
    and e.starts_at between now() and now() + interval '14 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r.user_id and n.event_id = e.id and n.kind = 'event_reminder'
    );
$$;

-- Interna (pg_cron como postgres): solo service_role, como en 0033.
revoke execute on function public.enqueue_event_reminders() from public, anon, authenticated;
grant  execute on function public.enqueue_event_reminders() to service_role;


-- =====================================================================================
-- c) FEED  (P3: boost visible para todos · F5: paginación estable · "abierto ahora")
-- =====================================================================================
-- DECISIÓN P3 — SECURITY DEFINER en vez de una política de lectura pública sobre `boosts`:
--   · Con la política, cualquiera podría leer por la API REST la tabla de boosts activos
--     (business_id, amount_usd, fechas): datos comerciales de los negocios.
--   · Con definer, `boosts` sigue cerrada (solo miembros) y lo único que sale es el booleano
--     `boosted` de cada card, que es justo lo que el feed debe mostrar.
--   · El resto de lo que leen ya era público o está filtrado en la propia consulta:
--     places (is_published), place_photos (status = 'approved'), place_stats, categories,
--     cities. El perfil de gusto se sigue leyendo SOLO del propio auth.uid().
-- Son de solo lectura (STABLE), no aceptan SQL dinámico y fijan search_path.
-- Siguen abiertas a anon y authenticated: las llama el navegador (use-feed.ts).
--
-- Cambia el tipo de retorno → drop + create (no se puede con create or replace). Va dentro
-- de la transacción: nunca hay un instante sin función.

drop function if exists public.get_feed(double precision, double precision, integer, integer, integer);

create function public.get_feed(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid, slug text, name text, vibe_line text, description text, tags text[],
  price_level smallint, lat double precision, lng double precision, distance_m double precision,
  rating numeric, reviews_count integer, photo_url text, category_emoji text, category_name text,
  boosted boolean, score double precision,
  hours jsonb, timezone text
)
language sql stable security definer set search_path = public, extensions
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  taste as (
    select embedding from public.taste_profiles where user_id = auth.uid()
  ),
  active_boosts as (
    select distinct place_id from public.boosts
    where status = 'active' and now() between starts_at and coalesce(ends_at, now())
      and place_id is not null
  ),
  cand as (
    select p.id, p.slug, p.name, p.vibe_line, p.description, p.tags, p.price_level,
           p.embedding, p.hours, p.city_id,
           ST_Y(p.location::geometry) as lat,
           ST_X(p.location::geometry) as lng,
           ST_Distance(p.location, (select g from me)) as dist_m
    from public.places p
    where p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and ST_DWithin(p.location, (select g from me), p_radius_m)
  )
  select
    c.id, c.slug, c.name, c.vibe_line, c.description, c.tags, c.price_level,
    c.lat, c.lng, c.dist_m as distance_m,
    coalesce(st.rating, 0) as rating,
    coalesce(st.reviews_count, 0) as reviews_count,
    (select pp.url from public.place_photos pp
       where pp.place_id = c.id and pp.status = 'approved'
       order by (pp.source = 'google') desc, pp.id
       limit 1) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    (c.id in (select place_id from active_boosts)) as boosted,
    ( 0.45 * exp(-c.dist_m / 2500.0)
    + 0.25 * coalesce(st.trending_score, 0) / 5.0
    + 0.10 * (hashtextextended(c.id::text, 0) & 1023)::double precision / 1023.0
    + case when (select embedding from taste) is not null and c.embedding is not null
           then 0.20 * (1 - (c.embedding <=> (select embedding from taste)))
           else 0.0 end
    + case when c.id in (select place_id from active_boosts) then 1.0 else 0.0 end
    ) as score,
    c.hours,
    ci.timezone
  from cand c
  left join public.cities ci on ci.id = c.city_id
  left join public.place_stats st on st.place_id = c.id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = c.id
    order by pc.category_id
    limit 1
  ) cc on true
  -- c.id como desempate final: sin él, dos lugares con el mismo score y distancia (mismo
  -- punto) podían intercambiarse entre páginas y repetirse o perderse al paginar.
  order by score desc, c.dist_m asc, c.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_feed(double precision, double precision, integer, integer, integer) from public;
grant  execute on function public.get_feed(double precision, double precision, integer, integer, integer)
  to anon, authenticated, service_role;


drop function if exists public.get_feed_events(double precision, double precision, integer, integer);

create function public.get_feed_events(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 25000,
  p_limit integer default 10
)
returns table(
  id uuid, name text, description text, image_url text, starts_at timestamptz,
  place_id uuid, place_slug text, place_name text,
  lat double precision, lng double precision, distance_m double precision,
  photo_url text, boosted boolean,
  timezone text
)
language sql stable security definer set search_path = public, extensions
as $$
  with me as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  active_boosts as (
    select distinct event_id from public.boosts
    where status = 'active' and now() between starts_at and coalesce(ends_at, now())
      and event_id is not null
  )
  select
    e.id, e.name, e.description, e.image_url, e.starts_at,
    p.id as place_id, p.slug as place_slug, p.name as place_name,
    ST_Y(p.location::geometry) as lat,
    ST_X(p.location::geometry) as lng,
    ST_Distance(p.location, (select g from me)) as distance_m,
    coalesce(
      e.image_url,
      (select pp.url from public.place_photos pp
        where pp.place_id = p.id and pp.status = 'approved'
        order by (pp.source = 'google') desc, pp.id limit 1)
    ) as photo_url,
    (e.id in (select event_id from active_boosts)) as boosted,
    ci.timezone
  from public.events e
  join public.places p on p.id = e.place_id
  left join public.cities ci on ci.id = p.city_id
  where e.status = 'approved'
    and e.starts_at >= now() - interval '3 hours'
    and p.is_published
    and p.business_status is distinct from 'CLOSED_PERMANENTLY'
    and ST_DWithin(p.location, (select g from me), p_radius_m)
  order by (e.id in (select event_id from active_boosts)) desc, e.starts_at asc, e.id
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.get_feed_events(double precision, double precision, integer, integer) from public;
grant  execute on function public.get_feed_events(double precision, double precision, integer, integer)
  to anon, authenticated, service_role;


-- =====================================================================================
-- d) BÚSQUEDA  (F12)
-- =====================================================================================
-- Sigue siendo SECURITY INVOKER (RLS aplica; todo lo que lee es público) y abierta, como
-- estaba. unaccent, pg_trgm y PostGIS viven en `extensions`.
--   · "cerveza" / "hamburguesa" / "cafe": se compara sin tildes ni mayúsculas, y además del
--     nombre se mira vibe_line, tags y nombre de la categoría.
--   · p_max_price es un tope ("hasta $$"): con filtro activo ya NO entran los lugares sin precio.
--   · Los comodines de LIKE que escriba el usuario (% _ \) se escapan.
drop function if exists public.search_places(text, bigint, integer, double precision, double precision, integer, integer);

create function public.search_places(
  p_q text default null,
  p_category bigint default null,
  p_max_price integer default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 25000,
  p_limit integer default 40
)
returns table(
  id uuid, slug text, name text, vibe_line text, price_level smallint, distance_m double precision,
  hours jsonb, photo_url text, category_emoji text, category_name text, rating numeric,
  timezone text
)
language sql stable set search_path = public, extensions
as $$
  with me as (
    select case when p_lat is null or p_lng is null then null
                else ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography end as g
  ),
  q as (
    select t.v,
           '%' || replace(replace(replace(t.v, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from (select nullif(lower(extensions.unaccent(btrim(coalesce(p_q, '')))), '') as v) t
  ),
  base as (
    select p.*, lower(extensions.unaccent(p.name)) as name_n
    from public.places p
    where p.is_published
      and p.business_status is distinct from 'CLOSED_PERMANENTLY'
      and (p_max_price is null or p.price_level <= p_max_price)
      and (p_category is null or exists (
            select 1 from public.place_categories pc
            where pc.place_id = p.id and pc.category_id = p_category))
      and ((select g from me) is null or ST_DWithin(p.location, (select g from me), p_radius_m))
  )
  select
    p.id, p.slug, p.name, p.vibe_line, p.price_level,
    case when (select g from me) is null then null
         else ST_Distance(p.location, (select g from me)) end as distance_m,
    p.hours,
    (select pp.url from public.place_photos pp
       where pp.place_id = p.id and pp.status = 'approved'
       order by (pp.source = 'google') desc, pp.id limit 1) as photo_url,
    cc.emoji as category_emoji,
    cc.name  as category_name,
    coalesce(st.rating, 0) as rating,
    ci.timezone
  from base p
  cross join q
  left join public.cities ci on ci.id = p.city_id
  left join public.place_stats st on st.place_id = p.id
  left join lateral (
    select cat.emoji, cat.name
    from public.place_categories pc
    join public.categories cat on cat.id = pc.category_id
    where pc.place_id = p.id
    order by pc.category_id
    limit 1
  ) cc on true
  where q.v is null
     or p.name_n like q.pat
     or q.v <% p.name_n
     or lower(extensions.unaccent(coalesce(p.vibe_line, ''))) like q.pat
     or exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) tg
          where lower(extensions.unaccent(tg)) like q.pat)
     or exists (
          select 1 from public.place_categories pc
          join public.categories cat on cat.id = pc.category_id
          where pc.place_id = p.id and lower(extensions.unaccent(cat.name)) like q.pat)
  order by
    -- 1º el nombre empieza por lo buscado, 2º lo contiene, 3º parecido, 4º cercanía.
    (q.v is not null and left(p.name_n, length(q.v)) = q.v) desc,
    (q.v is not null and p.name_n like q.pat) desc,
    case when q.v is null then 0 else word_similarity(q.v, p.name_n) end desc,
    case when (select g from me) is null then 0
         else ST_Distance(p.location, (select g from me)) end asc,
    p.name, p.id
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer) from public;
grant  execute on function public.search_places(text, bigint, integer, double precision, double precision, integer, integer)
  to anon, authenticated, service_role;


-- =====================================================================================
-- e) admin_save_place versionada, sin city_id = 1 fijo  (F2)
-- =====================================================================================
-- Existía solo en la BD (sin archivo). Se versiona aquí desde su definición real y cambia:
--   · parámetro nuevo p_city_id (default null). Al CREAR: ciudad indicada, o la más cercana
--     a las coordenadas. Sin coordenadas se usa el centro de la ciudad indicada. Sin ninguna
--     de las dos cosas falla con un mensaje claro (antes: Puerto Varas a ciegas).
--   · Al EDITAR la ciudad solo cambia si se indica p_city_id.
-- Firma nueva (17 args) → se borra la de 16 para no dejar dos sobrecargas ambiguas. Las
-- llamadas con los 16 nombres de antes siguen resolviendo (p_city_id tiene default).
drop function if exists public.admin_save_place(
  uuid, text, text, text, text, text, text, text, text, text,
  smallint, text[], double precision, double precision, boolean, bigint[]
);

create or replace function public.admin_save_place(
  p_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_vibe_line text,
  p_phone text,
  p_whatsapp text,
  p_website text,
  p_instagram text,
  p_email text,
  p_price_level smallint,
  p_tags text[],
  p_lat double precision,
  p_lng double precision,
  p_is_published boolean,
  p_category_ids bigint[],
  p_city_id bigint default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_id   uuid;
  v_loc  geography;
  v_city bigint;
begin
  if p_lat is not null and p_lng is not null then
    v_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  end if;

  if p_city_id is not null and not exists (select 1 from public.cities c where c.id = p_city_id) then
    raise exception 'La ciudad indicada no existe' using errcode = 'P0001';
  end if;

  if p_id is null then
    v_city := p_city_id;
    if v_city is null and v_loc is not null then
      -- La ciudad cuyo centro queda más cerca (mismo criterio que assign_nearest_city).
      select c.id into v_city from public.cities c order by c.center <-> v_loc limit 1;
    end if;
    if v_city is null then
      raise exception 'Indica las coordenadas o elige la ciudad del lugar' using errcode = 'P0001';
    end if;
    if v_loc is null then
      select c.center into v_loc from public.cities c where c.id = v_city;
    end if;

    insert into public.places (name, slug, description, vibe_line, phone, whatsapp, website, instagram, email,
        price_level, tags, location, is_published, city_id, source, claimed)
    values (p_name, p_slug, p_description, p_vibe_line, p_phone, p_whatsapp, p_website, p_instagram, p_email,
        p_price_level, p_tags, v_loc, coalesce(p_is_published, false), v_city, 'admin', false)
    returning id into v_id;
  else
    update public.places set
      name = p_name, slug = p_slug, description = p_description, vibe_line = p_vibe_line,
      phone = p_phone, whatsapp = p_whatsapp, website = p_website, instagram = p_instagram, email = p_email,
      price_level = p_price_level, tags = p_tags,
      is_published = coalesce(p_is_published, is_published),
      location = coalesce(v_loc, location),
      city_id = coalesce(p_city_id, city_id),
      updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Lugar no encontrado' using errcode = 'P0001';
    end if;
  end if;

  if p_category_ids is not null then
    delete from public.place_categories where place_id = v_id;
    insert into public.place_categories (place_id, category_id)
      select v_id, unnest(p_category_ids)
      on conflict do nothing;
  end if;

  return v_id;
end $$;

-- Interna: solo service_role (src/actions/admin-places.ts tras validar is_admin).
revoke execute on function public.admin_save_place(
  uuid, text, text, text, text, text, text, text, text, text,
  smallint, text[], double precision, double precision, boolean, bigint[], bigint
) from public, anon, authenticated;
grant execute on function public.admin_save_place(
  uuid, text, text, text, text, text, text, text, text, text,
  smallint, text[], double precision, double precision, boolean, bigint[], bigint
) to service_role;

commit;

-- PostgREST cachea el esquema: sin esto las columnas / el parámetro nuevos tardan en verse.
notify pgrst, 'reload schema';


-- =====================================================================================
-- VERIFICACIÓN (solo lectura; correr tras aplicar)
-- =====================================================================================
/*
-- 1) Grants. Esperado: get_feed / get_feed_events / search_places → anon, auth y srv = true;
--    admin_save_place y enqueue_event_reminders → solo srv = true.
--    prosecdef: true en get_feed, get_feed_events, admin_save_place, enqueue_event_reminders.
select p.oid::regprocedure as sig, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth,
       has_function_privilege('service_role', p.oid, 'execute')  as srv
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_feed', 'get_feed_events', 'search_places', 'admin_save_place', 'enqueue_event_reminders')
order by 1;

-- 2) Una sola firma de admin_save_place (la de 17 argumentos).
select count(*) from pg_proc where proname = 'admin_save_place';

-- 3) FKs. Esperado: interactions.event_id SET NULL; boosts.* CASCADE;
--    business_reports.business_id CASCADE; events.business_id SET NULL.
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid)
from pg_constraint
where contype = 'f'
  and conname in ('interactions_event_id_fkey', 'boosts_event_id_fkey', 'boosts_place_id_fkey',
                  'boosts_business_id_fkey', 'business_reports_business_id_fkey', 'events_business_id_fkey');

-- 4) El feed como ANÓNIMO ve el boost y trae las columnas nuevas (se revierte solo).
begin;
  set local role anon;
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select id, name, boosted, timezone, hours is not null as con_horario
  from public.get_feed(-41.3195, -72.9854, 25000, 5, 0);
  select count(*) as boosts_visibles_por_api from public.boosts; -- esperado: 0 (tabla sigue cerrada)
rollback;

-- 5) Orden estable: dos páginas consecutivas no comparten ids. Esperado: 0.
select count(*) from (
  select id from public.get_feed(37.1773, -3.5986, 25000, 40, 0)
  intersect
  select id from public.get_feed(37.1773, -3.5986, 25000, 40, 40)
) x;

-- 6) Búsqueda sin tildes y por categoría / etiqueta. Esperado: filas en las tres.
select count(*) from public.search_places('cafe');
select count(*) from public.search_places('cerveza');
select count(*) from public.search_places('hamburguesa');
--    Con tope de precio no entra ningún lugar sin precio. Esperado: 0.
select count(*) from public.search_places(null, null, 2) where price_level is null;

-- 7) Recordatorios: la definición ya no menciona America/Santiago. Esperado: false.
select pg_get_functiondef('public.enqueue_event_reminders()'::regprocedure) like '%America/Santiago%';
*/
