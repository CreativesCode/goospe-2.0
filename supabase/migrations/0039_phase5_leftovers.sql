-- 0039 — Pendientes de la Fase 5 "Panel del dueño" (.claude/PRPs/prp-legacy-y-brechas.md).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Estado real leído de la BD el 12-oct-2026 (information_schema, pg_proc, pg_constraint,
-- pg_indexes): 0037 ya está aplicada; no existe ninguno de los objetos de este archivo.
--
-- SOLO CAMBIOS ADITIVOS: una tabla, tres funciones y un índice nuevos. No toca la firma, las
-- columnas ni los permisos de nada que ya exista, así que el código desplegado hoy sigue
-- funcionando igual con la migración aplicada.
--
-- Qué hace:
--   a) place_proposals: "proponer un lugar nuevo" (usuario con sesión -> admin). Tabla nueva
--      a propósito: place_change_requests exige place_id (el lugar todavía no existe).
--   b) place_proposal_duplicates(text, float8, float8, bigint): lugares cercanos (<= 150 m) o
--      de nombre parecido (pg_trgm + unaccent) para que el admin no cree un duplicado.
--   c) event_boost_stats(uuid): rendimiento de los boosts de EVENTOS de un lugar, con la
--      ventana previa de igual duración para comparar. place_boost_stats (lugares) no cambia.
--   d) admin_audit_log(text, text, text, int, int): lectura paginada de audit_log con el email
--      y el nombre del actor (auth.users / profiles) para /admin/audit.
--   e) interactions_event_idx: la actividad de eventos se busca por event_id (hoy sin índice).
--
-- Permisos: las tres funciones son SECURITY DEFINER internas -> solo service_role (se llaman
-- con el cliente admin DESPUÉS de validar sesión y permiso). Ninguna queda abierta.
--   · admin_audit_log lee auth.users.email: por eso jamás debe abrirse a anon/authenticated.
--   · place_proposals: RLS activa, lectura del propio solicitante o de un admin; toda escritura
--     es del servidor (service_role).
--
-- Contrato con el código (src/):
--   · place_proposals              src/actions/place-proposals.ts, src/actions/admin-proposals.ts,
--                                  src/features/business/panel-data.ts, src/features/admin/ProposalInbox.tsx
--   · place_proposal_duplicates    src/features/admin/proposal-duplicates.ts
--   · event_boost_stats            src/features/analytics/load.ts (loadEventBoostStats)
--   · admin_audit_log              src/app/admin/audit/page.tsx
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después. Sin ella el código nuevo degrada sin
-- romper lo existente: "proponer lugar" y la bitácora muestran un error, y el bloque de
-- rendimiento de eventos destacados simplemente no aparece.

begin;


-- =====================================================================================
-- a) PROPUESTAS DE LUGAR NUEVO
-- =====================================================================================
create table if not exists public.place_proposals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Negocio del solicitante al proponer (si ya administraba alguno). El vínculo definitivo
  -- se resuelve al aprobar, igual que en un reclamo.
  business_id   uuid references public.businesses(id) on delete set null,
  name          text not null check (char_length(name) between 2 and 120),
  category_id   bigint references public.categories(id) on delete set null,
  address       text check (address is null or char_length(address) <= 200),
  -- Ciudad elegida de la lista, o escrita a mano si no aparece (city_id nulo).
  city_id       bigint references public.cities(id) on delete set null,
  city_name     text check (city_name is null or char_length(city_name) <= 80),
  -- Punto del mapa si se pudo leer del enlace o de "lat, lng"; si no, queda la referencia.
  lat           double precision check (lat is null or (lat >= -90 and lat <= 90)),
  lng           double precision check (lng is null or (lng >= -180 and lng <= 180)),
  location_ref  text check (location_ref is null or char_length(location_ref) <= 500),
  phone         text check (phone is null or char_length(phone) <= 30),
  website       text check (website is null or char_length(website) <= 300),
  message       text check (message is null or char_length(message) <= 1000),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 500),
  -- Lugar creado al aprobar.
  place_id      uuid references public.places(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id) on delete set null,
  constraint place_proposals_latlng_pair check ((lat is null) = (lng is null))
);

