-- 0037 — Fase 5 "Panel del dueño completo" (.claude/PRPs/prp-legacy-y-brechas.md, doc 15 §4.3–§4.4).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Estado real leído de la BD el 12-oct-2026 (information_schema, pg_policies, pg_proc), no de
-- los archivos del repo. Las funciones get_feed / get_feed_events se redefinen partiendo de
-- su pg_get_functiondef real.
--
-- SOLO CAMBIOS ADITIVOS. No cambia la firma ni las columnas de ninguna RPC existente.
--
-- Qué hace:
--   a) reviews        + owner_reply, owner_replied_at, owner_reply_by (respuesta pública del negocio).
--                     Escritura por columnas: el autor solo toca rating y body por la API.
--   b) claims         + reject_reason, resolved_at, resolved_by. Un solo reclamo pendiente por
--                     (lugar, usuario). El alta directa por la API ya no puede fijar el status.
--   c) notifications  + link, place_id, dedupe_key (agrupación). El usuario solo marca `read`.
--   d) places         + owner_paused_at ("cerrado temporalmente" por el dueño).
--      boosts         + ended_at (fin real cuando el dueño lo termina antes).
--   e) place_change_requests: solicitudes de cambio de nombre / ubicación (dueño -> admin).
--      Tabla nueva a propósito: moderation_queue (sin uso) es de moderación por IA y no tiene
--      solicitante, propuesta, estado ni motivo; reutilizarla obligaba a rehacerla entera.
--   f) audit_log      cerrado a anon/authenticated + índices (solo escribe/lee service_role).
--   g) RPC nuevas (solo service_role): place_metrics_series, place_boost_stats,
--      admin_set_place_location.
--   h) Triggers de notificación: nueva reseña / reseña crítica al negocio, y "alguien se
--      apuntó a tu evento" (máx. una por evento, por hora y por miembro).
--   i) get_feed / get_feed_events: la foto de la card es places.cover_url si el dueño subió
--      portada (misma firma y mismas columnas).
--
-- Por qué triggers en (h) y no server actions: los RSVP se insertan con el cliente del usuario
-- (RLS "own rsvps") y una reseña puede entrar por la API directa; el trigger cubre todos los
-- caminos y la agrupación por hora queda garantizada por un índice único, sin carreras. Los
-- avisos que dependen de una decisión humana con contexto (reclamo aprobado/rechazado con
-- motivo, respuesta del negocio, evento cancelado, aviso a admins) los inserta la server action.
-- Los triggers nunca tumban la escritura original: cualquier fallo se degrada a WARNING.
--
-- Literales con tildes dentro de funciones: se escriben como U&'...' (escapes Unicode) para que
-- el cuerpo sea ASCII puro y sobreviva al envío por la Management API sin acentos.
--
-- Contrato con el código (src/):
--   · reviews.owner_reply*            src/actions/review-replies.ts, PlaceReviews, ReviewReplies
--   · claims.reject_reason/resolved_* src/actions/admin-claims.ts, src/actions/owner-requests.ts
--   · notifications.link/place_id     src/lib/notify.ts, src/features/notifications/Notifications.tsx
--   · places.owner_paused_at          src/actions/owner-requests.ts (setPlacePaused)
--   · boosts.ended_at                 src/actions/boosts.ts
--   · place_change_requests           src/actions/owner-requests.ts, src/actions/admin-requests.ts
--   · place_metrics_series(uuid,int,text) / place_boost_stats(uuid)  src/actions/analytics.ts
--   · admin_set_place_location(uuid,float8,float8)                   src/actions/admin-requests.ts
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después. El código desplegado hoy sigue
-- funcionando con la migración aplicada: escribe reviews, claims y notifications con service
-- role (o solo `read` en notifications), y nada de lo que ya llama cambia de firma.

begin;


-- =====================================================================================
-- a) REVIEWS: respuesta pública del negocio
-- =====================================================================================
alter table public.reviews
  add column if not exists owner_reply      text,
  add column if not exists owner_replied_at timestamptz,
  add column if not exists owner_reply_by   uuid references auth.users(id) on delete set null;

