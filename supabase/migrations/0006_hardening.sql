-- 0006 — Hardening según Supabase security advisors

-- search_path inmutable en funciones (advisor: function_search_path_mutable)
alter function public.ensure_place_stats()        set search_path = public;
alter function public.recompute_place_stats(uuid) set search_path = public;
alter function public.trg_reviews_stats()         set search_path = public;
alter function public.trg_favorites_count()       set search_path = public;
alter function public.touch_updated_at()          set search_path = public;
alter function public.recompute_trending()        set search_path = public;

-- Restringir EXECUTE de funciones SECURITY DEFINER (advisor: *_security_definer_function_executable).
-- Los triggers se ejecutan sin checar EXECUTE, así que revocar no rompe signup ni los agregados.
-- Los helpers de RLS sí los necesita `authenticated` (las políticas se evalúan como el usuario).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_admin()        from public;
revoke execute on function public.is_member(uuid)   from public;
revoke execute on function public.is_owner(uuid)    from public;

grant execute on function public.is_admin()      to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid)  to authenticated;
