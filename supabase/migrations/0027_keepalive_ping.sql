-- 0027 — RPC `public.ping()` para keepalive del proyecto Supabase free.
--
-- Supabase free pausa el proyecto tras ~7 días sin actividad en la BD. Un
-- GitHub Actions cron invoca esta función a diario vía POST /rest/v1/rpc/ping
-- con la anon key, manteniendo el proyecto activo. "Tocar" solo el edge no
-- cuenta: el contador de inactividad mide actividad en Postgres, así que un
-- RPC SQL garantiza que el ping cuente.
--
-- Retorna now() para que el ping sea observable en los logs del workflow.
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select now();
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
