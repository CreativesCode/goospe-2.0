-- 0040 — Fase 6 "Emails e informes programados" (.claude/PRPs/prp-legacy-y-brechas.md).
--
-- Idempotente: se puede correr dos veces sin error. UNA transacción (begin/commit propios).
-- Estado real leído de la BD el 12-oct-2026 (information_schema, pg_policies, pg_proc, cron.job).
--
-- SOLO CAMBIOS ADITIVOS. No cambia la firma ni las columnas de ninguna RPC existente y el código
-- desplegado hoy sigue funcionando con la migración aplicada (business_reports gana columnas con
-- default; el alta manual actual no las envía y queda como origin = 'manual').
--
-- Qué hace:
--   a) email_log          registro de CADA intento de envío (enviado, omitido, fallido) y candado
--                         de idempotencia (dedupe_key único). Solo service_role.
--   b) email_preferences  baja por categoría de email (weekly_report | digest | alerts | events).
--                         Sin fila = suscrito. Solo service_role: la baja pública entra por un
--                         token firmado que valida el servidor, no por la API.
--   c) job_runs           rastro de cada tarea programada (rutas /api/cron/* y pg_cron).
--   d) business_reports   + origin (manual | scheduled), sent_at, place_id. Índice único por
--                         (negocio, lugar, tipo, inicio de periodo) para los programados: un cron
--                         reintentado no regenera ni reenvía. Se cierra la escritura por la API.
--   e) place_metrics_range(uuid, timestamptz, timestamptz): métricas de un lugar en un rango
--                         exacto (la semana cerrada del informe). Solo service_role.
--   f) run_maintenance(): mantenimiento puro SQL (boosts vencidos, rate_limits, email_log,
--                         job_runs, notificaciones leídas antiguas). Solo service_role.
--   g) pg_cron            job diario 'goospe-maintenance' (re-ejecutable).
--
-- LO QUE NO HACE, a propósito: no poda `interactions`. Las estadísticas del dueño leen 90 días
-- y el informe semanal la última semana; con ~500 filas en total no hay nada que ganar. Cuando
-- haga falta, lo conservador es agregar primero a una tabla diaria y recién después borrar
-- solo `view_card` con más de 180 días.
--
-- REVISAR ANTES DE APLICAR EN PRODUCCIÓN:
--   · (f) borra filas: email_log con más de 180 días,
--     job_runs con más de 90 días y rate_limits vencidos. Ajustar los plazos si no convencen.
--   · (f) marca como 'ended' los boosts con ends_at pasado y apaga events.is_boosted de esos
--     eventos. El feed ya los ignoraba por fecha: solo cambia el estado guardado.
--   · (d) revoca INSERT/UPDATE/DELETE de business_reports a anon/authenticated. Hoy no hay
--     política de escritura (solo "read biz reports"), así que nadie escribía por la API.
--   · (g) agenda el job a las 05:23 UTC (≈ 02:23 en Chile). pg_cron corre como postgres.
--
-- Literales con tildes dentro de funciones: no hay (cuerpos ASCII, ver README de migraciones).
--
-- Contrato con el código (src/):
--   · email_log / email_preferences       src/lib/email/{send,preferences,alerts}.ts
--   · job_runs                            src/lib/cron/job-run.ts
--   · business_reports.origin/sent_at/place_id   src/lib/reports/weekly.ts, src/lib/cron/weekly.ts
--   · place_metrics_range                 src/lib/reports/weekly.ts
--   · run_maintenance                     src/lib/cron/maintenance.ts
--
-- ORDEN DE DESPLIEGUE: migración PRIMERO, código después.

begin;


-- =====================================================================================
-- a) EMAIL_LOG
-- =====================================================================================
create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  to_email    text not null,
  template    text not null,
  category    text not null,
  subject     text,
  status      text not null default 'queued',
  provider    text,
  provider_id text,
  error       text,
  dedupe_key  text,
  attempts    integer not null default 1,
  sent_at     timestamptz,
  meta        jsonb not null default '{}'::jsonb
);

-- 'queued' es transitorio: la fila se crea ANTES de llamar al proveedor (candado) y se cierra
-- con el resultado. Una fila 'queued' vieja es un envío que murió a mitad (ver run_maintenance).
alter table public.email_log drop constraint if exists email_log_status_check;
alter table public.email_log
  add constraint email_log_status_check
  check (status in ('queued', 'sent', 'skipped_no_provider', 'skipped_unsubscribed', 'failed'));

alter table public.email_log drop constraint if exists email_log_sizes_check;
alter table public.email_log
  add constraint email_log_sizes_check
  check (char_length(to_email) <= 320
     and char_length(template) <= 60
     and char_length(category) <= 40
     and (dedupe_key is null or char_length(dedupe_key) <= 256)
     and (error is null or char_length(error) <= 500));

-- Idempotencia: dos NULL no chocan, así que solo deduplica cuando hay clave.
create unique index if not exists email_log_dedupe_idx on public.email_log (dedupe_key);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_user_idx on public.email_log (user_id, created_at desc);
create index if not exists email_log_status_idx on public.email_log (status, updated_at);

alter table public.email_log enable row level security;
revoke all on table public.email_log from public, anon, authenticated;
grant  all on table public.email_log to service_role;


-- =====================================================================================
-- b) EMAIL_PREFERENCES
-- =====================================================================================
create table if not exists public.email_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null,
  subscribed boolean not null default true,
  source     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- Los emails transaccionales (reclamo recibido/resuelto, solicitud de cambio) no tienen
-- categoría aquí: no se pueden dar de baja.
alter table public.email_preferences drop constraint if exists email_preferences_category_check;
alter table public.email_preferences
  add constraint email_preferences_category_check
  check (category in ('weekly_report', 'digest', 'alerts', 'events'));

alter table public.email_preferences drop constraint if exists email_preferences_source_check;
alter table public.email_preferences
  add constraint email_preferences_source_check
  check (source is null or source in ('link', 'one_click', 'panel'));

alter table public.email_preferences enable row level security;
revoke all on table public.email_preferences from public, anon, authenticated;
grant  all on table public.email_preferences to service_role;


-- =====================================================================================
-- c) JOB_RUNS
-- =====================================================================================
create table if not exists public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  counts      jsonb not null default '{}'::jsonb,
  error       text
);

alter table public.job_runs drop constraint if exists job_runs_sizes_check;
alter table public.job_runs
  add constraint job_runs_sizes_check
  check (char_length(job) <= 60 and (error is null or char_length(error) <= 1000));

create index if not exists job_runs_job_idx on public.job_runs (job, started_at desc);

alter table public.job_runs enable row level security;
revoke all on table public.job_runs from public, anon, authenticated;
grant  all on table public.job_runs to service_role;


-- =====================================================================================
-- d) BUSINESS_REPORTS: origen, envío y lugar
-- =====================================================================================
alter table public.business_reports
  add column if not exists origin   text not null default 'manual',
  add column if not exists sent_at  timestamptz,
  add column if not exists place_id uuid references public.places(id) on delete cascade;

alter table public.business_reports drop constraint if exists business_reports_origin_check;
alter table public.business_reports
  add constraint business_reports_origin_check
  check (origin in ('manual', 'scheduled'));

-- El lugar vivía solo dentro de content->>'place_id'. Se copia a la columna donde sea un
-- uuid de un lugar que existe (hoy la tabla está vacía; queda por si se aplica más tarde).
-- Se compara como texto: así un valor que no sea uuid no hace fallar el cast.
update public.business_reports r
set place_id = p.id
from public.places p
where r.place_id is null
  and p.id::text = lower(r.content->>'place_id');

-- Idempotencia del informe programado: uno por negocio + lugar + tipo + semana. Los manuales
-- quedan fuera (el dueño puede regenerar el suyo cuando quiera).
create unique index if not exists business_reports_scheduled_uidx
  on public.business_reports (business_id, place_id, kind, period_start)
  where origin = 'scheduled';
create index if not exists business_reports_biz_idx
  on public.business_reports (business_id, kind, created_at desc);

-- Estado real: anon y authenticated tenían ALL de tabla y solo la política "read biz reports"
-- (SELECT). Se cierra la escritura también por grants (columna nueva en tabla expuesta: ver
-- "Aprendizajes" del PRP). La lectura de miembros no se toca.
revoke insert, update, delete, truncate on public.business_reports from public, anon, authenticated;


-- =====================================================================================
-- e) PLACE_METRICS_RANGE
-- =====================================================================================
-- Igual que place_metrics(uuid, int) pero con un rango exacto [p_from, p_to): la semana
-- cerrada (lunes a domingo, en la zona de la ciudad) que cubre el informe programado.
create or replace function public.place_metrics_range(
  p_place_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (kind text, n bigint)
language sql stable security definer set search_path = public, extensions as $$
  select i.kind, count(*) as n
  from public.interactions i
  where i.place_id = p_place_id
    and i.created_at >= p_from
    and i.created_at <  p_to
  group by i.kind;
$$;

revoke execute on function public.place_metrics_range(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.place_metrics_range(uuid, timestamptz, timestamptz) to service_role;


-- =====================================================================================
-- f) RUN_MAINTENANCE
-- =====================================================================================
-- Mantenimiento puro SQL. Devuelve cuántas filas tocó cada paso. La agenda pg_cron (g) y,
-- como respaldo, la ruta /api/cron/maintenance: correrlo dos veces el mismo día es inocuo.
create or replace function public.run_maintenance()
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_boosts  integer := 0;
  v_events  integer := 0;
  v_rate    integer := 0;
  v_stale   integer := 0;
  v_emails  integer := 0;
  v_jobs    integer := 0;
  v_notifs  integer := 0;
begin
  -- Boosts vencidos: el feed ya los ignora por fecha; aqui se cierra el estado guardado.
  -- ended_at conserva el fin real si el dueno lo termino antes.
  with ended as (
    update public.boosts
    set status = 'ended', ended_at = coalesce(ended_at, ends_at)
    where status = 'active' and ends_at < now()
    returning event_id
  ),
  unboosted as (
    update public.events e
    set is_boosted = false
    where e.is_boosted
      and e.id in (select event_id from ended where event_id is not null)
      and not exists (
        select 1 from public.boosts b
        where b.event_id = e.id and b.status = 'active' and b.ends_at >= now()
      )
    returning 1
  )
  select (select count(*) from ended), (select count(*) from unboosted) into v_boosts, v_events;

  delete from public.rate_limits where expires_at < now();
  get diagnostics v_rate = row_count;

  -- Envios que quedaron a medias (la funcion murio entre el candado y la respuesta).
  update public.email_log
  set status = 'failed', error = 'timeout: sin respuesta del envio', updated_at = now()
  where status = 'queued' and updated_at < now() - interval '1 hour';
  get diagnostics v_stale = row_count;

  delete from public.email_log where created_at < now() - interval '180 days';
  get diagnostics v_emails = row_count;

  delete from public.job_runs where started_at < now() - interval '90 days';
  get diagnostics v_jobs = row_count;

  -- Las notificaciones de los usuarios NO se podan aquí: borrar datos de usuarios de forma
  -- periódica queda pendiente de que el equipo fije el plazo.

  return jsonb_build_object(
    'boosts_ended', v_boosts,
    'events_unboosted', v_events,
    'rate_limits_pruned', v_rate,
    'emails_timed_out', v_stale,
    'email_log_pruned', v_emails,
    'job_runs_pruned', v_jobs,
    'notifications_pruned', v_notifs
  );
end$$;

revoke execute on function public.run_maintenance() from public, anon, authenticated;
grant  execute on function public.run_maintenance() to service_role;


-- =====================================================================================
-- g) PG_CRON: mantenimiento diario
-- =====================================================================================
-- Re-ejecutable: se desagenda si existe y se vuelve a agendar. El rastro queda en job_runs
-- (job = 'pg_maintenance'); si la función falla, el error queda en cron.job_run_details.
do $$ begin
  perform cron.unschedule('goospe-maintenance');
exception when others then null; end $$;

select cron.schedule(
  'goospe-maintenance',
  '23 5 * * *',
  $cron$
    insert into public.job_runs (job, started_at, finished_at, ok, counts)
    select 'pg_maintenance', now(), clock_timestamp(), true, public.run_maintenance();
  $cron$
);

commit;

notify pgrst, 'reload schema';


-- =====================================================================================
-- VERIFICACIÓN (correr a mano después de aplicar)
-- =====================================================================================
/*
-- 1. Tablas nuevas: RLS activa, sin políticas y sin permisos para anon/authenticated
--    (esperado: 3 filas con rls = true, policies = 0, client_grants = 0).
select c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       (select count(*) from information_schema.role_table_grants g
        where g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon', 'authenticated')) as client_grants
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relname in ('email_log', 'email_preferences', 'job_runs');

-- 2. business_reports: columnas nuevas y solo SELECT para anon/authenticated.
select column_name, data_type, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'business_reports' and column_name in ('origin', 'sent_at', 'place_id');
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'business_reports' and grantee in ('anon', 'authenticated');

-- 3. Funciones solo para service_role (esperado: sin anon ni authenticated en el ACL).
select proname, proacl from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('place_metrics_range', 'run_maintenance');

-- 4. El job quedó agendado una sola vez.
select jobname, schedule, active from cron.job where jobname = 'goospe-maintenance';

-- 5. La métrica por rango cuadra con place_metrics en los últimos 7 días (tomar un lugar con actividad).
select * from public.place_metrics_range('<place_id>', now() - interval '7 days', now()) order by kind;
select * from public.place_metrics('<place_id>', 7) order by kind;

-- 6. Qué tocaría el mantenimiento ANTES de dejarlo correr (solo lectura).
select (select count(*) from public.boosts where status = 'active' and ends_at < now()) as boosts_vencidos,
       (select count(*) from public.rate_limits where expires_at < now()) as rate_limits_vencidos,
       (select count(*) from public.notifications where read and created_at < now() - interval '90 days') as notificaciones_a_borrar;

-- 7. Tras la primera noche: el rastro del job.
select job, started_at, ok, counts from public.job_runs order by started_at desc limit 5;
select status, return_message, start_time from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'goospe-maintenance') order by start_time desc limit 3;

-- 8. Como anon / authenticated (desde la API), deben FALLAR con 42501:
--    select / insert en email_log, email_preferences, job_runs
--    rpc place_metrics_range / run_maintenance
--    insert en business_reports
*/