alter table public.reviews drop constraint if exists reviews_owner_reply_check;
alter table public.reviews
  add constraint reviews_owner_reply_check
  check (owner_reply is null or char_length(owner_reply) between 1 and 1000);

-- Estado real: anon y authenticated tenían INSERT/UPDATE de TABLA; la política "update review"
-- (user_id = auth.uid()) habría dejado al autor escribirse la "respuesta del negocio" en su
-- propia reseña. Se pasa a permisos por columna. El código escribe reseñas con service role
-- (src/actions/reviews.ts) y solo borra con el cliente del usuario (DELETE no se toca).
revoke insert, update on public.reviews from public, anon, authenticated;
grant  insert (user_id, place_id, rating, body) on public.reviews to authenticated;
grant  update (rating, body)                    on public.reviews to authenticated;


-- =====================================================================================
-- b) CLAIMS: motivo de rechazo y resolución
-- =====================================================================================
-- status pasa a admitir también 'cancelled' (lo cancela el solicitante). No hay check sobre
-- status en la BD real; se deja así.
alter table public.claims
  add column if not exists reject_reason text,
  add column if not exists resolved_at   timestamptz,
  add column if not exists resolved_by   uuid references auth.users(id) on delete set null;

alter table public.claims drop constraint if exists claims_reject_reason_check;
alter table public.claims
  add constraint claims_reject_reason_check
  check (reject_reason is null or char_length(reject_reason) <= 500);

-- Un solo reclamo pendiente por lugar y usuario (hoy lo evita solo el código; 1 fila en la BD).
create unique index if not exists claims_one_pending_idx
  on public.claims (place_id, user_id) where status = 'pending';
create index if not exists claims_user_idx on public.claims (user_id, created_at desc);
create index if not exists claims_status_idx on public.claims (status) where status = 'pending';

-- Por la API, el alta propia (política "insert own claim") ya no puede fijar status ni la
-- resolución: entra con el default 'pending'. Resolver un reclamo es solo del servidor.
revoke insert, update on public.claims from public, anon, authenticated;
grant  insert (place_id, user_id, method, evidence) on public.claims to authenticated;


-- =====================================================================================
-- c) NOTIFICATIONS: enlace de destino, lugar y agrupación
-- =====================================================================================
-- kind (texto libre, sin check): event_reminder | review_new | review_critical | event_rsvp |
-- claim_approved | claim_rejected | review_reply | event_cancelled | event_updated |
-- claim_new | change_request_new | change_request_resolved
alter table public.notifications
  add column if not exists link       text,
  add column if not exists place_id   uuid references public.places(id) on delete cascade,
  add column if not exists dedupe_key text;

-- Solo rutas internas: nunca un enlace externo en la campana.
alter table public.notifications drop constraint if exists notifications_link_check;
alter table public.notifications
  add constraint notifications_link_check
  check (link is null or (link like '/%' and link not like '//%' and char_length(link) <= 300));

-- Agrupación: dos NULL no chocan, así que solo deduplica cuando hay clave.
create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- El usuario solo marca como leída (antes podía reescribir título y cuerpo de las suyas).
revoke insert, update on public.notifications from public, anon, authenticated;
grant  update (read) on public.notifications to authenticated;


-- =====================================================================================
-- d) PLACES / BOOSTS
-- =====================================================================================
-- Pausa del dueño: is_published = false + owner_paused_at. Así el dueño solo puede reactivar
-- lo que él pausó, nunca un lugar que ocultó un admin (owner_paused_at nulo).
alter table public.places add column if not exists owner_paused_at timestamptz;

-- Fin real del boost cuando se termina antes de ends_at (para medir su rendimiento).
alter table public.boosts add column if not exists ended_at timestamptz;
create index if not exists boosts_place_idx on public.boosts (place_id, starts_at desc);