-- La misma persona no repite una propuesta pendiente con el mismo nombre.
create unique index if not exists place_proposals_one_pending_idx
  on public.place_proposals (user_id, lower(btrim(name))) where status = 'pending';
create index if not exists place_proposals_user_idx
  on public.place_proposals (user_id, created_at desc);
create index if not exists place_proposals_status_idx
  on public.place_proposals (status, created_at);

alter table public.place_proposals enable row level security;

-- Lectura: el solicitante o un admin. Escritura: solo service_role (server actions).
drop policy if exists "read own place proposals" on public.place_proposals;
create policy "read own place proposals" on public.place_proposals
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.place_proposals from public, anon, authenticated;
grant  select on public.place_proposals to authenticated;
grant  all on public.place_proposals to service_role;


-- =====================================================================================
-- b) POSIBLES DUPLICADOS DE UNA PROPUESTA
-- =====================================================================================
-- Candidatos: lugares a menos de 2 km del punto (si hay coordenadas) o de la misma ciudad (si
-- se indica). De esos devuelve los que estan a <= 150 m o cuyo nombre se parece (trigramas
-- sin tildes ni mayusculas, similitud >= 0.45). El codigo clasifica cada fila
-- (src/features/admin/proposal-duplicates.ts). pg_trgm, unaccent y PostGIS viven en `extensions`.
create or replace function public.place_proposal_duplicates(
  p_name    text,
  p_lat     double precision default null,
  p_lng     double precision default null,
  p_city_id bigint           default null
)
returns table(
  id uuid, slug text, name text, distance_m double precision, similarity real,
  claimed boolean, is_published boolean, city_name text
)
language sql stable security definer set search_path = public, extensions as $$
  with q as (
    select unaccent(lower(btrim(coalesce(p_name, '')))) as n,
           case when p_lat is not null and p_lng is not null
                 and p_lat >= -90 and p_lat <= 90 and p_lng >= -180 and p_lng <= 180
                then ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
           end as g
  ),
  cand as (
    select p.id, p.slug, p.name, p.claimed, p.is_published, p.city_id,
           case when q.g is not null then ST_Distance(p.location, q.g) end as distance_m,
           similarity(unaccent(lower(p.name)), q.n) as sim
    from public.places p
    cross join q
    where (q.g is not null and ST_DWithin(p.location, q.g, 2000))
       or (p_city_id is not null and p.city_id = p_city_id)
  )
  select c.id, c.slug, c.name, c.distance_m, c.sim,
         coalesce(c.claimed, false), coalesce(c.is_published, false), ci.name
  from cand c
  left join public.cities ci on ci.id = c.city_id
  where c.distance_m <= 150 or c.sim >= 0.45
  order by (c.distance_m <= 150 and c.sim >= 0.45) desc nulls last,
           c.sim desc, c.distance_m asc nulls last, c.id
  limit 10;
$$;

revoke execute on function public.place_proposal_duplicates(text, double precision, double precision, bigint) from public, anon, authenticated;
grant  execute on function public.place_proposal_duplicates(text, double precision, double precision, bigint) to service_role;


