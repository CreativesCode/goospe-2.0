# 12 — Auditoría de Rendimiento y UX

> Fecha: **2026-06-18** · Ciudad piloto: Puerto Varas
> Auditoría a fondo (datos/backend + frontend/build + UX/accesibilidad). Cada ítem es
> accionable e independiente: marca el checkbox al cerrarlo. Orden sugerido al final (§7).
> Severidad: 🔴 Alta (impacto real ya o bug) · 🟡 Media · 🟢 Baja (pulido).

---

## 0. Quick wins (máximo impacto / mínimo esfuerzo)

Si solo hay tiempo para 6 cosas, estas:

- [x] **Índice `place_photos(place_id, status, source, id)`** — acelera TODO el feed/búsqueda (§1.1). ✅ 2026-06-18 (migración 0022, aplicada y verificada).
- [x] **Cachear el proxy de fotos** para no re-pegarle (y re-pagar) a Google en cada miss (§1.2). ✅ 2026-06-18.
- [x] **`next.config.ts`: imágenes + `optimizePackageImports`** — base para optimizar fotos y bundle (§2.1). ✅ 2026-06-18.
- [x] **Geolocalización: avisar cuando cae a Puerto Varas** — hoy engaña con distancias falsas (§3.1). ✅ 2026-06-18.
- [x] **`try/catch` en `/buscar`** — hoy la UI queda colgada en el spinner si falla la red (§3.2). ✅ 2026-06-18.

> **Sprint 1 completo (2026-06-18):** 1.1 · 1.2 · 1.3 · 2.1 · 3.1 · 3.2 ✅
- [x] **ISR en fichas de lugar** (`force-dynamic` → `revalidate`) — caching + menos carga Supabase (§1.3). ✅ 2026-06-18.

---

## 1. Rendimiento — Datos y Backend

### 🔴 Alta

- [x] **1.1 Índice faltante en `place_photos(place_id, status)`** — el más caro del sistema. ✅ **Hecho 2026-06-18** — `supabase/migrations/0022_place_photos_index.sql`, índice `idx_place_photos_place_status (place_id, status, source, id)` aplicado vía Management API y verificado en `pg_indexes`.
  - `supabase/migrations/0002_schema.sql:80-86` (tabla); usado por cada RPC: `0012_get_feed.sql:39-42`, `0014_feed_boosts.sql:47-50`, `0016_feed_taste.sql:49-52`, `0013_match_places.sql:29-31`, `0015_search_places.sql:30-32`, `0020_get_feed_events.sql:34-36`.
  - **Problema**: cada candidato del feed hace un subquery correlacionado a `place_photos`; sin índice = N seq scans por request.
  - **Fix**: `create index on place_photos (place_id, status, source, id);` (cubre el `order by source desc, id`).

- [x] **1.2 Proxy `place-photo` re-descarga de Google en cada miss (`cache: 'no-store'`)** ✅ **Hecho 2026-06-18**
  - `src/app/api/place-photo/route.ts`.
  - **Problema**: solo mandaba `max-age` (caché privada del navegador), sin `s-maxage` → el CDN compartido no cacheaba; cada miss de cada usuario volvía a pegarle (y pagarle) a Google.
  - **Hecho**: respuesta exitosa con `s-maxage=2592000, stale-while-revalidate=86400` (CDN compartido cachea 30d) + `max-age` 7d navegador; el fallback (foto rota) ahora va con `Cache-Control: no-store` para no cachear errores. Resiliencia (retry/backoff/degradación a isotipo) intacta.
  - **Siguiente nivel (opcional)**: persistir en Supabase Storage tras el primer fetch para latencia/costo aún menores.

- [x] **1.3 Fichas/listados SEO son `force-dynamic` (sin ISR)** ✅ **Hecho 2026-06-18**
  - **Hecho**: ficha `src/app/places/[slug]/page.tsx` → `revalidate = 3600` + `generateStaticParams` (pre-renderiza slugs publicados, defensivo si la BD no está en build); landing `src/app/page.tsx` → `revalidate = 3600`; `src/app/eventos/page.tsx` → `revalidate = 600` (sensible a fecha). Todas usan `createAdminClient` (sin cookies) → ISR seguro; las partes con sesión son client components.
  - **Pendiente a propósito**: `src/app/places/page.tsx` se deja `force-dynamic` — es la vista de validación con `?photos=` (searchParams) que se elimina/consolida en §2.11.