-- =====================================================================================
-- e) SOLICITUDES DE CAMBIO (nombre / ubicación)
-- =====================================================================================
create table if not exists public.place_change_requests (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  business_id   uuid references public.businesses(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('name', 'location')),
  -- name: { "name": text } · location: { "lat": number|null, "lng": number|null, "reference": text|null }
  payload       jsonb not null default '{}'::jsonb,
  -- Foto del valor vigente al pedir el cambio (para que el admin compare).
  current_value jsonb,
  message       text check (message is null or char_length(message) <= 1000),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 500),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id) on delete set null
);

create unique index if not exists place_change_requests_one_pending_idx
  on public.place_change_requests (place_id, kind) where status = 'pending';
create index if not exists place_change_requests_user_idx
  on public.place_change_requests (user_id, created_at desc);
create index if not exists place_change_requests_status_idx
  on public.place_change_requests (status, created_at);

alter table public.place_change_requests enable row level security;

-- Lectura: el solicitante o un admin. Escritura: solo service_role (server actions).
drop policy if exists "read own change requests" on public.place_change_requests;
create policy "read own change requests" on public.place_change_requests
  for select using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.place_change_requests from public, anon, authenticated;
grant  select on public.place_change_requests to authenticated;


-- =====================================================================================
-- f) AUDIT_LOG: cerrado a la API
-- =====================================================================================
-- Estado real: RLS activa, 0 filas, pero anon/authenticated con todos los privilegios de tabla.
-- Solo lo escribe y lo lee el servidor con service role (src/lib/audit.ts).
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
alter table public.audit_log alter column created_at set default now();
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_object_idx  on public.audit_log (object_type, object_id);
create index if not exists audit_log_user_idx    on public.audit_log (user_id, created_at desc);


-- =====================================================================================
-- g) RPC NUEVAS (solo service_role)
-- =====================================================================================

-- Serie de métricas de un lugar. Los cortes de día / hora / día de la semana se calculan en la
-- zona horaria de la CIUDAD del lugar. Excluye la actividad de los miembros del negocio (con
-- sesión; un dueño navegando sin sesión no se puede distinguir).
--   p_group: 'day'  -> bucket 'YYYY-MM-DD'
--            'hour' -> bucket '00'..'23'
--            'dow'  -> bucket '0'..'6' (0 = lunes)
--   kind:    view_detail | view_card | save | directions | share | concierge_pick |
--            call_phone | call_whatsapp | call_email | call_other | rsvp | review
-- El rango son los últimos p_days días CALENDARIO de la ciudad, incluido hoy.
create or replace function public.place_metrics_series(
  p_place_id uuid,
  p_days     integer default 30,
  p_group    text    default 'day'
)
returns table(bucket text, kind text, n bigint)
language sql stable security definer set search_path = public as $$
  with win as (
    select p.business_id,
           coalesce(c.timezone, 'UTC') as tz,
           ((date_trunc('day', now() at time zone coalesce(c.timezone, 'UTC'))
             - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366) - 1))
            at time zone coalesce(c.timezone, 'UTC')) as since
    from public.places p
    left join public.cities c on c.id = p.city_id
    where p.id = p_place_id
  ),
  team as (
    select m.user_id
    from public.business_members m
    join win on m.business_id = win.business_id
  ),
  ev as (
    select i.created_at as at,
           case when i.kind = 'call'
                then 'call_' || case when i.context ->> 'channel' in ('phone', 'whatsapp', 'email')
                                     then i.context ->> 'channel' else 'other' end
                else i.kind end as kind
    from public.interactions i
    cross join win
    where i.place_id = p_place_id
      and i.created_at >= win.since
      and i.kind in ('view_detail', 'view_card', 'save', 'directions', 'share', 'call', 'concierge_pick')
      and (i.user_id is null or i.user_id not in (select t.user_id from team t))
    union all
    select r.created_at, 'rsvp'
    from public.event_rsvps r
    join public.events e on e.id = r.event_id
    cross join win
    where e.place_id = p_place_id
      and r.created_at >= win.since
      and r.user_id not in (select t.user_id from team t)
    union all
    select rv.created_at, 'review'
    from public.reviews rv
    cross join win
    where rv.place_id = p_place_id
      and rv.status = 'approved'
      and rv.created_at >= win.since
      and rv.user_id not in (select t.user_id from team t)
  )
  select case p_group
           when 'hour' then to_char(ev.at at time zone win.tz, 'HH24')
           when 'dow'  then (extract(isodow from ev.at at time zone win.tz)::int - 1)::text
           else to_char(ev.at at time zone win.tz, 'YYYY-MM-DD')
         end as bucket,
         ev.kind,
         count(*)::bigint as n
  from ev
  cross join win
  group by 1, 2;