-- =====================================================================================
-- c) RENDIMIENTO DE LOS BOOSTS DE EVENTOS
-- =====================================================================================
-- Un boost de evento se mide con la actividad DEL EVENTO (interactions.event_id), no con la
-- del lugar:
--   impressions = view_card con event_id   (la card del evento se vio en el feed)
--   opens       = view_detail con event_id (desde la card del evento se abrio la ficha)
--   rsvps       = filas de event_rsvps creadas en la ventana (inscritos que siguen apuntados)
-- Ventana = [starts_at, fin efectivo]; fin efectivo = ended_at si se termino antes, si no
-- ends_at, nunca mas alla de ahora. prev_* = la ventana de igual duracion justo antes.
-- comparable = el evento ya existia al empezar esa ventana previa (si no, comparar engana).
-- Excluye la actividad de los miembros del negocio, como place_boost_stats.
create or replace function public.event_boost_stats(p_place_id uuid)
returns table(
  boost_id uuid, event_id uuid, event_name text,
  starts_at timestamptz, ends_at timestamptz, ended_at timestamptz, status text,
  impressions bigint, opens bigint, rsvps bigint,
  prev_impressions bigint, prev_opens bigint, prev_rsvps bigint,
  comparable boolean
)
language sql stable security definer set search_path = public as $$
  with team as (
    select m.user_id
    from public.business_members m
    join public.places p on p.business_id = m.business_id
    where p.id = p_place_id
  ),
  b as (
    select bo.id, bo.event_id, e.name as event_name, e.created_at as event_created_at,
           bo.starts_at, bo.ends_at, bo.ended_at, bo.status,
           greatest(least(coalesce(bo.ended_at, bo.ends_at), now()), bo.starts_at) as until
    from public.boosts bo
    join public.events e on e.id = bo.event_id
    where e.place_id = p_place_id
    order by bo.starts_at desc
    limit 12
  ),
  w as (
    select b.*, b.starts_at - (b.until - b.starts_at) as prev_from
    from b
  )
  select w.id, w.event_id, w.event_name, w.starts_at, w.ends_at, w.ended_at, w.status,
         coalesce(x.imp, 0)::bigint, coalesce(x.opn, 0)::bigint, coalesce(y.n, 0)::bigint,
         coalesce(x.pimp, 0)::bigint, coalesce(x.popn, 0)::bigint, coalesce(y.pn, 0)::bigint,
         (w.event_created_at is not null and w.event_created_at <= w.prev_from)
  from w
  left join lateral (
    select count(*) filter (where i.kind = 'view_card'   and i.created_at >= w.starts_at) as imp,
           count(*) filter (where i.kind = 'view_detail' and i.created_at >= w.starts_at) as opn,
           count(*) filter (where i.kind = 'view_card'   and i.created_at <  w.starts_at) as pimp,
           count(*) filter (where i.kind = 'view_detail' and i.created_at <  w.starts_at) as popn
    from public.interactions i
    where i.event_id = w.event_id
      and i.kind in ('view_card', 'view_detail')
      and i.created_at >= w.prev_from
      and i.created_at <= w.until
      and (i.user_id is null or i.user_id not in (select t.user_id from team t))
  ) x on true
  left join lateral (
    select count(*) filter (where r.created_at >= w.starts_at) as n,
           count(*) filter (where r.created_at <  w.starts_at) as pn
    from public.event_rsvps r
    where r.event_id = w.event_id
      and r.created_at >= w.prev_from
      and r.created_at <= w.until
      and r.user_id not in (select t.user_id from team t)
  ) y on true
  order by w.starts_at desc;
$$;

revoke execute on function public.event_boost_stats(uuid) from public, anon, authenticated;
grant  execute on function public.event_boost_stats(uuid) to service_role;

-- La actividad de un evento se filtra por event_id (el indice existente es por place_id).
create index if not exists interactions_event_idx
  on public.interactions (event_id, kind, created_at) where event_id is not null;


