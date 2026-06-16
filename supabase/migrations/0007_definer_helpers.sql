-- 0007 — Cerrar advisors de SECURITY DEFINER ejecutables por anon/authenticated.

-- Los helpers de RLS solo consultan filas que el propio usuario ya puede ver bajo RLS
-- (business_members.user_id = auth.uid(); profiles de lectura pública), así que no
-- necesitan SECURITY DEFINER. Pasándolos a INVOKER el advisor deja de marcarlos y la
-- semántica de las políticas no cambia.
create or replace function public.is_admin()
returns boolean language sql stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_member(b uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = b and user_id = auth.uid());
$$;

create or replace function public.is_owner(b uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.business_members
                 where business_id = b and user_id = auth.uid() and role = 'owner');
$$;

-- handle_new_user debe seguir SECURITY DEFINER (inserta en profiles durante el signup).
-- Como trigger NO requiere EXECUTE para dispararse → revocarlo silencia el advisor sin romper nada.
revoke execute on function public.handle_new_user() from anon, authenticated;
