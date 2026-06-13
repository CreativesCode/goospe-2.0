# 06 — Plan de Implementación Detallado

> Horizonte: **14 semanas hasta lanzamiento público** en la ciudad piloto, asumiendo 1–2 desarrolladores (el stack único lo permite). Cada fase tiene criterio de salida explícito: no se pasa a la siguiente sin cumplirlo.

---

## Fase 0 — Fundaciones (semanas 1–2)

**Objetivo:** esqueleto del monorepo funcionando end-to-end (web deployada + APK instalable que muestra "hola mundo" desde Supabase).

- [ ] Monorepo pnpm + Turborepo: `apps/web`, `apps/mobile`, `packages/{db,ai,ui,etl}`.
- [ ] Proyecto Supabase (dev+prod), extensiones `postgis, vector, pg_trgm, unaccent, pg_cron`.
- [ ] Migración inicial completa (doc 05) + seed de `categories` y `category_mappings` (partir del mapeo OSM→Gonet del legacy).
- [ ] Next.js 15 deployado en Vercel; Capacitor con shell Android compilando (Java 21, targetSdk 35); firma y keystore NUEVOS (no reutilizar el del legacy, credenciales comprometidas).
- [ ] Supabase Auth: Google + email + OTP teléfono; tabla `profiles` con trigger on-signup.
- [ ] CI: lint + typecheck + build en PR; deploy auto a staging.
- [ ] Sentry + PostHog instalados.

**Criterio de salida:** un usuario se registra desde el APK y su profile aparece en prod.

---

## Fase 1 — Datos: la ciudad llena (semanas 2–4, paralelizable con F0)

**Objetivo:** 100% de los lugares objetivo de la ciudad piloto cargados y enriquecidos. **Esta fase decide el éxito del lanzamiento.**

- [ ] `packages/etl`: extractor Overpass por bbox + categorías objetivo (comida/bares/café/nightlife/eventos).
- [ ] Dedupe (nombre normalizado + distancia <50m) y mapeo de tags → `categories`.
- [ ] Geocoding inverso para dirección humanizada (lección v1: "casi nunca veo la dirección humanizada").
- [ ] Parsers deterministas para todo lo estructurado de OSM (`opening_hours`, teléfono, web, `cuisine`) — **regla: nada que ya venga estructurado pasa por un LLM** (doc 04 §5.1).
- [ ] Definir los 3 niveles de enriquecimiento: ancla (~50, manual+IA revisada), completo (top ~500, batch), cola larga (ficha mínima + enriquecimiento on-demand al primer view).
- [ ] Ajustar y **congelar el prompt de enriquecimiento contra una muestra fija de 50 lugares** antes de lanzar el batch masivo (las re-ejecuciones de desarrollo son el coste oculto, no los tokens).
- [ ] Enriquecimiento Haiku batch (niveles ancla+completo): descripción, `vibe_line`, tags, `price_level` estimado (structured outputs) + embedding del lugar; persistir output (no re-pagar en re-runs).
- [ ] Endpoint de enriquecimiento on-demand para la cola larga (primer view → enrich → persistir).
- [ ] Carga manual asistida de los ~50 lugares ancla (fotos reales tomadas para el proyecto nuevo, datos verificados in situ).
- [ ] Vista admin mínima para revisar/editar fichas (tabla + edición inline).
- [ ] Métricas de calidad: % con foto, % con horario, % con descripción.

**Criterio de salida:** ≥500 lugares publicados; ≥80% con descripción+tags; los 50 ancla impecables.

---

## Fase 2 — El feed y la ficha (semanas 4–7)

**Objetivo:** el corazón del producto: abrir la app → scroll de cards relevantes → ficha → acción.

- [ ] RPC `get_feed(lat,lng,cursor)`: candidatos PostGIS + score (doc 04 §4) + diversidad. Pesos en `feed_config`.
- [ ] UI feed: cards full-screen con swipe vertical, acciones (guardar, cómo llego → intent a Google Maps, compartir, descartar), skeletons, paginación por cursor.
- [ ] Registro de `interactions` (view>3s, save, dismiss, directions…) con buffer offline-tolerante.
- [ ] Ficha de lugar (`/lugar/[slug]`): fotos, vibe, horario con "abierto ahora" (timezone-aware — lección v1 de los husos), mapa estático, reseñas, eventos próximos. SSR/ISR para SEO en web.
- [ ] Reseñas: crear/editar (rating+texto), moderación IA inline (Haiku <1s), trigger de stats.
- [ ] Favoritos + pantalla "Guardados".
- [ ] Búsqueda: texto fuzzy (trgm) + filtro por categoría/precio/abierto.
- [ ] Perfil anónimo por device → merge al registrarse.
- [ ] Onboarding ≤3 preguntas → `profiles.onboarding` + afinidad inicial.

