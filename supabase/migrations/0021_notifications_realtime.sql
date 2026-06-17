-- 0021 — Recordatorios de evento vía Realtime (en vez de push FCM, diferido).
-- Una tabla de notificaciones (RLS propia) + un job pg_cron que encola recordatorios para
-- quienes confirmaron asistencia a un evento que ocurre pronto. El cliente se suscribe por
-- Supabase Realtime y muestra el aviso en vivo + un fetch inicial de los no leídos.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                 -- event_reminder | ...
  title      text not null,
  body       text,
  event_id   uuid references events(id) on delete cascade,
  read       boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "own notifications read"   on public.notifications;
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications read"   on public.notifications for select using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Encola recordatorios para eventos que empiezan dentro de ~14h y a los que el usuario dijo "voy".
-- Idempotente: un único recordatorio por (usuario, evento).
create or replace function public.enqueue_event_reminders()
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, event_id)
  select r.user_id, 'event_reminder',
         'Hoy: ' || e.name,
         'En ' || p.name || ' · ' || to_char(e.starts_at at time zone 'America/Santiago', 'HH24:MI') || ' h',
         e.id
  from public.events e
  join public.event_rsvps r on r.event_id = e.id and r.status = 'going'
  join public.places p on p.id = e.place_id
  where e.status = 'approved'
    and e.starts_at between now() and now() + interval '14 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r.user_id and n.event_id = e.id and n.kind = 'event_reminder'
    );
$$;

-- Job horario (idempotente al re-aplicar).
do $$ begin
  perform cron.unschedule('event-reminders');
exception when others then null; end $$;
select cron.schedule('event-reminders', '0 * * * *', $$ select public.enqueue_event_reminders(); $$);

-- Habilita Realtime en la tabla.
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when others then null; end $$;
