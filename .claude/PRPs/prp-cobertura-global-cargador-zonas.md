# PRP-001: Cobertura Global + Cargador de Zonas (Multi-Ciudad)

> **Estado**: IMPLEMENTADO (Fases 1–4 ✅) — pendiente: 1er run real end-to-end de una ciudad chica
> **Fecha**: 2026-06-20
> **Decisión confirmada**: el feed se filtra por `city_id` de la zona resuelta + `is_active=true` (no por radio puro).
> **Proyecto**: goospe-2.0

---

## Objetivo

Convertir Goospe de una app mono-ciudad (Puerto Varas) a una app multi-ciudad lista para abrirse en cualquier parte del mundo: (1) cuando el usuario está fuera de una zona activa, ve una pantalla de "aún no llegamos a tu zona" con captura de waitlist y el feed bloqueado; y (2) un cargador admin **local-only** (3 selects País → Región → Ciudad) que reusa el pipeline ETL de `etl/` para traer, enriquecer y fotografiar una nueva ciudad de punta a punta, con progreso en vivo vía una tabla `region_jobs`, dejándola `is_active=true` al terminar.

## Por Qué

| Problema | Solución |
|----------|----------|
| Un usuario fuera de Puerto Varas abre la app y ve un feed vacío o lleno de lugares a 9.000 km. | Detección de cobertura: si está fuera de toda zona activa → pantalla "pronto en tu zona" + waitlist, feed bloqueado. |
| Cargar una ciudad nueva hoy implica editar a mano constantes hardcodeadas (`CITY_ID`, `BBOX`, `CITY_SLUG`) en 3 scripts distintos y correrlos en secuencia sin visibilidad. | Cargador parametrizable por zona con un job persistido (`region_jobs`) y progreso en vivo en `/admin/loader`. |
| Vercel tiene límites de tiempo/CPU incompatibles con un ETL largo (Overpass + OpenAI + descargas de fotos). | Ejecución LOCAL-ONLY: el cargador corre en la máquina del dev con sus llaves; la ruta admin solo se expone en `localhost`. |
| No hay forma de saber qué demanda hay en ciudades sin cobertura. | La waitlist captura emails por zona → prioriza qué ciudad cargar siguiente. |

**Valor de negocio**: desbloquea la expansión geográfica (de 1 a N ciudades) sin trabajo manual repetido por ciudad, convierte el tráfico fuera de cobertura en demanda medible (waitlist), y mantiene el costo de IA acotado vía enriquecimiento por niveles (~50 anclas completas + cola larga on-demand).

## Qué

### Criterios de Éxito
- [ ] Un usuario con GPS dentro de Puerto Varas ve el feed normal; uno fuera de toda zona activa ve la pantalla "pronto en tu zona" con el feed bloqueado.
- [ ] La pantalla fuera de cobertura captura email en una tabla `waitlist` (con la zona/coords detectada) y confirma al usuario.
- [ ] La landing lista dinámicamente las ciudades `is_active=true` ("disponible en Puerto Varas…") + mensaje "seguimos creciendo".
- [ ] `/admin/loader` es accesible SOLO en `localhost` (oculto y bloqueado en producción), con 3 selects encadenados País → Región → Ciudad (Ciudad resuelta dinámicamente vía Nominatim, devolviendo bbox/área).
- [ ] Lanzar el cargador para una ciudad nueva ejecuta el pipeline completo (OSM import → dedupe → categorías → insert → enrich IA por niveles → fotos Google+Mapillary) creando un `region_jobs` con progreso/log visible en vivo.
- [ ] Al terminar el job, la ciudad queda `is_active=true` y sus places aparecen en el feed para usuarios en esa zona.
- [ ] Existe un skill `/load-zone` (+ subagente) que orquesta el MISMO pipeline núcleo y escribe en el MISMO `region_jobs`.
- [ ] `npm run typecheck` y `npm run build` pasan; `NEXT_PUBLIC_FORCE_LOCATION` sigue funcionando para forzar Puerto Varas en dev.

### Comportamiento Esperado

**Happy path usuario (cobertura):** abre `/feed` → `getPosition()` resuelve GPS → se consulta `resolve_coverage(lat,lng)` (RPC PostGIS) → si cae dentro del radio/bbox de una ciudad activa, el feed carga con esa ciudad como ancla; si no, se renderiza `<OutOfCoverageScreen>` que bloquea el feed, muestra las zonas activas y un formulario de waitlist (email + coords detectadas → tabla `waitlist`).