-- =====================================================================================
-- d) BITACORA PARA /admin/audit
-- =====================================================================================
-- Mas nuevo primero, paginado. Filtros (todos opcionales):
--   p_prefix      prefijo exacto de la accion ('owner.' | 'admin.'), sin comodines
--   p_object_type tipo de objeto exacto
--   p_actor       texto libre contenido en el email o el nombre del actor (sin comodines)
-- place_id / place_name: el lugar del registro (object_id si el objeto es un lugar; si no,
-- payload.place_id) para enlazarlo. total = filas que cumplen el filtro (para paginar).
create or replace function public.admin_audit_log(
  p_prefix      text    default null,
  p_object_type text    default null,
  p_actor       text    default null,
  p_limit       integer default 50,
  p_offset      integer default 0
)
returns table(
  id bigint, created_at timestamptz, user_id uuid, actor_email text, actor_name text,
  action text, object_type text, object_id text, payload jsonb,
  place_id uuid, place_name text, total bigint
)
language sql stable security definer set search_path = public as $$
  with f as (
    select a.id, a.created_at, a.user_id, u.email::text as actor_email, pr.display_name as actor_name,
           a.action, a.object_type, a.object_id, a.payload
    from public.audit_log a
    left join auth.users u on u.id = a.user_id
    left join public.profiles pr on pr.id = a.user_id
    where (nullif(p_prefix, '') is null or left(a.action, char_length(p_prefix)) = p_prefix)
      and (nullif(p_object_type, '') is null or a.object_type = p_object_type)
      and (nullif(btrim(coalesce(p_actor, '')), '') is null
           or position(lower(btrim(p_actor))
                       in lower(coalesce(u.email::text, '') || ' ' || coalesce(pr.display_name, ''))) > 0)
  ),
  pg as (
    select f.*, count(*) over () as total,
           case when f.object_type = 'place' then f.object_id else f.payload ->> 'place_id' end as place_ref
    from f
    order by f.created_at desc nulls last, f.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select pg.id, pg.created_at, pg.user_id, pg.actor_email, pg.actor_name,
         pg.action, pg.object_type, pg.object_id, pg.payload,
         pl.id, pl.name, pg.total
  from pg
  left join public.places pl
    on pl.id = case when pg.place_ref ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                    then pg.place_ref::uuid end
  order by pg.created_at desc nulls last, pg.id desc;
$$;

revoke execute on function public.admin_audit_log(text, text, text, integer, integer) from public, anon, authenticated;
grant  execute on function public.admin_audit_log(text, text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';

commit;


-- =====================================================================================
-- CONSULTAS DE VERIFICACIÓN (correr a mano tras aplicar)
-- =====================================================================================
/*
-- 1. Tabla nueva con RLS activa (esperado: true), su única política y sus permisos
--    (esperado: authenticated solo SELECT; nada para anon).
select relrowsecurity from pg_class where oid = 'public.place_proposals'::regclass;
select policyname, cmd from pg_policies where tablename = 'place_proposals';
select grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'place_proposals'
  and grantee in ('anon', 'authenticated', 'service_role')
group by 1;

-- 2. Funciones nuevas: SECURITY DEFINER, search_path fijo y solo service_role
--    (esperado: prosecdef = true y proacl sin anon ni authenticated en las 3).
select proname, prosecdef, proconfig, proacl
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('place_proposal_duplicates', 'event_boost_stats', 'admin_audit_log');

-- 3. Índices (esperado: 4 filas).
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in ('place_proposals_one_pending_idx', 'place_proposals_user_idx',
                    'place_proposals_status_idx', 'interactions_event_idx');

-- 4. Duplicados: con el nombre y las coordenadas de un lugar real debe devolverlo primero,
--    con distance_m ~ 0 y similarity = 1.
select p.name, d.*
from public.places p
cross join lateral public.places_lnglat(array[p.id]) ll
cross join lateral public.place_proposal_duplicates(p.name, ll.lat, ll.lng, p.city_id) d
where p.id = '<place_id>';

-- 5. Bitácora: total coincide con el count, y el filtro por prefijo reparte el total.
select count(*) from public.audit_log;
select total, id, actor_email, action, object_type, place_name from public.admin_audit_log(null, null, null, 5, 0);
select (select total from public.admin_audit_log('owner.', null, null, 1, 0)) owner_n,
       (select total from public.admin_audit_log('admin.', null, null, 1, 0)) admin_n;

-- 6. Boosts de eventos de un lugar (vacío mientras no haya boosts con event_id).
select * from public.event_boost_stats('<place_id>');

-- 7. Como anon / authenticated (desde la API), deben FALLAR con 42501:
--    rpc place_proposal_duplicates / event_boost_stats / admin_audit_log
--    insert / update / delete en place_proposals
--    y un authenticated solo debe LEER sus propias propuestas.
*/
