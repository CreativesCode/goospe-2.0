-- 0008 — Ciudad piloto: Puerto Varas, Los Lagos, Chile (decisión cerrada).
-- Centro aprox. plaza de armas; zona horaria de Chile continental.
insert into public.cities (name, slug, region, country, center, timezone, is_active)
values (
  'Puerto Varas', 'puerto-varas', 'Los Lagos', 'Chile',
  extensions.ST_SetSRID(extensions.ST_MakePoint(-72.9854, -41.3195), 4326)::geography,
  'America/Santiago', true
)
on conflict (slug) do update
  set region = excluded.region,
      country = excluded.country,
      center = excluded.center,
      timezone = excluded.timezone,
      is_active = true;