$$;

revoke execute on function public.place_metrics_series(uuid, integer, text) from public, anon, authenticated;
grant  execute on function public.place_metrics_series(uuid, integer, text) to service_role;


-- Rendimiento de los boosts de un LUGAR (no de eventos): impresiones (view_card), clics
-- (view_detail) y acciones (cómo llego, contacto, guardar, compartir) mientras estuvo activo.
-- Fin efectivo = ended_at si se terminó antes; si no, ends_at; nunca más allá de ahora.
create or replace function public.place_boost_stats(p_place_id uuid)
returns table(
  boost_id uuid, starts_at timestamptz, ends_at timestamptz, ended_at timestamptz, status text,
  impressions bigint, clicks bigint, actions bigint
)
language sql stable security definer set search_path = public as $$
  with team as (
    select m.user_id
    from public.business_members m
    join public.places p on p.business_id = m.business_id
    where p.id = p_place_id
  ),
  b as (
    select bo.id, bo.starts_at, bo.ends_at, bo.ended_at, bo.status,
           least(coalesce(bo.ended_at, bo.ends_at), now()) as until
    from public.boosts bo
    where bo.place_id = p_place_id and bo.event_id is null
    order by bo.starts_at desc
    limit 12
  )
  select b.id, b.starts_at, b.ends_at, b.ended_at, b.status,
         count(i.id) filter (where i.kind = 'view_card')::bigint,
         count(i.id) filter (where i.kind = 'view_detail')::bigint,
         count(i.id) filter (where i.kind in ('directions', 'call', 'save', 'share'))::bigint
  from b
  left join public.interactions i
    on i.place_id = p_place_id
   and i.created_at >= b.starts_at
   and i.created_at <= b.until
   and i.kind in ('view_card', 'view_detail', 'directions', 'call', 'save', 'share')
   and (i.user_id is null or i.user_id not in (select t.user_id from team t))
  group by b.id, b.starts_at, b.ends_at, b.ended_at, b.status
  order by b.starts_at desc;
$$;

revoke execute on function public.place_boost_stats(uuid) from public, anon, authenticated;
grant  execute on function public.place_boost_stats(uuid) to service_role;


-- Mueve el pin de un lugar (al aprobar una solicitud de cambio de ubicación). PostGIS vive en
-- `extensions`. No reasigna city_id: un cambio de ciudad se hace desde /admin/places.
create or replace function public.admin_set_place_location(
  p_place_id uuid, p_lat double precision, p_lng double precision
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'admin_set_place_location: coordenadas invalidas' using errcode = '22023';
  end if;
  update public.places
     set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
         updated_at = now()
   where id = p_place_id;
  if not found then
    raise exception 'admin_set_place_location: lugar no encontrado' using errcode = 'P0002';
  end if;
end$$;

revoke execute on function public.admin_set_place_location(uuid, double precision, double precision) from public, anon, authenticated;
grant  execute on function public.admin_set_place_location(uuid, double precision, double precision) to service_role;


-- =====================================================================================
-- h) TRIGGERS DE NOTIFICACIÓN AL NEGOCIO
-- =====================================================================================

-- Nueva reseña visible (o reseña que pasa a ser crítica) -> aviso a los miembros del negocio.
-- Crítica = 1 o 2 estrellas (kind propio para destacarla en la campana).
create or replace function public.trg_notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_place    record;
  v_critical boolean;