- [x] **1.4 Admin carga tablas completas y agrega en JS** — 2026-06-18
  - **Hecho (dashboard + stats)**: migración `0023_admin_aggregates.sql` con RPCs `SECURITY DEFINER` que agregan en SQL: `admin_interaction_counts` (por tipo + 30d/7d), `admin_interaction_daily(p_days)`, `admin_top_places(p_limit, p_value_only)`, `admin_ai_usage_summary` (total/30d/7d), `admin_places_with_photo`. `admin/page.tsx` y `admin/stats/page.tsx` ya no descargan `interactions`/`ai_usage`/`place_photos` completos — usan las RPCs + un `count head`. Verificada con datos reales (51 view_card, 64 view_detail, $0.41 IA, 213 con foto).
  - **Hecho (usuarios + gastos IA)**: migración `0024_admin_user_ai_aggregates.sql` con `admin_user_activity` (contadores fav/reseñas/rsvp/negocios por usuario en SQL), `admin_ai_usage_totals(p_days)`, `admin_ai_usage_breakdown(p_days)` (feature/modelo/usuario en una llamada, con join a `profiles`), `admin_ai_usage_daily(p_days)`. `admin/users/page.tsx` ya no descarga `favorites`/`reviews`/`event_rsvps`/`business_members` enteras; `admin/ai-costs/page.tsx` ya no descarga `ai_usage` entera — totales/desgloses/serie en SQL y **el detalle se pagina en la BD** (`.range()` + `count exact` + filtro de fecha `.gte`, solo 60 filas por página). Aplicada (201) y verificada (1 usuario activo, $0.41 / 436 llamadas).

### 🟡 Media

- [x] **1.5 `/places/[slug]` hace 3 queries secuenciales + 1 duplicada en metadata** ✅ **Hecho 2026-06-18**
  - **Hecho**: `getPlace(slug)` envuelto en `cache()` de React → `generateMetadata` y el render comparten **una** sola query del place (antes dos). Luego `events` y `places_lnglat` van en `Promise.all` (antes secuencial). De 4 round-trips secuenciales a 1 + 2 en paralelo.

- [x] **1.6 `search_places` usa `ilike '%q%'` (leading wildcard no usa el índice trigram)** ✅ **Hecho 2026-06-18**
  - **Hallazgo**: el índice GIN trigram `places_name_idx (name gin_trgm_ops)` **ya existía** → `ilike '%q%'` ya estaba respaldado por índice (la GIN trigram sí sirve leading wildcards, a diferencia del B-tree). El concern de perf ya estaba cubierto a nivel de esquema.
  - **Hecho (mejora real)**: migración `0025_search_places_trgm.sql` — `search_places` ahora suma tolerancia a typos con el operador `<%` (word_similarity, **mismo índice GIN**) además del `ilike` de substring, y ordena por relevancia textual (`word_similarity` desc) antes que por distancia cuando hay query (browse sin query → orden por distancia intacto). Verificado: `aromacaffe` → `Aromacafe`. Umbral por defecto 0.6 (Supabase no permite el `SET` de la GUC `pg_trgm.*` por función; cubre typos de una palabra).

- [x] **1.7 `track`/`interactions`: un insert + `getUser()` por evento (sin batching)** ✅ **Hecho 2026-06-18**
  - **Hecho (cliente)**: `src/lib/track.ts` ahora encola los eventos y los envía **en lote** (`{ events: [...] }`) cada 2.5 s o al llegar a 20, con flush en `visibilitychange`/`pagehide` (sendBeacon) para no perder eventos al navegar a Maps/`tel:`/share. `view_card` ya no dispara un POST por card.
  - **Hecho (server)**: `src/app/api/track/route.ts` acepta lote o evento suelto (retrocompat), valida y hace **un solo insert múltiple** (cap 50). Además **salta `getUser()` por completo cuando no hay cookie de Supabase** (`sb-*-auth-token`) → el feed anónimo (caso común) se ahorra el round-trip de auth; la sesión se resuelve una vez por lote.

- [x] **1.8 Sin caché de embeddings del conserje** ✅ **Hecho 2026-06-18**
  - **Hecho**: `embedQuery` envuelve `embedRaw` con `unstable_cache` (Data Cache de Next, persistente y compartido), con `revalidate: false` (los embeddings son deterministas) y clave por texto normalizado (`trim` + colapsar espacios). Consultas repetidas y los ejemplos fijos del conserje ya no re-llaman a OpenAI.

