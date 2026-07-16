-- 0032 — Conteo público de asistentes por evento, con desglose por género.
--
-- Objetivo: en la cartelera/feed (vista para todo el mundo) mostrar SOLO la cantidad de
-- personas que asistirán y su desglose hombres/mujeres. Nunca nombres ni datos personales.
--
-- El género del usuario se guarda en profiles.onboarding->>'gender' ('male' | 'female' | 'other'),
-- capturado de forma opcional en el onboarding. Regla de negocio: el desglose siempre suma el
-- total → mujeres = quienes declararon 'female'; masculino = TODO el resto (incluye a quienes no
-- declararon género y a 'prefiero no decir'). Así male + female = going.
--
-- SECURITY DEFINER: la RLS "own rsvps" impide que un usuario lea los RSVP de otros. Esta función
-- necesita agregarlos, pero devuelve EXCLUSIVAMENTE conteos (bigint) — jamás identidad ni PII —,
-- por lo que es seguro exponerla a anon/authenticated.
create or replace function public.event_gender_stats(p_event_ids uuid[])
returns table (event_id uuid, going bigint, male bigint, female bigint)
language sql stable security definer set search_path = public as $$
  select r.event_id,
         count(*) filter (where r.status = 'going')                                                        as going,
         count(*) filter (where r.status = 'going' and coalesce(p.onboarding->>'gender', '') <> 'female')   as male,
         count(*) filter (where r.status = 'going' and (p.onboarding->>'gender') = 'female')                as female
  from public.event_rsvps r
  left join public.profiles p on p.id = r.user_id
  where r.event_id = any(p_event_ids)
  group by r.event_id;
$$;

grant execute on function public.event_gender_stats(uuid[]) to anon, authenticated;