**Happy path admin (cargar zona):** dev en localhost entra a `/admin/loader` → elige País (dataset ISO-3166-2 estático) → Región (del mismo dataset) → Ciudad (búsqueda Nominatim dentro de la región, devuelve bbox/center) → confirma → se crea un `region_jobs` (status `queued`) y arranca el runner local → la vista muestra barra de progreso + log en vivo (Supabase Realtime sobre `region_jobs`) mientras el pipeline avanza por etapas (osm → dedupe → insert → enrich-anclas → fotos → enrich-cola) → al terminar (`status=done`) la ciudad pasa a `is_active=true` y aparece en la landing y el feed.

---

## Contexto

### Referencias (código existente verificado)
- `etl/osm-import.mjs` — import OSM determinista. **Hoy hardcodea** `CITY_ID=1`, `CITY_SLUG='puerto-varas'`, `BBOX`. Dedupe por nombre normalizado <50m, mapeo `category_mappings` (osm_tag→category_id), upsert `places` + `place_categories`. **Refactor objetivo**: extraer a función `importOsm({ cityId, slug, bbox, area })`.
- `etl/enrich-places.mjs` — enriquecimiento IA idempotente (`ai_enriched_at IS NULL`), `pool()` concurrencia 5, registra costo en `ai_usage`. SYSTEM prompt menciona "Puerto Varas" hardcodeado → parametrizar por ciudad.
- `etl/google-photos.mjs` — Google Places (New) Text Search; guarda refs a `/api/place-photo` en `place_photos` (source `google`, status `approved`). No descarga bytes (ToS). Idempotente.
- `etl/probe-mapillary.mjs` — fallback de fotos; con `--save` descarga al bucket `places` (status `pending`). Usa RPC `places_lnglat`.
- `etl/osm-images.mjs` — backfill fotos `image`/`wikimedia_commons` + Instagram. Hardcodea `BBOX`.
- `etl/foursquare-photos.mjs` — fuente adicional de fotos.
- `etl/lib/ai.mjs` — capa swappable `{ enrichText, embed }`, OpenAI gpt-4o + text-embedding-3-large@1024d, `costUSD()`.
- `etl/lib/storage.mjs` — `uploadFromUrl()` al bucket de Storage.
- `src/lib/geo.ts` — `getPosition()`: `NEXT_PUBLIC_FORCE_LOCATION=1` → Puerto Varas; GPS; fallback Puerto Varas. `GeoResult = { lat, lng, source }`.
- `src/features/feed/use-feed.ts` — `LOCATION_LABEL='Puerto Varas'` hardcodeado; llama `get_feed` con radio 25km. Punto de inserción del gate de cobertura.
- `src/app/feed/page.tsx` — semilla SSR con coords Puerto Varas hardcodeadas (`SEED`).
- `src/app/page.tsx` — landing; ya lee `count` de places publicados; copy "Puerto Varas" hardcodeado en múltiples lugares.
- `src/app/admin/layout.tsx` — guard `isAdmin(user.id)`; `<AdminNav>` define el menú.
- `src/features/admin/AdminNav.tsx` — array `ITEMS` del menú admin (aquí se añade "Cargador" condicional a localhost).
- `supabase/migrations/0012_get_feed.sql` — RPC `get_feed(lat,lng,radius,limit,offset)` PostGIS; filtra `is_published` + `ST_DWithin`. NO filtra por ciudad activa (a considerar).
- `supabase/migrations/0002_schema.sql` — tabla `cities { id bigint, name, slug unique, region, country, center geography(point), timezone, is_active bool default false }`. `places.city_id → cities(id)`. **Falta cobertura espacial por ciudad** (radio o bbox).
- `docs/09-estado-implementacion.md` §Fase 1 — define los **3 niveles de enriquecimiento** (ancla / completo / cola larga) + **enrich on-demand al primer view** (objetivo a implementar; hoy todo se enriquece igual).
- APIs externas: Overpass API (`overpass-api.de/api/interpreter`), Nominatim (`nominatim.openstreetmap.org/search`), Google Places (New), Mapillary Graph API.

