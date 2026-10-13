-- 0042 — Fase 7 "Lado usuario", parte B: cuenta, notificaciones y feedback
-- (.claude/PRPs/prp-legacy-y-brechas.md, doc 15 §4.6).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Estado real leído de la BD el 12-oct-2026 (information_schema, pg_constraint, pg_policies,
-- pg_trigger), no de los archivos del repo.
--
-- SOLO CAMBIOS ADITIVOS. No toca columnas, políticas, FKs ni funciones existentes.
--
-- Qué hace:
--   a) profiles + terms_accepted_at, terms_version (aceptación de términos al registrarse).
--      NO son escribibles por el usuario: profiles no tiene INSERT/UPDATE de tabla para
--      `authenticated` desde 0033 (solo las 4 columnas con grant), así que una columna nueva
--      nace cerrada. Se deja además el revoke por columna explícito y su verificación.
--   b) notification_preferences: grupos de avisos in-app silenciados por usuario
--      (hoy: "saved_places"). Solo service_role; el código la lee/escribe tras validar sesión.
--   c) feedback: feedback general y "sugerir corrección" de un lugar. Solo service_role.
--   d) favorites_place_idx: buscar quién guardó un lugar (aviso de evento nuevo). La PK es
--      (user_id, place_id) y no sirve para buscar por lugar.
--   e) delete_user_account_data(uuid): limpieza de datos de un usuario ANTES de borrar su fila
--      de auth.users. Solo service_role. BORRA Y ANONIMIZA FILAS: leer el bloque (e) entero.
--
-- Por qué (e) es una función y no varias llamadas desde la server action: son ~10 sentencias
-- que deben ocurrir todas o ninguna, y PostgREST no ofrece transacción entre llamadas. La
-- función NO borra auth.users: eso lo hace el código con la Admin API de Auth justo después
-- (GoTrue revoca sesiones e identidades); el resto cae por los ON DELETE CASCADE que ya existen.
--
-- FKs hacia auth.users leídas de la BD (12-oct-2026). Las que NO tienen regla ON DELETE
-- bloquean el borrado del usuario y por eso la función las atiende una por una:
--   · sin regla (bloquean): reviews.user_id, claims.user_id, place_photos.author_id,
--     interactions.user_id, devices.user_id, concierge_quota.user_id, moderation_queue.resolved_by
--   · cascade (no hay que hacer nada): profiles, taste_profiles, favorites, event_rsvps,
--     notifications, business_members, place_change_requests.user_id, place_proposals.user_id,
--     email_preferences, y las nuevas notification_preferences
--   · set null: reviews.owner_reply_by, claims.resolved_by, *.resolved_by, email_log.user_id,
--     y la nueva feedback.user_id / feedback.resolved_by
--   · sin FK (uuid suelto): audit_log.user_id, ai_usage.user_id
-- Si una migración futura añade otra FK a auth.users sin ON DELETE, hay que sumarla aquí o el
-- borrado de cuenta fallará (falla cerrado: no borra nada a medias).
--
-- Literales con tildes dentro de funciones: no hay (cuerpo ASCII puro, apto para la Management API).
--
-- Contrato con el código (src/):
--   · profiles.terms_*              src/actions/auth.ts (signup), src/features/profile/terms.ts
--   · notification_preferences      src/lib/notification-prefs.ts, src/actions/notifications.ts
--   · feedback                      src/actions/feedback.ts, src/actions/admin-feedback.ts, /admin/feedback
--   · delete_user_account_data      src/actions/account.ts (deleteAccount)
--   · favorites_place_idx           src/lib/notify-saved.ts
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después. El código desplegado hoy no conoce
-- ninguno de estos objetos y sigue funcionando igual con la migración aplicada.

begin;


-- =====================================================================================
-- a) PROFILES: aceptación de términos
-- =====================================================================================
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

alter table public.profiles drop constraint if exists profiles_terms_version_check;
alter table public.profiles
  add constraint profiles_terms_version_check
  check (terms_version is null or char_length(terms_version) <= 20);

-- Cerradas al usuario: las fija el servidor (service role) al registrarse. Sin efecto si ya
-- no había privilegio (es el caso tras 0033), pero deja la intención escrita en el esquema.
revoke insert (terms_accepted_at, terms_version), update (terms_accepted_at, terms_version)
  on public.profiles from public, anon, authenticated;

comment on column public.profiles.terms_accepted_at is
  'Momento en que acepto los terminos al registrarse. Null = cuenta anterior a 0042 (no se bloquea). Solo lo escribe el servidor.';


-- =====================================================================================
-- b) NOTIFICATION_PREFERENCES: avisos in-app silenciados
-- =====================================================================================
create table if not exists public.notification_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  muted      text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint notification_preferences_muted_check check (cardinality(muted) <= 20)
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant  select, insert, update, delete on public.notification_preferences to service_role;