begin
  begin
    if new.status is distinct from 'approved' then
      return null;
    end if;
    if tg_op = 'UPDATE'
       and old.status is not distinct from 'approved'
       and not (new.rating <= 2 and old.rating > 2) then
      return null; -- edición normal de una reseña ya visible: no se vuelve a avisar
    end if;

    select p.id, p.name, p.business_id into v_place
    from public.places p where p.id = new.place_id;
    if v_place.business_id is null then
      return null;
    end if;

    v_critical := new.rating <= 2;

    insert into public.notifications (user_id, kind, title, body, link, place_id, dedupe_key)
    select m.user_id,
           case when v_critical then 'review_critical' else 'review_new' end,
           case when v_critical then U&'Rese\00F1a cr\00EDtica en ' else U&'Nueva rese\00F1a en ' end || v_place.name,
           new.rating::text || ' de 5' || coalesce(U&' \00B7 ' || left(nullif(btrim(new.body), ''), 140), ''),
           '/panel/' || v_place.id::text || '#resenas',
           v_place.id,
           'review:' || new.id::text || case when v_critical then ':c' else ':n' end
    from public.business_members m
    where m.business_id = v_place.business_id
      and m.user_id <> new.user_id
    on conflict do nothing;
  exception when others then
    raise warning 'trg_notify_review: %', sqlerrm; -- el aviso nunca tumba la reseña
  end;
  return null;
end$$;

revoke execute on function public.trg_notify_review() from public, anon, authenticated;

drop trigger if exists trg_notify_review on public.reviews;
create trigger trg_notify_review
  after insert or update of status, rating on public.reviews
  for each row execute function public.trg_notify_review();


-- Alguien se apuntó a un evento -> aviso a los miembros del negocio, agrupado: como máximo
-- una notificación por evento, por hora y por miembro (índice único user_id + dedupe_key).
create or replace function public.trg_notify_rsvp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.notifications (user_id, kind, title, body, link, place_id, event_id, dedupe_key)
    select m.user_id,
           'event_rsvp',
           'Nuevos inscritos en ' || e.name,
           U&'Alguien se apunt\00F3 a tu evento en ' || p.name,
           '/panel/' || p.id::text || '#eventos',
           p.id,
           e.id,
           'rsvp:' || e.id::text || ':' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24')
    from public.events e
    join public.places p on p.id = e.place_id
    join public.business_members m on m.business_id = p.business_id
    where e.id = new.event_id
      and m.user_id <> new.user_id
    on conflict do nothing;
  exception when others then
    raise warning 'trg_notify_rsvp: %', sqlerrm; -- el aviso nunca tumba el RSVP
  end;
  return null;
end$$;

revoke execute on function public.trg_notify_rsvp() from public, anon, authenticated;

drop trigger if exists trg_notify_rsvp on public.event_rsvps;
create trigger trg_notify_rsvp
  after insert on public.event_rsvps
  for each row execute function public.trg_notify_rsvp();


-- =====================================================================================
-- i) FEED: la portada del dueño es la foto de la card
-- =====================================================================================
-- Misma firma, mismas columnas y mismos permisos (create or replace conserva los grants).
-- Único cambio respecto de la definición real: photo_url = coalesce(cover_url, foto aprobada).

create or replace function public.get_feed(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 25000, p_limit integer default 20, p_offset integer default 0
)
returns table(
  id uuid, slug text, name text, vibe_line text, description text, tags text[],
  price_level smallint, lat double precision, lng double precision, distance_m double precision,
  rating numeric, reviews_count integer, photo_url text, category_emoji text, category_name text,
  boosted boolean, score double precision, hours jsonb, timezone text
)
language sql stable security definer set search_path = public, extensions as $$
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
           p.embedding, p.hours, p.city_id, p.cover_url,
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
    coalesce(
      nullif(c.cover_url, ''),
      (select pp.url from public.place_photos pp
         where pp.place_id = c.id and pp.status = 'approved'
         order by (pp.source = 'google') desc, pp.id
         limit 1)
    ) as photo_url,
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
  order by score desc, c.dist_m asc, c.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

create or replace function public.get_feed_events(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 25000, p_limit integer default 10
)
returns table(
  id uuid, name text, description text, image_url text, starts_at timestamptz,
  place_id uuid, place_slug text, place_name text,
  lat double precision, lng double precision, distance_m double precision,
  photo_url text, boosted boolean, timezone text
)
language sql stable security definer set search_path = public, extensions as $$
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
      nullif(p.cover_url, ''),
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

