# Migraciones

Fuente de verdad del esquema. Se aplican **en orden de nombre de archivo** (orden alfabético),
de `0001` a la última. Estado al 12-oct-2026: aplicadas en producción hasta `0035`; `0036` es
un no-op funcional pendiente de aplicar.

## Orden real y casos especiales

- **Hay dos `0030`.** No se renombran: ya están aplicadas y son independientes entre sí. El
  orden real es el alfabético:
  1. `0030_coverage_requests.sql` (tabla `coverage_requests` + `admin_coverage_zones`)
  2. `0030_place_business_status.sql` (`places.business_status` + filtros en las RPC)
- **`0033` → desplegar código → `0034`.** Nunca juntas (ver el encabezado de cada una). Al
  revés, el conserje anónimo responde 429 y las reseñas nuevas quedan invisibles.
- **`0035`**: migración primero, código después.
- **`0036`**: versiona `assign_nearest_city`, que existía en la BD sin archivo. Misma
  definición y mismos permisos que ya tiene producción.
- La numeración continúa en `0037`. No reutilizar un número.

## Drift conocido entre el historial de la BD y el repo

La tabla `supabase_migrations.schema_migrations` de producción **no refleja este directorio**:
la mayoría de los archivos se aplicó por la Management API (que no escribe historial) y unos
pocos desde el panel o el MCP con otros nombres. Lo que registra la BD:

| Versión en la BD | Nombre en la BD | Archivo equivalente en el repo |
|---|---|---|
| 20260618011546 | `place_stats_triggers_security_definer` | `0031_stats_triggers_definer.sql` |
| 20260618020138 | `admin_save_place_rpc` | sin archivo propio; la función quedó versionada en `0035_phase2_fixes.sql` |
| 20260620005841 | `keepalive_ping` | `0027_keepalive_ping.sql` |
| 20260620153642 | `0028_coverage_waitlist` | `0028_coverage_waitlist.sql` |
| 20260620163506 | `0029_region_jobs_enrich_tier` | `0029_region_jobs_enrich_tier.sql` |
| 20260620183954 | `0030_assign_nearest_city` | sin archivo propio; versionada en `0036_versionar_rpcs.sql` |
| 20260620200532 | `0031_fix_ai_breakdown_encoding` | sin archivo propio (corrección de `admin_ai_usage_breakdown`; por confirmar que `0024` trae la versión corregida) |
| 20260714203118 | `place_business_status` | `0030_place_business_status.sql` |

Consecuencias:

- **No usar `supabase db push` ni `supabase migration repair` a ciegas**: el CLI creería que
  faltan casi todas las migraciones e intentaría reaplicarlas.
- Antes de escribir SQL nuevo sobre un objeto existente, leer su estado real
  (`pg_get_functiondef`, `information_schema`), no el archivo.
- Pendiente: levantar una base vacía con estos archivos (rama de Supabase o stack local) y
  comparar el esquema con producción. Hasta entonces la reproducibilidad está revisada a nivel
  de funciones (todas las de `public` tienen archivo), no de tablas, políticas ni índices.

## Convención de permisos (viene de `0033`)

Supabase da `EXECUTE` a `anon` y `authenticated` sobre todo objeto nuevo de `public`
(default ACL). Por eso **cada función nueva lleva su `revoke` en la misma migración**:

```sql
revoke execute on function public.mi_funcion(args) from public, anon, authenticated;
grant  execute on function public.mi_funcion(args) to service_role;
```

- Toda función `security definer` interna (admin, ETL, cron, triggers, contadores) queda solo
  para `service_role`. El código la llama con el cliente admin **después** de validar sesión y
  permiso.
- Las únicas abiertas a propósito están listadas en `0033` (bloque "ABIERTAS"): `get_feed`,
  `get_feed_events`, `resolve_coverage`, `event_gender_stats`, `is_admin`, `is_member`,
  `is_owner`, `places_lnglat`, `search_places`, `match_places`, `ping`, `touch_updated_at`.
  Abrir otra exige justificarlo en el encabezado de la migración.
- Si se hace `drop function` + `create` (cambio de firma o de columnas devueltas), los grants
  se pierden: volver a darlos y terminar con `notify pgrst, 'reload schema'`.
- Funciones que usan PostGIS, pg_trgm, vector o unaccent: `set search_path = public, extensions`.
- Toda tabla nueva: RLS activa y `revoke` explícito de lo que `anon`/`authenticated` no deban tocar.

## Cómo se aplican hoy

No hay pipeline automático. Cada migración se aplica a mano contra producción:

1. Escribir el archivo idempotente (`if not exists`, `create or replace`, `begin`/`commit`
   propios) con las consultas de verificación comentadas al final.
2. Aplicarlo por la **Management API** (`POST /v1/projects/<ref>/database/query`) con el token
   del CLI de Supabase, o con `apply_migration` del MCP cuando está disponible. La Management
   API rechaza cuerpos con comentarios o caracteres no ASCII (WAF): enviar el SQL sin
   comentarios ni acentos.
3. Correr las consultas de verificación del final del archivo.
4. Regenerar `src/lib/database.types.ts` (`generate_typescript_types` del MCP o
   `supabase gen types typescript`) y correr `npm run typecheck`.