**Criterio de salida (beta interna, 10 personas):** sesión media >3 min; "el feed me enseña cosas que no conocía" en 7/10 tests de pasillo.

---

## Fase 3 — Conserje + eventos (semanas 7–9)

- [ ] `/api/ai/concierge`: intake (texto libre o chips) → SQL candidatos → Sonnet con prompt cacheado de ciudad → 3 picks con porqué (structured output) → cards accionables. Streaming de respuesta.
- [ ] Cuota free (tabla `concierge_quota`) + telemetría de coste (`ai_usage`).
- [ ] Resultado compartible (deep link + imagen OG generada) — es el gancho viral.
- [ ] Eventos: pestaña "Hoy / Esta semana", RSVP 1-toque con contador realtime, push recordatorio día del evento (FCM).
- [ ] Cards de evento dentro del feed.
- [ ] Moderación de eventos (cola admin).

**Criterio de salida:** beta cerrada 50 usuarios; ≥30% prueba el conserje; coste IA/usuario dentro de lo previsto (doc 03 §5.2).

---

## Fase 4 — Panel de negocio (semanas 9–12)

**Objetivo:** lo que la v1 nunca terminó y es el modelo de ingresos.

- [ ] Flujo reclamar ficha desde el móvil: buscar tu negocio → verificación OTP al teléfono de la ficha o foto del local → `claims` → aprobación (admin en MVP).
- [ ] Panel (`/panel`): editar ficha, fotos, horarios; subir menú (foto → Sonnet visión → menú estructurado).
- [ ] Crear evento/promo con asistente IA ("escríbeme la promo del jueves" con `brand_voice`).
- [ ] Estadísticas: visitas, guardados, clics a cómo-llegar/teléfono, gráfico semanal (datos de `interactions`).
- [ ] **Informe semanal IA** (batch domingo) en panel + email (Resend). Free ve teaser de 1 línea → upsell.
- [ ] Respuestas sugeridas a reseñas (botón "sugerir respuesta").
- [ ] Stripe: checkout de planes (Impulso/Pro/Élite), webhook → `subscriptions`, gates por plan en RLS/route handlers. Boosts como Checkout one-off → efecto en el score del feed (cap 1/8).
- [ ] Onboarding comercial: 30 negocios ancla visitados, plan fundador (Pro gratis 3 meses).

**Criterio de salida:** 20 negocios reclamados; 10 publican un evento/promo sin ayuda; informe semanal con >60% de apertura.

---

## Fase 5 — Pulido y lanzamiento (semanas 12–14)

- [ ] Push de re-engagement (máx 2/semana: "3 planes para tu sábado" — generado por batch, segmentado por taste_profile).
- [ ] Performance: feed <1.5s p95 en gama media Android; imágenes AVIF/WebP con tamaños responsivos.
- [ ] QA con la checklist heredada de `!!to do` (teclado en comentarios, scroll preservation, estados vacíos con mensaje — "Poner que No hay datos").
- [ ] Play Store: ficha, screenshots, política de privacidad, data safety; release a track interna → producción.
- [ ] Landing pública (goospe.com) con SEO de fichas (sitemap por ciudad — herencia v1).
- [ ] Panel admin: moderación, métricas norte, dashboard coste IA.
- [ ] Evento de lanzamiento con 3–5 negocios ancla (promos exclusivas en la app la primera semana).

**Criterio de salida:** públicos en Play Store y web; métricas norte instrumentadas.

---

## Post-lanzamiento (mes 4+) — backlog priorizado

1. Usuario Premium ($2.99): conserje ilimitado, listas colaborativas con amigos (la `Friendship` que v1 nunca terminó, ahora con propósito: decidir en grupo).
2. iOS (Capacitor lo deja a un `pnpm cap add ios` + cuenta Apple).
3. Segunda ciudad (playbook: ETL → ancla → beta → comercial).
4. Reservas informales por WhatsApp deep-link (sin pasarela, como pedía el doc original de v1).
5. Modo offline ligero (caché de feed + tiles) si se opera en Cuba.
6. API de datos agregados / paquetes multi-local.

---

## Riesgos de ejecución y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Capacitor + Next.js App Router fricción (SSR en app) | decidido en doc 04: shell estático + supabase-js directo en app; SSR solo web. Validar en Fase 0, no después |
| Calidad del enriquecimiento IA (alucinar horarios/precios) | la IA solo redacta sobre datos existentes; campos factuales (horario, teléfono) jamás los inventa — si no hay dato, queda vacío y la card lo omite |
| Un dev solo y 14 semanas | el orden de fases es por valor: si hay que cortar, se lanza sin conserje (Fase 3 es desactivable), nunca sin feed ni sin panel B2B |
| Costes IA descontrolados en beta | presupuesto duro + dashboard desde Fase 3, no al final |
| Negocios no entran | plan fundador gratis + la ficha ya existe y bonita (solo "reclámala"); venta presencial, no email |