### Arquitectura Propuesta (Feature-First)
```
src/features/coverage/
├── components/
│   ├── OutOfCoverageScreen.tsx   # pantalla "pronto en tu zona" + waitlist
│   └── WaitlistForm.tsx
├── hooks/
│   └── useCoverage.ts            # GPS → resolve_coverage RPC → { covered, city }
├── services/
│   └── coverage.ts               # llamadas RPC/insert waitlist
└── types/

src/features/loader/              # vista admin del cargador (local-only)
├── components/
│   ├── ZonePicker.tsx            # 3 selects País/Región/Ciudad
│   └── JobMonitor.tsx            # barra de progreso + log (Realtime sobre region_jobs)
├── hooks/
│   └── useRegionJob.ts           # suscripción Realtime al job
└── services/
    └── geo-catalog.ts            # ISO-3166-2 estático + Nominatim search

etl/lib/pipeline.mjs              # NÚCLEO parametrizable: runZoneLoad({ cityId, slug, bbox, ... })
                                  # reusa importOsm / enrich / google-photos / mapillary
                                  # escribe progreso/log en region_jobs (capa de jobs)
etl/lib/jobs.mjs                  # helpers para crear/actualizar region_jobs
etl/run-zone.mjs                  # CLI: node etl/run-zone.mjs --job <id>  (lo invoca la ruta admin local)

src/app/admin/loader/page.tsx     # ruta admin; guard extra: solo localhost
src/app/api/loader/start/route.ts # POST: resuelve zona, crea region_jobs, lanza runner local (spawn)

.claude/skills/load-zone/         # skill + subagente que orquesta el mismo pipeline
data/iso-3166-2.json              # dataset estático país/región (NO ciudades)
```

### Modelo de Datos (nuevas tablas + cambios)
```sql
-- 1) Cobertura espacial por ciudad (añadir a cities)
alter table public.cities
  add column coverage_radius_m integer,        -- cobertura por radio desde center, o…
  add column bbox geography(polygon);          -- …polígono explícito (preferido para el loader)
-- resolve_coverage: dada una coord, devuelve la ciudad activa que la contiene (o null)
create or replace function public.resolve_coverage(p_lat double precision, p_lng double precision)
returns table (city_id bigint, slug text, name text, distance_m double precision) ...;

-- 2) Jobs del cargador (progreso/log en vivo)
create table public.region_jobs (
  id uuid primary key default gen_random_uuid(),
  city_id bigint references public.cities(id),
  country text, region text, city_name text,
  bbox jsonb,                                   -- [s,w,n,e] o GeoJSON del área
  status text not null default 'queued',        -- queued|running|done|error
  stage text,                                   -- osm|dedupe|insert|enrich_anchors|photos|enrich_tail
  progress numeric default 0,                   -- 0..1
  counts jsonb default '{}'::jsonb,             -- { osm, inserted, enriched, photos }
  log jsonb default '[]'::jsonb,                -- líneas de log para la vista en vivo
  error text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.region_jobs enable row level security;
-- RLS: solo admins leen/escriben (service_role del runner local bypassa RLS);
-- Realtime habilitado sobre region_jobs para la vista admin.

-- 3) Waitlist (demanda fuera de cobertura)
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  lat double precision, lng double precision,   -- coords detectadas
  detected_label text,                           -- reverse-geocode (ciudad/país aprox.)
  created_at timestamptz default now()
);
alter table public.waitlist enable row level security;
-- RLS: insert público (anon) validado por Zod en el server action; select solo admin.

-- 4) Niveles de enriquecimiento (alinear con docs/09)
alter table public.places
  add column enrich_tier text default 'tail';    -- anchor|full|tail ; tail = on-demand al 1er view
```

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Cobertura + Pantalla "Pronto" + Waitlist + Landing (app-side, ship rápido)  ✅ HECHA (2026-06-20)
> Migración 0028 (cobertura+waitlist+resolve_coverage) aplicada · `src/features/coverage/*` ·
> `src/actions/waitlist.ts` · gate en `use-feed`/`feed-client` · landing dinámica. typecheck verde.
> Validación visual pendiente del usuario (dev :3000) + build en Vercel al deployar.
**Objetivo**: detectar si el usuario está dentro de una zona activa; fuera de cobertura mostrar `<OutOfCoverageScreen>` con waitlist y feed bloqueado; landing lista ciudades activas dinámicamente. No depende del cargador (usa Puerto Varas como única zona activa existente).
**Validación**: con `NEXT_PUBLIC_FORCE_LOCATION=1` (Puerto Varas) → feed normal; forzando coords fuera (ej. Madrid) → pantalla "pronto" + form que inserta en `waitlist`; landing muestra "Puerto Varas" desde datos, no hardcode.