comment on table public.notification_preferences is
  'Grupos de avisos in-app que el usuario silencio (p. ej. saved_places). Solo service_role.';


-- =====================================================================================
-- c) FEEDBACK: feedback general y correcciones de un lugar
-- =====================================================================================
create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,
  category      text not null,
  message       text,
  place_id      uuid references public.places(id) on delete cascade,
  -- Autor si tenia sesion. Al eliminar su cuenta el feedback queda anonimo.
  user_id       uuid references auth.users(id) on delete set null,
  -- Solo en feedback general y solo si la persona lo escribe para que le respondan.
  contact_email text,
  -- HMAC de la IP (src/lib/rate-limit.ts clientKey), nunca la IP: sirve para ver abuso anonimo.
  client_key    text,
  page          text,
  status        text not null default 'open',
  admin_note    text,
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint feedback_kind_check     check (kind in ('general', 'correction')),
  constraint feedback_category_check check (
    (kind = 'general'    and category in ('bug', 'idea', 'content', 'account', 'other')) or
    (kind = 'correction' and category in ('hours', 'closed', 'location', 'duplicate', 'info', 'other'))
  ),
  constraint feedback_place_check    check (kind <> 'correction' or place_id is not null),
  constraint feedback_status_check   check (status in ('open', 'resolved', 'dismissed')),
  constraint feedback_message_check  check (message is null or char_length(message) <= 1000),
  constraint feedback_email_check    check (contact_email is null or char_length(contact_email) <= 254),
  constraint feedback_page_check     check (page is null or char_length(page) <= 300),
  constraint feedback_note_check     check (admin_note is null or char_length(admin_note) <= 500)
);

create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_place_idx  on public.feedback (place_id) where place_id is not null;
create index if not exists feedback_user_idx   on public.feedback (user_id) where user_id is not null;

alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;
grant  select, insert, update, delete on public.feedback to service_role;

comment on table public.feedback is
  'Feedback general y sugerencias de correccion de un lugar. Solo service_role: entra por src/actions/feedback.ts (Zod + rate limit) y lo resuelve un admin en /admin/feedback.';


-- =====================================================================================
-- d) FAVORITES: indice por lugar
-- =====================================================================================
create index if not exists favorites_place_idx on public.favorites (place_id);


-- =====================================================================================
-- e) DELETE_USER_ACCOUNT_DATA: limpieza previa al borrado de una cuenta
-- =====================================================================================
-- Que hace con cada cosa (lo mismo que explica la pantalla "Eliminar cuenta"):
--   SE BORRA      reviews del usuario (con la respuesta del negocio que colgaba de ellas; el
--                 rating del lugar se recalcula por trg_reviews_stats), sus reclamos (traen
--                 nombre y telefono en `evidence`), las fotos que aporto como usuario
--                 (source='user'; los archivos los quita el codigo con las rutas devueltas),
--                 devices, concierge_quota, y un negocio del que era el unico miembro y que
--                 no tiene lugares ni suscripciones.
--   SE ANONIMIZA  interactions (user_id y device_id a null: las metricas agregadas de los
--                 lugares no cambian), place_photos de otro origen (fotos de ficha subidas
--                 como dueno: siguen siendo del negocio, sin autor), ai_usage.user_id,
--                 moderation_queue.resolved_by, email_log.to_email (se conserva el registro
--                 del envio sin la direccion), audit_log.ip y feedback (queda sin autor ni
--                 email de contacto).
--   SE CONSERVA   audit_log (bitacora de seguridad; queda un uuid que ya no apunta a nadie).
--   CAE DESPUES   por ON DELETE CASCADE al borrar auth.users: profiles, taste_profiles,
--                 favorites (el contador baja por trg_favorites_count), event_rsvps,
--                 notifications, business_members, place_change_requests, place_proposals,
--                 email_preferences, notification_preferences.
--
-- Guardas (ademas de las del codigo; aqui son la ultima linea):
--   · un llamador con sesion de usuario solo puede pasar su propio id;
--   · no se borra una cuenta admin;
--   · no se borra a quien es el ultimo dueno de un negocio que tiene lugares: esos lugares
--     quedarian reclamados sin nadie detras. Se libera antes desde /admin/claims.
-- Cualquier guarda o error aborta TODO (una sola transaccion): nunca queda a medias.
create or replace function public.delete_user_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paths      text[];
  v_reviews    integer;
  v_photos     integer;
  v_claims     integer;
  v_inter      integer;
  v_businesses integer;
