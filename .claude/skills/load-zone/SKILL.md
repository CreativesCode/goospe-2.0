---
name: load-zone
description: |
  Carga una zona/ciudad nueva en Goospe de punta a punta (OSM → fotos → enriquecimiento IA por
  niveles) y la activa en el feed. Reusa el mismo pipeline que la vista admin /admin/loader.
  SOLO local (usa las llaves del dev: OPENAI, GOOGLE, MAPILLARY, Supabase service-role) y GASTA dinero.
  Activar cuando el usuario dice: carga una ciudad, agrega una zona, cargar lugares de, traer places de,
  importar una ciudad, expandir a, load zone, cargar región, dar de alta una ciudad, activar una zona.
  NO USAR para: la vista admin (esa ya existe en /admin/loader), ni para pagos/otras features.
---

# Skill: Cargar una zona nueva (load-zone)

Carga una ciudad nueva reusando el pipeline de `etl/lib/pipeline.mjs` (el MISMO que usa la vista
admin `/admin/loader`). Escribe progreso en `region_jobs` y deja la ciudad `is_active=true` al terminar.

## Antes de correr — CONFIRMAR con el humano

Esto **gasta dinero** (OpenAI por las anclas + Google Places) y **crea datos reales**. Antes de
ejecutar, confirma con el usuario:
1. **Ciudad exacta** (país, región/provincia, ciudad).
2. Que entiende que **se cobra** (para una ciudad chica de ~30–60 lugares suele ser <$0.50).

Requisitos: correr en **localhost**, con `.env.local` que tenga `OPENAI_API_KEY`,
`GOOGLE_MAPS_API_KEY`, `MAPILLARY_TOKEN` (opcional, fallback de fotos) y `SUPABASE_SERVICE_ROLE_KEY`.

## Pasos

1. **Catálogo de país/región: ya están los 249 países** (ISO 3166) en
   `etl/data/countries.json` (CLI) y `src/features/loader/data/geo-catalog.ts` (UI), generados por
   `scripts/gen-geo-catalog.cjs`. NO editar a mano: si algo falta, re-correr `node scripts/gen-geo-catalog.cjs`.

2. **Corre el cargador** (resuelve la ciudad en Nominatim, crea el job y corre el pipeline):
   ```bash
   node etl/load-zone.mjs --country CL --region "Los Lagos" --city "Frutillar"
   ```
   - Imprime los candidatos de Nominatim. Si el elegido (índice 0) no es el correcto, repite con
     `--index N` usando el índice del candidato correcto.
   - El pipeline avanza por etapas: OSM → fotos Google → IA (anclas) → Mapillary → activar.

3. **Reporta al usuario** al terminar: ciudad activada, nº de lugares insertados, anclas
   enriquecidas, fotos, y el costo (sale en el log / en `region_jobs.counts` y `ai_usage`).

## Notas

- **Enriquecimiento por niveles**: enriquece hasta `ZONE_ANCHOR_LIMIT` (env, default 60) lugares como
  tier `full` (prioriza los que tienen foto); el resto queda `tail` (on-demand, futuro).
- **Autocorrección de solape**: tras el import, `runZoneLoad` llama a la RPC `assign_nearest_city` que
  **jala** hacia la zona nueva los POIs vecinos (de otra ciudad) que caen en su bbox y le quedan más
  cerca. Arregla el "el primero que importa, gana" entre comunas que se solapan. El orden de carga deja
  de importar. Los jalados se re-enriquecen automáticamente (se les nula `ai_enriched_at`).
- **Cobertura**: el radio de la ciudad se auto-calcula del bbox. La `timezone` se deriva de las
  coordenadas con `tz-lookup` (preciso por ciudad) — ya no hay que ajustarla a mano.
- **Idempotente**: re-correr no re-paga el enriquecimiento (solo toca `ai_enriched_at IS NULL`) ni
  duplica fotos/lugares (upsert por slug). Útil si una etapa falló.
- **Mismo motor que el admin**: la vista `/admin/loader` hace exactamente esto vía `etl/run-zone.mjs`;
  este skill es la versión que orquesta el agente desde la terminal.
- Monitoreo: el progreso también es visible en `/admin/loader` (Realtime) y en `region_jobs`.