### Fase 2: Modelo de Datos + Pipeline Parametrizable  ✅ HECHA (2026-06-20)
> Migración 0029 (region_jobs+Realtime+enrich_tier, backfill 213 places→full). Núcleo nuevo en
> `etl/lib/`: `env.mjs` (loadEnv/client/pool), `osm.mjs` (fetchOverpass/buildPlaceRecords param. por
> ciudad), `jobs.mjs` (reporter→region_jobs), `pipeline.mjs` (ensureCity/importOsm/photosGoogle/
> enrichCity-tiered/photosMapillary/runZoneLoad), `run-zone.mjs` (CLI `--job`). `ai.mjs` SYSTEM
> parametrizado por ciudad/región/país (sin "Puerto Varas" hardcodeado). Sintaxis + imports OK.
> Pendiente: 1er run end-to-end real (se hará desde el admin con una ciudad chica). `osm-import.mjs`
> standalone se deja como legacy (el núcleo canónico es `osm.mjs`).
**Objetivo**: migraciones (`cities.coverage`/`bbox`, `resolve_coverage`, `region_jobs`, `waitlist`, `places.enrich_tier`); refactor de `etl/` a un núcleo `pipeline.mjs` parametrizable por zona que escribe progreso en `region_jobs`; enriquecimiento por niveles (~50 anclas completas, resto cola larga). RLS en todas las tablas nuevas.
**Validación**: correr `node etl/run-zone.mjs` contra una ciudad de prueba (dry-run) crea/actualiza un `region_jobs` con etapas y counts; `resolve_coverage` devuelve la ciudad correcta para una coord dentro y null fuera; backfill de cobertura para Puerto Varas.

### Fase 3: Vista Admin `/admin/loader` (Local-Only) con Progreso en Vivo  ✅ HECHA (2026-06-20)
> `src/features/loader/`: data/geo-catalog.ts (CL/AR/ES, extensible), components/ZonePicker (3 selects
> + búsqueda Nominatim), JobMonitor (Realtime), LoaderClient, hooks/useRegionJob. `src/actions/loader.ts`
> (`searchZoneCities` Nominatim + `startZoneLoad` crea job + `spawn node etl/run-zone.mjs`). `src/lib/
> local-only.ts` (guard server-side por host). `/admin/loader/page.tsx` con notFound() fuera de localhost.
> AdminNav muestra "Cargador" solo en localhost. region_jobs añadido a database.types.ts. typecheck verde.
> Pendiente: 1er run real (ciudad chica) para validar end-to-end. Nota: timezone de ciudad nueva = 'UTC'
> por defecto (Nominatim no la da) → afinar para "abierto ahora".
**Objetivo**: ruta y menú admin condicionados a `localhost`; `<ZonePicker>` (3 selects, ISO-3166-2 estático + Nominatim dinámico para ciudad→bbox); endpoint que crea el job y lanza el runner local; `<JobMonitor>` con barra de progreso + log vía Supabase Realtime.
**Validación**: en localhost el menú "Cargador" aparece y la ruta carga; en producción está oculta y bloqueada (404/redirect). Lanzar una ciudad pequeña ejecuta el pipeline end-to-end y la ciudad queda `is_active=true` con places en el feed.