begin
  if p_user_id is null then
    raise exception 'delete_user_account_data: user id requerido';
  end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'delete_user_account_data: solo la propia cuenta';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'delete_user_account_data: usuario inexistente';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_admin) then
    raise exception 'account_delete_blocked_admin';
  end if;
  if exists (
    select 1
      from public.business_members m
     where m.user_id = p_user_id
       and exists (select 1 from public.places p where p.business_id = m.business_id)
       and not exists (
         select 1 from public.business_members o
          where o.business_id = m.business_id
            and o.user_id <> p_user_id
            and coalesce(o.role, 'owner') = 'owner'
       )
  ) then
    raise exception 'account_delete_blocked_business';
  end if;

  select coalesce(array_agg(storage_path), '{}') into v_paths
    from public.place_photos
   where author_id = p_user_id and source = 'user' and storage_path is not null;

  delete from public.reviews where user_id = p_user_id;
  get diagnostics v_reviews = row_count;

  delete from public.place_photos where author_id = p_user_id and source = 'user';
  get diagnostics v_photos = row_count;
  update public.place_photos set author_id = null where author_id = p_user_id;

  delete from public.claims where user_id = p_user_id;
  get diagnostics v_claims = row_count;

  update public.interactions set user_id = null, device_id = null where user_id = p_user_id;
  get diagnostics v_inter = row_count;

  delete from public.devices         where user_id = p_user_id;
  delete from public.concierge_quota where user_id = p_user_id;
  update public.moderation_queue set resolved_by = null where resolved_by = p_user_id;
  update public.ai_usage         set user_id = null     where user_id = p_user_id;
  update public.email_log        set to_email = 'eliminado@invalid' where user_id = p_user_id;
  update public.audit_log        set ip = null where user_id = p_user_id and ip is not null;
  -- user_id pasa a null por la FK al borrar auth.users; aqui se quita ademas el email de contacto.
  update public.feedback         set contact_email = null where user_id = p_user_id and contact_email is not null;

  -- Negocio vacio del que era el unico miembro: no queda nadie que lo use.
  delete from public.businesses b
   where exists (select 1 from public.business_members m where m.business_id = b.id and m.user_id = p_user_id)
     and not exists (select 1 from public.business_members o where o.business_id = b.id and o.user_id <> p_user_id)
     and not exists (select 1 from public.places p where p.business_id = b.id)
     and not exists (select 1 from public.subscriptions s where s.business_id = b.id);
  get diagnostics v_businesses = row_count;

  return jsonb_build_object(
    'reviews', v_reviews,
    'photos', v_photos,
    'claims', v_claims,
    'interactions', v_inter,
    'businesses', v_businesses,
    'storage_paths', to_jsonb(v_paths)
  );
end $$;

revoke execute on function public.delete_user_account_data(uuid) from public, anon, authenticated;
grant  execute on function public.delete_user_account_data(uuid) to service_role;

comment on function public.delete_user_account_data(uuid) is
  'Borra/anonimiza los datos de un usuario antes de eliminar su fila de auth.users. DESTRUCTIVA. Solo service_role; la llama deleteAccount tras re-autenticar con contrasena.';


commit;

notify pgrst, 'reload schema';


-- =====================================================================================
-- VERIFICACION (correr a mano tras aplicar)
-- =====================================================================================
-- 1. El usuario NO puede escribir las columnas nuevas de profiles.
--    Esperado: authenticated = avatar_url, birth_year, display_name, home_city_id (igual que antes).
-- select grantee, string_agg(column_name, ', ' order by column_name)
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'profiles'
--    and privilege_type = 'UPDATE' and grantee in ('anon', 'authenticated')
--  group by grantee;
--
-- 2. Tablas nuevas: RLS activa y sin privilegios para anon/authenticated. Esperado: 0 filas en
--    la segunda consulta.
-- select relname, relrowsecurity from pg_class
--  where relnamespace = 'public'::regnamespace and relname in ('feedback', 'notification_preferences');
-- select table_name, grantee, privilege_type from information_schema.table_privileges
--  where table_schema = 'public' and table_name in ('feedback', 'notification_preferences')
--    and grantee in ('anon', 'authenticated', 'PUBLIC');
--
-- 3. La funcion destructiva solo la ejecuta service_role. Esperado: false, false, true.
-- select has_function_privilege('anon', 'public.delete_user_account_data(uuid)', 'execute'),
--        has_function_privilege('authenticated', 'public.delete_user_account_data(uuid)', 'execute'),
--        has_function_privilege('service_role', 'public.delete_user_account_data(uuid)', 'execute');
--
-- 4. FKs hacia auth.users sin ON DELETE: deben ser exactamente las 7 del encabezado. Si aparece
--    otra, sumarla a delete_user_account_data.
-- select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
--  where contype = 'f' and confrelid = 'auth.users'::regclass and connamespace = 'public'::regnamespace
--    and pg_get_constraintdef(oid) !~ 'ON DELETE';
--
-- NO probar delete_user_account_data contra una cuenta real: no tiene vuelta atras.