-- Abiertas a propósito desde 0033/0035 (el feed es público): se reafirman por si acaso.
revoke execute on function public.get_feed(double precision, double precision, integer, integer, integer) from public;
grant  execute on function public.get_feed(double precision, double precision, integer, integer, integer) to anon, authenticated, service_role;
revoke execute on function public.get_feed_events(double precision, double precision, integer, integer) from public;
grant  execute on function public.get_feed_events(double precision, double precision, integer, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;


-- =====================================================================================
-- CONSULTAS DE VERIFICACIÓN (correr a mano tras aplicar)
-- =====================================================================================
/*
-- 1. Columnas nuevas (esperado: 11 filas).
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and (table_name, column_name) in (
  ('reviews','owner_reply'), ('reviews','owner_replied_at'), ('reviews','owner_reply_by'),
  ('claims','reject_reason'), ('claims','resolved_at'), ('claims','resolved_by'),
  ('notifications','link'), ('notifications','place_id'), ('notifications','dedupe_key'),
  ('places','owner_paused_at'), ('boosts','ended_at'))
order by 1, 2;

-- 2. Tabla nueva con RLS activa (esperado: true) y su única política de lectura.
select relrowsecurity from pg_class where oid = 'public.place_change_requests'::regclass;
select policyname, cmd from pg_policies where tablename = 'place_change_requests';

-- 3. Funciones nuevas: SECURITY DEFINER, search_path fijo y solo service_role
--    (esperado: prosecdef = true y proacl sin anon ni authenticated en las 5).
select proname, prosecdef, proconfig, proacl
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('place_metrics_series', 'place_boost_stats', 'admin_set_place_location',
                  'trg_notify_review', 'trg_notify_rsvp');

-- 4. Permisos por columna (esperado: reviews INSERT user_id/place_id/rating/body y UPDATE
--    rating/body; claims INSERT place_id/user_id/method/evidence; notifications UPDATE read;
--    nada para anon; ninguna fila de audit_log ni de escritura en place_change_requests).
select table_name, grantee, privilege_type, string_agg(column_name, ',' order by column_name)
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE')
  and table_name in ('reviews', 'claims', 'notifications', 'audit_log', 'place_change_requests')
group by 1, 2, 3 order by 1, 2, 3;

-- 5. audit_log cerrado (esperado: 0 filas).
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'audit_log' and grantee in ('anon', 'authenticated');

-- 6. Triggers (esperado: trg_notify_review en reviews, trg_notify_rsvp en event_rsvps).
select event_object_table, trigger_name, event_manipulation
from information_schema.triggers
where trigger_schema = 'public' and trigger_name in ('trg_notify_review', 'trg_notify_rsvp');

-- 7. La serie cuadra con interactions (tomar un lugar con actividad). El total de la serie
--    debe ser <= al de place_metrics: la serie excluye a los miembros del negocio y acota el
--    rango a días calendario de la ciudad.
select kind, sum(n) from public.place_metrics_series('<place_id>', 30, 'day') group by kind order by kind;
select * from public.place_metrics('<place_id>', 30) order by kind;
select * from public.place_metrics_series('<place_id>', 30, 'hour') order by bucket, kind;
select * from public.place_boost_stats('<place_id>');

-- 8. El feed sigue respondiendo con las mismas columnas (19 y 14).
select count(*) from public.get_feed(-41.3195, -72.9854, 25000, 5, 0);
select count(*) from public.get_feed_events(-41.3195, -72.9854, 25000, 5);

-- 9. Como anon / authenticated (desde la API), deben FALLAR:
--    rpc place_metrics_series / place_boost_stats / admin_set_place_location  -> 42501
--    insert en notifications, audit_log, place_change_requests                -> 42501
--    update reviews set owner_reply = '...' where user_id = auth.uid()         -> 42501
--    insert en claims con status = 'approved'                                  -> 42501
*/
