# 09 — Estado de Implementación y Análisis de Brechas

> Fecha de corte: **2026-06-16** · Ciudad piloto: **Puerto Varas, Chile** (city id=1)
> Este documento inventaría lo construido y lo contrasta contra el plan (docs 02, 03, 06)
> para ver qué falta antes del lanzamiento. **Decisión de equipo: no activar cobros**
> hasta validar el producto; lo relacionado a pago queda construido pero sin pasarela.

---

## 1. Resumen ejecutivo

El producto tiene **el loop completo de descubrimiento de punta a punta** funcionando de
forma anónima (feed → ficha → conserje) más **autenticación, guardados, reseñas, panel B2B
(reclamar + editar + eventos + boost) y fotos de usuario con moderación**. Todo verificado
contra la base de datos real.

Lo que falta para un MVP de lanzamiento es, sobre todo: **telemetría de comportamiento
(`interactions`)** — que es la base tanto de la personalización (lado C) como de las
estadísticas e informe semanal (lado B, el gancho de retención) — **búsqueda/filtros**,
**"abierto ahora"**, **onboarding + personalización por gusto**, y la capa de **pagos**
(diferida a propósito). Mobile (Capacitor), OAuth Google, OTP, Sentry/PostHog y emails
siguen diferidos según lo acordado.

---

## 2. Inventario de lo construido (✅)

### Datos (Fase 1)
- ETL Overpass por bbox del corredor Puerto Varas–Llanquihue–Frutillar, dedupe y mapeo
  de tags OSM → categorías. **218 lugares** publicados.
- Enriquecimiento IA (descripción, `vibe_line`, tags, `price_level`) + embedding `vector(1024)`.
  Capa `lib/ai` intercambiable; se usó **OpenAI gpt-4o + text-embedding-3-large** (el plan
  preveía Haiku/Voyage; la capa permite cambiar sin tocar el resto). 218/218 enriquecidos (~$0.41).
- Fotos: **Google Places (mostrar, no almacenar)** como primaria + **Mapillary** como fallback;
  proxy server-side resiliente con fallback a marca. Cobertura ~100%.
- Vista admin de validación (`/places`, `/places/[slug]`) con borrado de fotos.

### Feed + ficha (Fase 2)
- RPC `get_feed(lat,lng,radius,limit,offset)`: candidatos PostGIS + score
  (distancia decay + trending + diversidad estable + **bonus de boost**).
- UI de feed full-screen con scroll-snap vertical; acciones: **guardar ❤️, cómo llego
  (intent Google Maps), compartir**. Badge **"✨ Destacado"** para boosts.
- Ficha de lugar con galería, datos, fotos de usuario, eventos próximos y reseñas.
- **Reseñas** con estrellas (1 por usuario, editable/borrable); trigger recalcula rating
  → el feed lo muestra. Auto-aprobadas en el piloto.
- **Favoritos en DB** (RLS por usuario) + pantalla `/saved`; el anónimo usa localStorage y
  **migra a la cuenta al iniciar sesión**.

### Conserje + eventos (Fase 3)
- `/api/concierge`: embedding de la consulta → `match_places` (pgvector + cercanía) →
  gpt-4o elige 3 con su porqué (structured output). UI branded con chips de ejemplo.
- **Eventos**: cartelera pública `/eventos`, RSVP de 1 toque (RLS propia), eventos en la
  ficha del lugar y gestor en el panel del dueño.

### Panel B2B (Fase 4, sin cobro)
- **Reclamar** lugar (instantáneo en el piloto: crea `business` + `owner` + linkea place +
  registra `claim` aprobado).
- **Editar ficha**: vibe, descripción, contacto, precio, tags (server action con verificación
  de membresía, porque `places` no permite write a `authenticated`).
- **Crear/eliminar eventos** del lugar.
- **Boost**: destacar el lugar N días (gratis en el piloto; el registro `boosts` ya queda listo
  para cuando se conecte el pago).

### Fotos de usuario + moderación
- Subida de foto por usuarios autenticados → Supabase Storage → `status='pending'`.
- `/admin/fotos`: cola de moderación (aprobar / rechazar+borrar objeto). Solo `is_admin`.

### Autenticación e infraestructura
- Auth email/contraseña (Supabase SSR, `proxy.ts` Next 16); páginas branded login/signup/
  recuperación. Rutas protegidas: `/profile`, `/saved`, `/panel`, `/admin`.
- Identidad visual Goospe (logos, isotipo, Roboto local, colores de marca).
- Pipeline de migraciones vía Management API (0001–0014).

---

## 3. Brechas por fase (lo que falta)

### Fase 1 — Datos
- [ ] Llegar a **≥500 lugares** (hoy 218) — criterio de salida del plan.
- [ ] **3 niveles de enriquecimiento** (ancla/completo/cola larga) + **enriquecimiento
      on-demand al primer view** (hoy todo se enriquece igual).
- [ ] ~50 lugares **ancla** con fotos reales tomadas para el proyecto y datos verificados.
- [ ] Métricas de calidad formales (% con foto / horario / descripción) en un panel.

### Fase 2 — Feed y ficha  ✅ **brechas principales cerradas (2026-06-16)**
- [x] **Registro de `interactions`** — `lib/track.ts` + `/api/track` (view_card≥2s, save,
      unsave, dismiss, directions, share, view_detail, concierge_pick, rsvp). Funciona con
      y sin sesión (anónimo por id de dispositivo). Base de personalización y stats.