### Fase 4: Skill `/load-zone` + Subagente  ✅ HECHA (2026-06-20)
> `etl/load-zone.mjs` (CLI: Nominatim → crea region_job → `runZoneLoad` inline, mismo núcleo que el
> admin). `.claude/skills/load-zone/SKILL.md` (triggers + confirmación de costo + pasos). Registrado en
> CLAUDE.md (árbol de decisión + tabla de skills #16). Sintaxis OK.
> Filtro por zona + columna "Zona" añadidos al listado admin `/admin/places` (bonus pedido por el usuario).
**Objetivo**: skill que orquesta el MISMO `pipeline.mjs` núcleo desde Claude (mismas funciones, mismo `region_jobs`), como alternativa/complemento a la vista admin.
**Validación**: invocar el skill con País/Región/Ciudad produce un `region_jobs` idéntico en forma al de la vista admin y carga la zona; documentado en CLAUDE.md.

### Fase N: Validación Final
**Objetivo**: sistema funcionando end-to-end (cobertura + cargador + skill).
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot: feed dentro de cobertura, pantalla "pronto" fuera, `/admin/loader` en localhost
- [ ] Cargar una ciudad nueva end-to-end deja places visibles en su feed
- [ ] Todos los criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

### 2026-06-20: PostGIS vive en schema `extensions`, no en `public`
- **Error**: `type "geography" does not exist` al crear `resolve_coverage` con `set search_path = public`.
- **Fix**: usar `set search_path = public, extensions` en toda función PostGIS `security definer` (mismo patrón que `0012_get_feed.sql`). Coords: `st_setsrid(st_makepoint(lng,lat),4326)::geography`, `st_dwithin(geography, geography, metros)`.
- **Aplicar en**: cualquier RPC nueva con tipos/funciones PostGIS (Fase 2: filtrado del feed por ciudad, bbox del cargador).

### 2026-06-20: Tipado de `supabase.rpc()` para funciones que retornan tabla
- **Error**: `Argument ... not assignable to 'undefined'` + `Row is never` al llamar `rpc('resolve_coverage', {...})`.
- **Fix**: patrón del proyecto (ver `use-feed.ts`): `rpc('fn', { ...args } as never)` y castear el retorno `((data ?? []) as RowType[])`. Regenerar `database.types.ts` con `generate_typescript_types` tras cada migración igual no resuelve el args-typing (limitación de supabase-js).
- **Aplicar en**: toda llamada a RPC nueva (Fase 2/3).

### 2026-06-20: Lint del proyecto roto (Next 16)
- **Error**: `npm run lint` (`next lint`) falla — Next 16 **removió `next lint`**; tampoco hay `eslint.config.*` (ESLint 9 usa flat config).
- **Fix (pendiente, fuera de Fase 1)**: añadir `eslint.config.mjs` con `eslint-config-next` flat + actualizar el script `lint`. Por ahora la validación de calidad es `tsc --noEmit`.
- **Aplicar en**: validación de cada fase (no depender de `npm run lint` hasta arreglarlo).

### 2026-06-20: Solape de bbox entre comunas vecinas → ciudad nueva nace casi vacía
- **Error**: al cargar Llanquihue (pegada a Puerto Varas) sólo entraron **2 lugares** de ~50 reales. Nominatim devuelve el bbox de la **comuna entera** (~28×53 km) que **solapa** con la ciudad ya cargada; como el `slug` de un POI es global (`nombre-osmId`) y el import usa `ignoreDuplicates`, los POIs ya importados por la primera ciudad se saltan → **"el primero que importa, gana"** y la nueva queda vacía. (Diagnóstico: 48 de 213 places "de Puerto Varas" estaban físicamente más cerca de Frutillar/Llanquihue.)
- **Fix**:
  1. **Backfill 1-vez** (SQL): reasignar `city_id` de cada place a la **ciudad activa más cercana por centro** (Voronoi: `order by location <-> center limit 1`). Resultado: PV 213→165, Frutillar 9→44, Llanquihue 2→15.
  2. **Re-enriquecer** los reasignados: su texto IA mencionaba la ciudad vieja. `etl/reenrich.mjs` (nula `ai_enriched_at`, vuelve a correr `enrichCity` con el contexto correcto). 48 lugares, **$0.092**.
  3. **Pipeline self-correcting**: migración `0030_assign_nearest_city` (RPC PostGIS) + paso en `runZoneLoad` tras el import. **Sólo jala** (nunca expulsa → sin huérfanos sin enriquecer) los vecinos dentro del bbox cuyo centro más cercano es la ciudad nueva, y nula su `ai_enriched_at` para que el paso de enriquecimiento los reescriba. Así el bug **se autocorrige en cada carga futura**.
- **Aplicar en**: cualquier carga de zona adyacente a una ya cargada. El orden de carga deja de importar.

### 2026-06-20: Timezone de la ciudad desde coordenadas (no "UTC" fijo)
- **Error**: las ciudades nuevas nacían con `timezone='UTC'` (Nominatim no la entrega) → el "abierto ahora" calculaba mal. `timezones[0]` de `countries-and-timezones` tampoco sirve (no es la principal: CL→Coyhaique, US→Adak).
- **Fix**: `tz-lookup` (lat/lng → IANA) en `loader.ts` y `etl/load-zone.mjs`. Preciso por ciudad en cualquier país. Backfill de las CL existentes a `America/Santiago`.
- **Aplicar en**: toda alta de ciudad. `tz-lookup` es dependencia de runtime (lo usa el server action).

### 2026-06-20: Catálogo país/región completo generado, no a mano
- **Decisión**: `scripts/gen-geo-catalog.cjs` genera `geo-catalog.ts` (249 países, 4387 regiones) desde `country-region-data` (ISO 3166, **devDependency**, solo para generar). Nombres de país en español vía `Intl.DisplayNames`. Emite también `etl/data/countries.json` para el CLI. Nominatim se filtra por `countrycodes` (ISO2) — más robusto que el nombre.
- **Aplicar en**: para más países/regiones, re-correr el generador (no editar el `.ts` a mano).

---

## Gotchas

- [ ] **Local-only real**: detectar localhost server-side (host header / `request.headers`), no solo client-side, y bloquear el endpoint `start` y la ruta en producción. El menú oculto NO es seguridad suficiente.
- [ ] **Runner local fuera de Vercel**: el ETL largo NO corre en el request de Next. El endpoint solo crea el `region_jobs` y hace `spawn` de `node etl/run-zone.mjs --job <id>` en la máquina del dev (o el dev lo corre a mano). Documentar el flujo.
- [ ] **Service-role en el runner**: `pipeline.mjs` usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS); nunca exponer esa llave al cliente ni al bundle de Next.
- [ ] **`cities.id` es `bigint generated always as identity`**: el loader debe `insert ... returning id` la ciudad ANTES de correr el import (que necesita `city_id`). No hardcodear como `osm-import.mjs` actual.
- [ ] **`get_feed` no filtra por ciudad activa**: hoy filtra solo por radio. Al activar multi-ciudad, lugares de ciudades inactivas a <25km podrían aparecer. Decidir: filtrar por `city_id` de la zona resuelta, o por `cities.is_active`.
- [ ] **Embeddings `vector(1024)`**: mantener `EMBED_DIMS=1024` por ciudad nueva (debe coincidir con el esquema). No cambiar de modelo a mitad de catálogo.
- [ ] **Idempotencia**: import/enrich/fotos ya son idempotentes (upsert por slug, `ai_enriched_at IS NULL`, skip de fotos existentes). El `pipeline.mjs` debe preservarlo para reintentos de jobs.
- [ ] **Nominatim/Overpass rate limits + User-Agent**: respetar el `User-Agent` ya usado en los scripts y throttling; Nominatim exige 1 req/s y UA identificable.
- [ ] **Supabase Realtime**: habilitar la publicación en `region_jobs` (replica identity / publication) para que `<JobMonitor>` reciba updates.
- [ ] **`NEXT_PUBLIC_FORCE_LOCATION`**: el gate de cobertura debe respetar el override de dev (forzar Puerto Varas) para no bloquearse el propio dev.
- [ ] **Costo IA**: el enriquecimiento por niveles (~50 anclas vs. cola larga on-demand) es clave para no repetir un gasto grande por ciudad; medir vía `ai_usage` como hoy (~$0.41 / 213 places en Puerto Varas).
- [ ] **Capacitor (Android)**: la app carga la URL remota; el gate de cobertura corre client-side, ok. La ruta `/admin/loader` local-only nunca debe aparecer en el build de producción que consume Capacitor.

## Anti-Patrones

- NO duplicar la lógica del pipeline entre la vista admin y el skill: ambos llaman al MISMO `etl/lib/pipeline.mjs`.
- NO shippear un dataset gigante de ciudades del mundo: País/Región estáticos (ISO-3166-2), Ciudad resuelta dinámicamente (Nominatim).
- NO correr el ETL dentro de un route handler de Vercel (límites de tiempo/CPU): runner local.
- NO hardcodear `CITY_ID`/`BBOX`/`'Puerto Varas'` en código nuevo (es la deuda que esta feature paga).
- NO usar `any` (usar `unknown`); validar inputs (email waitlist, selección de zona) con Zod.
- NO omitir RLS en `region_jobs` / `waitlist`.

---

*PRP pendiente aprobación. No se ha modificado código.*