- [~] **1.9 `match_places`: ANN + filtro geográfico no aprovecha bien el HNSW** — analizado 2026-06-18, **diferido por datos (sin acción ahora)**
  - **EXPLAIN ANALYZE (213 lugares, todos con embedding)**: el plan usa el índice GiST geo (`places_location_idx`) para el radio y luego un **Sort exacto top-N por `embedding <=>`** — el HNSW (`places_embedding_idx`) **no se usa**. Causa: en el piloto (Puerto Varas) los 213 lugares caen dentro de los 25 km → el filtro de radio no descarta nada y, con tan pocas filas, el sort exacto es la opción correcta del planner (≈190 ms en frío, dominado por el cálculo coseno de 1024-dim, no por el plan). No es un problema de índice sino de escala.
  - **Decisión**: no se toca. Forzar el HNSW ahora (quitar el pre-filtro o bajar recall) arriesgaría la calidad del conserje sin beneficio real a esta escala. El plan actual (geo-index → sort exacto) es casi óptimo para la forma de datos de una sola ciudad.
  - **Cuándo revisitar**: al pasar a multi-ciudad (el radio sí filtrará → por-ciudad pocas filas, igual ok) o si `places` con embedding crece a miles. Entonces: `EXPLAIN` de nuevo y, si aparece seq scan + sort caro, activar **iterative scan** (pgvector **0.8.0** ya instalado: `set hnsw.iterative_scan = 'relaxed_order'`) o subir `hnsw.ef_search`.

- [x] **1.12 `ai_usage`/cuota insert "fire-and-forget" con `void`** ✅ **Hecho 2026-06-18**
  - **Hecho**: nuevo helper `src/lib/fire.ts` `fireAndForget(promise, label)` que dispara la escritura sin bloquear pero **registra el fallo en logs** (chequea `res.error` y captura rechazos) en vez de tragarlo con `void`. Aplicado en los 4 sitios de `ai_usage` (`concierge/route.ts`, `actions/ai-assist.ts`, `actions/reports.ts`, `actions/menu.ts`) y en el `increment_concierge_quota` del conserje. Bonus: los builders de PostgREST son thenables perezosos → llamar `.then` garantiza además que la escritura se envíe.

### 🟢 Baja

- [x] **1.10 `admin/places` trae 500 filas con joins y pagina en memoria** ✅ **Hecho 2026-06-18**
  - **Hecho**: `admin/places/page.tsx` ahora pagina en la BD (`.range(from, from+49)` + `count: 'exact'`) en vez de traer 500 filas y cortar en memoria. El filtro de categoría se empuja a la BD con `place_categories!inner(categories!inner(...))` + `.eq('place_categories.categories.slug', cat)` (antes se descargaba todo para filtrar en JS). Header y empty-state usan el `count` real. Orden estable `name, id`.
- [x] **1.11 RPCs duplican subquery de categoría (emoji + name por separado)** ✅ **Hecho 2026-06-18**
  - **Hecho**: migración `0026_category_lateral_join.sql` — `get_feed` (0016) y `search_places` (0025) pasan de **dos** subconsultas correlacionadas por fila (una para `emoji`, otra para `name`) a **un** `LEFT JOIN LATERAL` que trae ambos en un solo lookup, y garantiza que emoji+nombre salgan de la misma fila de categoría. `match_places` (0013) solo trae `name` → sin duplicación, no se toca. Verificado: ambos RPCs devuelven emoji+name correctos.
  - _(1.12 movido a su entrada de 🟡 más arriba — ✅ hecho.)_

---

## 2. Rendimiento — Frontend y Build

### 🔴 Alta

- [x] **2.1 `next.config.ts` casi vacío — sin config de imágenes ni optimizaciones** ✅ **Hecho 2026-06-18**
  - **Hecho**: `next.config.ts` ahora con `images.formats: ['image/avif','image/webp']`, `images.remotePatterns` para el host de Supabase Storage (`/storage/v1/object/public/**`), y `experimental.optimizePackageImports: ['lucide-react']`.
  - **Nota para §2.2**: al migrar a `next/image` se añadirán los hosts de Mapillary/Foursquare según las URLs reales; Google va por el proxy same-origin (no requiere patrón).

- [x] **2.2 Cero uso de `next/image`** ✅ **Hecho 2026-06-18 (versión segura para ToS)**
  - ⚠️ **Decisión clave**: **NO se migró a `next/image` para las fotos de Google** (el grueso del feed). `next/image` descarga y **cachea** la imagen optimizada en servidor/CDN, lo que viola el ToS "display-only, no almacenar" que respeta el proxy `/api/place-photo` (las fotos de Google se sirven como ruta del proxy, que ya las entrega dimensionadas con `maxWidthPx`).
  - **Hecho (captura el grueso del beneficio LCP sin tocar el ToS)**: a las `<img>` de contenido del feed se añadió `loading="lazy"` + `decoding="async"` + `onError` (fallback al gradiente/isotipo), y la **primera card / hero carga con `loading="eager"` + `fetchPriority="high"`** (es el LCP). Archivos: `FeedCardMobile` (primera con prioridad), `Thumb` de desktop/tablet (hero con prioridad), `PlaceCard` compartido (buscar/concierge/grid), `EventFeedCard`, miniatura de evento en la ficha.
  - **Beneficio**: el navegador deja de descargar todas las fotos del feed de golpe (solo las visibles) y la primera aparece antes → LCP y peso de transferencia mucho menores.
  - **Follow-up opcional (ToS-safe)**: las imágenes de **Supabase Storage** (fotos de usuario/negocio, cartas) y **Mapillary** (licencia abierta) sí podrían usar `next/image` real (AVIF/WebP+srcset) — `next.config` ya tiene el host de Storage en `remotePatterns`. Pendiente en: `PhotoGallery`, `panel`, `perfil`, `admin/photos`.