- [x] Acción **"no me interesa" / descartar** en el feed (oculta + suprime a futuro).
- [x] **Búsqueda** fuzzy + **filtros** por categoría / precio / abierto (`/buscar`, RPC `search_places`).
- [x] **"Abierto ahora"** timezone-aware (`lib/hours.ts`, América/Santiago).
- [x] **Onboarding ≤3 preguntas** (`/onboarding`) → `profiles.onboarding` + `taste_profiles`.
- [x] **Personalización en el ranking**: `get_feed` usa `taste_profiles.embedding` (afinidad
      coseno) cuando hay onboarding; anónimos mantienen cercanía+trending+diversidad+boost.
- [ ] Pendiente menor: mapa estático en la ficha; moderación IA de reseñas (hoy auto-aprobadas);
      merge completo del perfil anónimo por device al registrarse (hoy migran favoritos; las
      interacciones anónimas quedan ligadas por `anon_id` en `context`, sin merge retroactivo).

### Fase 3 — Conserje + eventos
- [x] **Cuota free** del conserje (`concierge_quota`, 20/mes autenticados, 429 con upsell) +
      **telemetría de coste** (`ai_usage`, tokens reales + coste). Migración 0018.
- [x] **Moderación de eventos** (y reseñas): cola admin reactiva en `/admin/contenido`
      (ocultar/restaurar). El contenido sigue auto-aprobado para el demo.
- [x] **Streaming** de la respuesta del conserje (SSE, las recomendaciones aparecen una a una).
- [ ] **Resultado compartible**: el deep link a la ficha ya existe; falta la **imagen OG** generada. *(Mejora menor.)*
- [ ] **Cards de evento dentro del feed** (hoy los eventos viven aparte en `/eventos` y la ficha).
- [ ] Push recordatorio del evento (depende de mobile/FCM, diferido).

### Fase 4 — Panel de negocio
- [ ] **Verificación al reclamar** (OTP al teléfono o foto del local). Hoy instantáneo.
      *(Diferido: el OTP necesita proveedor SMS de pago.)*
- [x] **Subir menú** (foto → visión IA → menú estructurado) — `actions/menu.ts` (migración 0019).
- [x] **Asistente IA de promo/evento** (con `brand_voice`) — en EventManager.
- [x] **Respuestas sugeridas a reseñas** (IA) — en el panel.
- [x] **Informe semanal IA** "tu semana en 5 líneas" — en el panel (`business_reports`).
      *(Sin email: Resend diferido.)*
- [x] **Estadísticas del negocio** (visitas de ficha, apariciones en feed, guardados, cómo
      llego, compartidos, elegido-por-conserje; 7d/30d) — `StatsPanel` + RPC `place_metrics`
      (migración 0017), en `/panel/[placeId]`.
- [ ] **Gates por plan** (free=1 evento activo, Impulso=3, etc.) — hoy sin límites por plan
      (se activan junto con pagos).
- [ ] 🔒 **Pagos (diferido por decisión de equipo)**: checkout de planes + webhook →
      `subscriptions`; boost de pago. La estructura (`businesses.plan`, `subscriptions`,
      `boosts.amount_usd`) ya existe; solo falta la pasarela.

### Fase 5 — Pulido y lanzamiento
- [x] **Landing pública** + SEO de fichas (`generateMetadata`, `sitemap.ts`, `robots.ts`).
- [ ] Push de re-engagement, performance (AVIF/WebP responsivo), QA checklist heredada.
- [ ] **Panel admin** de métricas norte + dashboard de coste IA (los datos ya están en
      `ai_usage` e `interactions`; falta la vista agregada).
- [ ] Play Store / mobile (Capacitor) — diferido.

---

## 4. Diferido a propósito (no es brecha, es decisión)
- **Pagos / pasarela** (hasta validar con el equipo).
- **Mobile / Capacitor**, **OAuth Google**, **OTP teléfono**.
- **Sentry + PostHog**, **emails transaccionales (Resend)**.
- **Multi-ciudad** (la arquitectura ya lo soporta vía `cities`; piloto = solo Puerto Varas).

---

## 5. Recomendación de orden (sin tocar pagos)

Para que el equipo pruebe un MVP que **demuestre la tesis** (personalización + valor B2B):

1. ✅ **`interactions` (telemetría)** — hecho.
2. ✅ **Búsqueda + filtros + "abierto ahora"** — hecho.
3. ✅ **Estadísticas del negocio en el panel** — hecho.
4. ✅ **Onboarding + gusto en el ranking** — hecho.
5. ✅ **Cuota + telemetría del conserje** y **moderación de eventos/reseñas** — hecho.
6. ✅ **Mejoras B2B + descubrimiento** — mapa en ficha, generador de promo IA, respuestas a
   reseñas IA, menú con visión IA, informe semanal IA, landing+SEO, streaming del conserje.
7. Cuando el equipo dé el OK → **pagos** (lo único que falta para monetizar).

**Estado:** prácticamente **todo el producto no-pago está construido**. Lo que queda son:
(a) **pagos** (esperando OK del equipo) y los **gates por plan** que se activan con ellos;
(b) cosas que dependen de infra de pago/diferida: **OTP al reclamar** (SMS), **mobile/Capacitor**,
**envío de emails** (Resend), **Sentry/PostHog**, **push FCM**;
(c) pulidos opcionales: imagen OG del conserje, cards de evento en el feed, dashboard admin de
coste IA agregado, performance/QA de lanzamiento.

---

## 6. Notas de limpieza pendientes
- `/app/(main)/dashboard` parece scaffolding heredado de un skill; revisar si se elimina.
- `/places` y `/places/[slug]` siguen siendo la vista "temporal de validación" pero son la
  ficha de facto a la que enlaza el feed; conviene decidir si se promueven a UI final.