- [x] **2.3 Feed inicial es 100% client — spinner garantizado en el primer paint** ✅ **Hecho 2026-06-18 (SSR-seed + refine, verificado en navegador)**
  - **Hecho**: `feed/page.tsx` pasó a **server component**: hace `get_feed`/`get_feed_events` con la ubicación del piloto (Puerto Varas) y pasa la primera tanda como `initial` a un nuevo `feed-client.tsx`. El seed es anónimo e igual para todos → **ISR `revalidate = 300`** (TTFB instantáneo, sin RPC por request). `useFeed(initial)` arranca con `loading=false` y refina la ubicación real **en segundo plano** (`loadPosition({ background:true })`, sin loader; filtra descartados). Resultado: el feed pinta el contenido en cuanto resuelve el breakpoint (un tick) en vez de esperar geolocalización (¡con prompt!) + 2 RPC.
  - **Alcance/decisión**: NO se hizo el render-de-3-layouts-por-CSS (duplicaría observers/tracking y arriesga hidratación) → el HTML del primer tick sigue siendo el **loader de marca** (coherente con la UX pedida) y el contenido aparece al resolver `useBreakpoint`. El grueso del problema (la espera por geo + RPC) queda eliminado.
  - **Verificado** (`localhost:3000`, Playwright): `/feed` renderiza destacado + grid (Papa John's, Quintal, …) con "Puerto Varas"; **0 errores** de consola; navegación `/feed↔/buscar` limpia.

### 🟡 Media

- [x] **2.4 Fuentes Roboto: 3 `.ttf` completos sin subsetting (~482 KB)** ✅ **Hecho 2026-06-18**
  - **Hecho**: `src/app/layout.tsx` pasó de `next/font/local` (3 `.ttf` completos) a `next/font/google` `Roboto` con `subsets: ['latin']` y `weight: ['300','400','500']`. Sigue auto-alojado en runtime (sin request a Google → GDPR-safe), pero ahora se sirve `.woff2` subset latino (mucho más liviano). La variable CSS `--font-roboto` no cambió → Tailwind (`font-sans`) intacto.
  - **Caveat**: `next/font/google` descarga la fuente en **build/compile** (conectividad a `fonts.googleapis.com` verificada: 200). Si un build offline fallara, revertir es un solo edit a `localFont`.
  - **Cleanup opcional**: `src/app/fonts/Roboto-*.ttf` quedaron sin usar (no se bundlean; solo ocupan repo) → se pueden borrar.

- [x] **2.5 `useFavorites.toggle` depende del set `ids` → re-render de todo el feed al guardar** ✅ **Hecho 2026-06-18**
  - **Hecho**: `useFavorites` ahora mantiene `idsRef` (espejo de `ids`); `toggle` es estable (`useCallback([])`), lee de la ref, persiste en DB en segundo plano y **devuelve si quedó guardado**. `use-feed.onSave` usa ese retorno → deja de depender de `isSaved` y queda estable también.

- [x] **2.6 Cards del feed no memoizadas** ✅ **Hecho 2026-06-18 (móvil + desktop)**
  - **Hecho**: móvil → card extraída a `FeedCardMobile = memo(...)` (recibe `saved` boolean + callbacks estables; conserva `<section data-track-id>` para el IntersectionObserver). Desktop → `PlaceCard` envuelto en `memo` y recibe el `onSave` estable del feed (antes se le pasaba `() => onSave(p)` inline, que anulaba el memo). Ahora solo se re-renderiza la card afectada al guardar/descartar, no la lista entera ni sus iconos Lucide.
  - **Pendiente menor**: `feed-tablet` (maestro/detalle, ~7 ítems) — beneficio marginal, se deja sin memoizar.

- [x] **2.7 `AppNav` (client) monta `useAuth` + `Notifications` Realtime en cada página** ✅ **Hecho 2026-06-18 (verificado en navegador)**
  - **Hecho (sesión compartida)**: `useAuth` pasó a un **store-singleton** (`useSyncExternalStore`). Antes cada consumidor (AppNav **y** AccountMenu) montaba su propio `getUser()` + fetch `profiles` + `onAuthStateChange` → **2× por página y de nuevo en cada navegación**. Ahora la sesión se resuelve **una sola vez por carga de app**, con **una** suscripción de auth, compartida/cacheada entre consumidores y navegaciones (sin parpadeo ni refetch). API del hook intacta.
  - **Hecho (Realtime una vez)**: `Notifications` también pasó a **store-singleton** con `ensure(userId)` idempotente — el fetch inicial + el **canal Realtime se montan una sola vez** y sobreviven a las navegaciones (antes se re-suscribía un canal nuevo en cada página); reacciona a login/logout vía el `useAuth` singleton. El aviso en vivo de una nueva notificación ahora va por el `toast` global. **Sin reestructurar el layout** (se evitó mover AppNav y tocar el DOM de ~8 páginas). La opción de "resolver la sesión 100% en servidor y pasarla como prop" queda innecesaria: el coste repetido ya desapareció.
  - **Verificado** (`localhost:3000`, Playwright): "Entrar"/sesión y campana montan sin error; navegación `/feed↔/buscar↔/feed` con **0 errores** (sin el viejo "add callbacks after subscribe()").

### 🟢 Baja

- [x] **2.8 `tsconfig target: ES2017`** ✅ **Hecho 2026-06-18** — subido a `ES2022` (`tsconfig.json`). SWC hace el downleveling real; menos transpilación de async/await/spread.
- [x] **2.9 `IntersectionObserver` del feed se reconstruye con cada cambio de `feedList`** ✅ **Hecho 2026-06-18** — el observer ahora se crea **una sola vez** (refs para `timers`/observer); un efecto aparte solo observa los nodos nuevos al cambiar la lista (`observe()` es idempotente). Antes se hacía `disconnect()` + recrear en cada cambio.
- [x] **2.10 Verificar `lucide-react@^1.20.0`** ✅ **Hecho 2026-06-18** — confirmado: `node_modules/lucide-react@1.20.0` es la librería esperada (homepage lucide.dev) y ya está en `optimizePackageImports` (desde 2.1). Sin acción extra.
- [x] **2.11 Ruta de debug `/places?photos=` rompe estaticidad** ✅ **Hecho 2026-06-18** — eliminado el toggle de comparación Mapillary y el uso de `searchParams`; `places/page.tsx` pasó de `force-dynamic` a `revalidate = 3600` (ISR). Siempre muestra la foto aprobada. (Además lanza en error → lo captura `error.tsx`, ver 3.10.)

---

## 3. UX y Accesibilidad

### 🔴 Alta

- [x] **3.1 Geolocalización denegada cae a Puerto Varas en silencio** ✅ **Hecho 2026-06-18**
  - **Hecho**: `getPosition()` ahora devuelve `source: 'forced' | 'gps' | 'fallback'` (`src/lib/geo.ts`). Nuevo componente `src/shared/components/location-notice.tsx` (aviso + reintento). Integrado en: `buscar` y `concierge` (banner claro), `feed-desktop` (banner tras encabezado), y `feed-mobile`/`feed-tablet` (el chip de ubicación se vuelve botón ámbar de reintento cuando es fallback). El reintento re-pide el permiso y recarga. El override de dev (`forced`) no muestra aviso.

- [x] **3.2 `/buscar` sin `try/catch` → UI colgada en error de red** ✅ **Hecho 2026-06-18**
  - **Hecho**: `src/app/buscar/page.tsx` envuelve el fetch en `try/catch/finally` (chequea `res.ok`), `setLoading(false)` garantizado, y nuevo estado de error con bloque "Reintentar". El estado de error suprime el "Sin resultados" para no confundir.

- [x] **3.3 Errores con `alert()` nativo o texto crudo en inglés** ✅ **Hecho 2026-06-18 (ver §4)** — todos los `alert()` migrados a `toast.error`. **Pendiente menor**: mapear errores crudos de Supabase/inglés a microcopy (p. ej. concierge `(e as Error).message`).

- [x] **3.4 Conserje IA: input sin label y resultados sin `aria-live`** ✅ **Hecho 2026-06-18** — input con `aria-label`, `type="search"`, `enterKeyHint`; botón con `aria-busy`/`aria-label`; loader+error+resultados envueltos en `aria-live="polite" aria-busy={loading}`.

- [x] **3.5 Inputs de búsqueda y auth sin `autoComplete`/`type`/`inputMode`** ✅ **Hecho 2026-06-18**
  - Búsqueda: `type="search" aria-label="Buscar lugar" enterKeyHint="search" autoComplete="off"`.
  - `PasswordField` recibe prop `autoComplete` → login usa `current-password`, signup/cambio `new-password`.
  - Emails (login/signup/forgot): `autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}`; nombre (signup): `autoComplete="name"`.

- [x] **3.6 Lightbox de galería sin focus trap** ✅ **Hecho 2026-06-18** — al abrir mueve el foco al botón Cerrar; `Tab`/`Shift+Tab` quedan atrapados dentro del overlay; al cerrar restaura el foco al thumbnail; `aria-label="Foto a pantalla completa"` en el dialog (Escape ya cerraba).

- [x] **3.7 Feedback de error y éxito de reseña comparten el verde** ✅ **Hecho 2026-06-18 (ver §4)** — `PlaceReviews` usa `toast.error` (rojo) para validación/errores y `toast.success` (verde) para éxito.

### 🟡 Media

- [x] **3.8 Falta `export const viewport` con `viewport-fit=cover` (root cause safe-areas iOS)** ✅ **Hecho 2026-06-18**
  - **Hecho**: `src/app/layout.tsx` exporta `viewport = { viewportFit: 'cover', themeColor: [light/dark] }`. Safe-area insets aplicados en el feed móvil: fila superior (`top-[calc(1rem+env(safe-area-inset-top))]`), fila de ubicación (`3.5rem+inset-top`) y FAB Decídeme (`bottom-[calc(1.5rem+env(safe-area-inset-bottom))]`). La tab bar de `AppNav` ya tenía `pb-[max(env(safe-area-inset-bottom),6px)]`.

- [x] **3.9 "Paso" (descartar) es irreversible sin undo** ✅ **Hecho 2026-06-18** — `onDismiss` captura el lugar + su índice y muestra un toast **"Descartado · Deshacer"** (6s) que lo restaura en su posición original y lo saca de `dismissed`. Se extendió `toast` para aceptar una acción opcional `{ label, onClick }`.

- [x] **3.10 Páginas de error crudas sin layout ni reintento; no hay ningún `error.tsx`** ✅ **Hecho 2026-06-18**
  - **Hecho**: `src/app/error.tsx` (boundary de app, mensaje amigable + Reintentar + Ir al inicio) y `src/app/global-error.tsx` (último recurso). `feed/page.tsx` con UI amigable + Reintentar. **Ahora `places/page.tsx` y `saved/page.tsx` lanzan** (`throw new Error(error.message)`) en vez de renderizar `Error: {message}` crudo → los captura `error.tsx`. Se quitó el "· 0" de `saved` (ya no renderiza el encabezado en error).

- [x] **3.11 Menús (cuenta, notificaciones) sin semántica ni teclado** ✅ **Hecho 2026-06-18** — `AccountMenu` y `Notifications`: trigger con `aria-haspopup="menu"` + `aria-expanded={open}`; cierran con **Escape** (además del clic fuera). **`AccountMenu` ahora mueve el foco al primer item al abrir** (`role="menu"` en el dropdown) — cerrado 2026-06-18.

- [x] **3.12 Errores de validación sin asociación ARIA** ✅ **Hecho 2026-06-18** — `role="alert"` en los `<p>` de error de Login/Signup/Forgot/UpdatePassword **y ahora también en `onboarding`** (error con `id="onb-error"` + el botón "Empezar" con `aria-describedby`). Los formularios de auth ya anuncian el error vía `role="alert"` (announce inmediato); el `aria-describedby` por-input queda como pulido opcional menor.

- [x] **3.13 Imágenes sin `onError` → fotos rotas dejan ícono roto** ✅ **Hecho 2026-06-18**
  - **Hecho (junto con 2.2)**: `onError` con fallback al gradiente/isotipo en las cards del feed (`FeedCardMobile`, `Thumb` desktop/tablet, `PlaceCard` compartido, `EventFeedCard`).
  - **Hecho ahora**: `PhotoGallery` (thumbnails **y** lightbox) cae al gradiente+isotipo por foto fallida (`failed: Set`). Nuevo wrapper cliente `src/shared/components/photo-img.tsx` (`PhotoImg`) para los thumbs de server components → aplicado en `eventos/page.tsx` y en la lista de eventos de la ficha (`places/[slug]`). Las fotos de Google ya degradan vía el proxy.

- [x] **3.14 Inputs de teléfono/web/whatsapp del panel B2B sin `type`/`inputMode`** ✅ **Hecho 2026-06-18** — `ListingForm`: teléfono y WhatsApp `type="tel" inputMode="tel"` (+ `autoComplete="tel"` en teléfono); sitio web `type="url" inputMode="url" autoComplete="url"` + placeholder `https://…`. (Instagram queda como texto: es un handle.)

- [x] **3.15 Acciones del panel B2B sin confirmación/feedback** ✅ **Hecho 2026-06-18** (ver §4). `EventManager` (borrar evento: confirm + toast; boost: toast), `PlaceReviews` (borrar reseña: confirm + toast) y **ahora `MenuUpload` (quitar carta): `window.confirm` + `toast.success/error`** (antes borraba sin confirmar ni avisar).

- [x] **3.16 RSVP sin feedback de carga ni disabled mientras carga sesión** ✅ **Hecho 2026-06-18** — `RsvpButton` muestra "Guardando…" en `busy`, queda `disabled` cuando `authed === null`, y añade `aria-pressed={going}`.

- [x] **3.17 Estado vacío de búsqueda confunde inicial con sin-resultados** ✅ **Hecho 2026-06-18** — `buscar` distingue 3 estados: sin buscar aún ("Empieza a buscar lugares cerca de ti"), con filtros y 0 resultados ("Sin resultados con estos filtros" + botón **Limpiar filtros**), y sin filtros y 0 ("Aún no hay lugares publicados cerca de ti"). Flag `searched` + `hasFilters`.

- [x] **3.18 Botón Guardar de `PlaceCard` (desktop) solo visible en hover** ✅ **Hecho 2026-06-18** — `group-focus-within:opacity-100` (teclado) **+ `[@media(hover:none)]:opacity-100`** → siempre visible en dispositivos táctiles (sin hover), oculto-hasta-hover solo con mouse.

- [x] **3.19 `next` de login devuelve al listado, no a la ficha** ✅ **Hecho 2026-06-18** — `PlaceReviews` y `PhotoUpload` usan `usePathname()` → `next=${ruta actual}` (vuelve a la ficha, no a `/places`).

- [x] **3.20 Streaming del conserje sin reservar altura (layout shift)** ✅ **Hecho 2026-06-18** — el botón ya tenía `aria-busy`; ahora, en cuanto se abre el stream, el grid se rellena con **skeletons** (`PickSkeleton`, misma forma que `PlaceCard`) hasta 3 slots → los picks reemplazan los skeletons en su sitio sin que el layout salte card por card. El loader de marca queda solo para el "pensando" previo a conectar.

- [x] **3.21 `navigator.clipboard` sin verificar resultado (falsos "Copiado")** ✅ **Hecho 2026-06-18 (ver §4)** — `ReviewReplies` y `PlaceActions` ahora hacen `await` y, en fallo, `toast.error` (antes el catch vacío dejaba "Compartir" sin feedback).

### 🟢 Baja

- [x] **3.22 Targets táctiles < 44px** ✅ **Hecho 2026-06-18** — controles del header estandarizados a `h-11 w-11` (44px, iOS HIG): `ThemeToggle` (era 40), campana de `Notifications` y avatar de `AccountMenu` (eran 36); cerrar del lightbox (era 40). **Pendiente menor**: chips de ejemplo del conserje (secundarios; subir a 44 los hace muy altos).
- [x] **3.23 `aria-pressed` faltante en toggles** ✅ **Hecho 2026-06-18** — categorías y "Abierto ahora" (`buscar`), botón Guardar en feed móvil/tablet/desktop y `PlaceActions` (+ `aria-label` que refleja el estado); "Paso" del feed móvil ahora tiene `aria-label="Descartar este lugar"`.
- [x] **3.24 Estrellas de rating invisibles para lectores de pantalla** ✅ **Hecho 2026-06-18** — `Stars` de `PlaceReviews` y `ReviewReplies` con `role="img" aria-label="X de 5 estrellas"`; los botones de calificación del formulario con `aria-pressed`.
- [x] **3.25 Posición de scroll del feed se pierde al volver de una ficha** ✅ **Hecho 2026-06-18** — `feed-mobile` persiste `scrollTop` en `sessionStorage` (throttle con `requestAnimationFrame`) y lo restaura una vez que hay contenido renderizado. Volver de una ficha aterriza en el mismo card.
- [x] **3.26 Flash de estado mientras carga sesión** ✅ **Hecho 2026-06-18** — `AccountMenu` (skeleton del avatar), `PhotoUpload` (no renderiza mientras `authed === null`), `RsvpButton` (disabled mientras carga) y **ahora `EventFeedCard`: el botón RSVP queda `disabled` mientras `authed === null`** (+ `aria-pressed`/`aria-busy`/`aria-label`).
- [x] **3.27 Empty states inconsistentes** ✅ **Hecho 2026-06-18** — `eventos` con CTA "Explorar lugares" → `/feed`; galería vacía de la ficha con microcopy "Sé el primero en aportar una foto".
- [x] **3.28 Mensajes de éxito sin `role="status"`** ✅ **Hecho 2026-06-18** — `ForgotPasswordForm` + el resto vía toasts (§4); **ahora `ListingForm` añade `role={ok ? 'status' : 'alert'}`** al mensaje de "Cambios guardados" / error.
- [x] **3.29 `UpdatePasswordForm` usa `<input type="password">` plano** ✅ **Hecho 2026-06-18** — ahora reutiliza `PasswordField` (toggle mostrar/ocultar) con `autoComplete="new-password"`.
- [x] **3.30 Jerga "IA" expuesta sin explicación en panel B2B** ✅ **Hecho 2026-06-18** — se nombra al asistente **"Decídeme"** (mismo nombre que el FAB del feed): `EventManager` con label "Asistente Decídeme · te redacta el evento" y placeholder reescrito; `MenuUpload` cambia la insignia "IA" por "Lectura automática" + `title` explicativo y "Decídeme las convierte en menú". (`BoostControl` no tenía jerga IA — el Sparkles es decorativo; sin cambios.)
- [x] **3.31 Dashboard placeholder accesible** ✅ **Hecho 2026-06-18** — `(main)/dashboard/page.tsx` era scaffolding sin implementar y expuesto; ahora **redirige a `/feed`** (oculta el placeholder). Reimplementar si se retoma un dashboard propio.

---

## 4. Tema transversal: sistema de feedback unificado (toasts) ✅ **Hecho 2026-06-18**

**Hecho**: nuevo `src/shared/components/toast.tsx` — sistema de toasts **sin dependencias** (pub/sub vanilla + `useSyncExternalStore`; Zustand no estaba instalado). API global `toast.success/error/info(msg)` callable desde cualquier handler. `<Toaster />` montado una vez en el root layout, con `aria-live` (status/alert según variante), auto-cierre, botón cerrar, y posicionado sobre la tab bar + safe-area. Migrados los `alert()` nativos y los mensajes inconsistentes:
- **3.3** ✅ `alert()` → `toast.error` en `RsvpButton`, `EventFeedCard`, `EventManager`, `ReviewReplies`.
- **3.7** ✅ `PlaceReviews` ya no mezcla éxito/error en verde: validación y errores → `toast.error` (rojo), éxito → `toast.success` (verde). Se eliminó el estado `msg`.
- **3.15** (parcial) ✅ `EventManager` (borrar evento: confirm + toast; boost: toast) y `PlaceReviews` (borrar reseña: confirm + toast). **Pendiente**: `MenuUpload` (quitar carta).
- **3.21** ✅ clipboard verificado (await + catch → `toast.error`) en `ReviewReplies` y `PlaceActions` (antes el catch vacío dejaba "Compartir" sin feedback).
- **3.28** ✅ los mensajes de éxito ahora pasan por toasts con `aria-live`. (Quedan `ListingForm`/`ForgotPasswordForm` con éxito inline — pueden migrarse al toast cuando se toquen.)

---

## 5. Lo que ya está bien (no tocar)

- Feed pide `get_feed`/`get_feed_events` en paralelo (`use-feed.ts:76-79`); `useFeed` memoiza cliente y callbacks; debounce de búsqueda correcto.
- Índices GiST (geo) y HNSW (embedding) existen; `interactions` indexada; `place_metrics` agrega en SQL (patrón a replicar en admin).
- `recompute_trending` corre por `pg_cron` (fuera del request path).
- Anti-FOUC de tema vía script `beforeInteractive` (`layout.tsx:44`); `display: 'swap'` evita FOIT; `lang="es"` en root.
- Proxy de fotos con retry/backoff y degradación a isotipo; cachea bien en cliente (`max-age` + `immutable`).
- `ThemeToggle`, `Chip`, `Loader`, `PlaceActions`, `Notifications` ya tienen `aria-label`/`role` correctos.

---

## 6. Métricas para validar (antes/después)

- **LCP del feed** (móvil, 4G simulada) — debería bajar con 2.1/2.2/2.3.
- **TTFB de `/places/[slug]`** — debería desplomarse con ISR (1.3).
- **Filas leídas por render del admin** (logs Supabase) — con 1.4.
- **Costo Google Places / día** — con 1.2.
- **Peso de fuentes** (~482 KB → objetivo <120 KB) — con 2.4.

---

## 7. Orden sugerido de ataque

**Sprint 1 — Cimientos baratos de alto impacto**
1.1 (índice) · 2.1 (next.config) · 1.2 (caché proxy) · 1.3 (ISR fichas) · 3.2 (try/catch buscar) · 3.1 (aviso geo).

**Sprint 2 — Rendimiento percibido del feed**
2.2 (next/image) · 2.3 (SSR feed) · 2.4 (fuentes) · 2.5+2.6 (re-renders/memo).

**Sprint 3 — Fundación UX + accesibilidad alta**
§4 (toasts) → cierra 3.3/3.7/3.15/3.21 · 3.4 + 3.5 (a11y conserje/forms) · 3.8 (safe-areas) · 3.10 (error.tsx) · 3.6 (focus trap).

**Sprint 4 — Datos que escalan**
1.4 (RPCs admin) · 1.7 (batch track) · 1.8 (caché embeddings) · 1.5/1.6/1.9.

**Continuo — Pulido**
Resto de 🟡/🟢 según se toque cada pantalla.
