# BUSINESS_LOGIC.md — Goospe 2.0 (codename)

> Generado por SaaS Factory | Fecha: 2026-06-12
> Fuente: análisis completo de `docs/` (01–06). Este archivo es el resumen ejecutable; el detalle vive en los docs y **manda el doc cuando haya conflicto**.
> ⚠️ Proyecto 100% nuevo. Nada del legacy Goospe/Gonet (2018–2023) se reutiliza como código, datos o credenciales — solo conceptos validados (ver `docs/01-analisis-legacy.md`).

## 1. Problema de Negocio

**Dolor (lado C):** el usuario urbano de 18–35 años que sale 1–3 veces por semana no quiere un directorio ni leer 40 reseñas: quiere que alguien que lo conoce le diga **dónde ir ahora**, según con quién está y cuánto quiere gastar. Hoy "parcha" el problema scrolleando Instagram con fatiga y decidiendo a última hora en grupo.

**Dolor (lado B):** restaurantes, cafeterías, bares, discotecas y organizadores de eventos pequeños dependen de Instagram (alcance aleatorio, sin datos), Google Business (estático) y boca a boca. No tienen community manager ni analítica.

**Costo actual:** para el negocio, clientes que no llegan y cero visibilidad de qué piensa la gente; para el usuario, sesiones de 20+ minutos de scroll para una decisión de 30 segundos. Job to be done: *"Es jueves 7pm, somos 3, queremos algo chill y barato cerca — decídeme en 30 segundos."*

## 2. Solución

**Propuesta de valor:** un **motor de decisión "¿dónde voy hoy?"** — feed personalizado tipo TikTok de lugares y eventos cercanos + conserje IA que decide contigo + capa B2B ligera donde la IA es el community manager del negocio por $19–99/mes.

> "Abre la app, dinos con quién estás y cuánto quieres gastar. Nosotros te decimos dónde ir — y al negocio le decimos cómo llenarte el local."

**Lo que NO es:** ni un mapa (Google Maps), ni reviews largos (Yelp), ni red social de contenido (TikTok). Es la capa de **decisión + acción local** entre los tres.

**Flujo principal (Happy Path, lado C):**
1. El usuario abre la app (sin registro: perfil anónimo por device) → feed de cards a pantalla completa: foto, nombre, vibe en 1 línea (IA), precio, distancia, "abierto ahora", social proof.
2. Hace scroll → cada interacción (vista >3s, guardar, descartar, "cómo llego") alimenta su perfil de gusto (tabla `interactions` → embedding + resumen semanal por Haiku).
3. O pulsa el conserje: "algo romántico y barato cerca del centro" → Sonnet con candidatos pre-filtrados por pgvector devuelve 3 opciones con el porqué y acciones directas.
4. Decide: guardar ❤️ / cómo llego / RSVP a un evento → **esa es la métrica norte** (% de sesiones que terminan en decisión).

**Flujo principal (lado B):**
1. El dueño encuentra su ficha ya creada y bonita (ETL desde OSM + enriquecimiento IA) → la reclama en <5 min (verificación OTP teléfono o foto del local).
2. Edita info, sube menú (foto → IA lo estructura), crea eventos/promos con IA ("escríbeme la promo del jueves").
3. Recibe el **informe semanal IA** ("tu semana en 5 líneas" + visitas/guardados/clics) — el gancho de retención.
4. Paga suscripción (Impulso $19 / Pro $49 / Élite $99) o boosts puntuales ($5–25).

## 3. Usuario Objetivo

**Rol (C):** urbano 18–35, decide a última hora y en grupo, fatiga de Instagram. Momentos: "ahora mismo" (geolocalizado), planificando el finde, descubrimiento pasivo.
**Rol (B):** dueño de restaurante/bar/cafetería/discoteca/eventos pequeños sin community manager, que vive en el teléfono (auth por OTP).
**Contexto:** vertical comida/bares/nightlife/eventos pequeños × **una sola ciudad** hasta densidad (≥500 lugares ricos, ≥30 negocios reclamados). Escenario A (Santa Clara/Cuba) = laboratorio de producto; Escenario B (ciudad hispana con poder de pago) = mercado de monetización. Arquitectura multi-ciudad desde el día 1. **Ciudad piloto decidida: Puerto Varas (Los Lagos, Chile)** — mercado de pago (Chile, doc 07) en formato ciudad mediana/turística como laboratorio de densidad. Ya sembrada y activa en `cities` (id=1).

## 4. Arquitectura de Datos

**Input:**
- POIs de OpenStreetMap vía Overpass API (ETL determinista: categoría, horario, teléfono, web — *nada estructurado pasa por LLM*).
- Interacciones del usuario (view, save, dismiss, directions, RSVP, consultas conserje).
- Contenido del negocio: fotos, menú (foto → visión IA), eventos, promos, brand_voice.
- Reseñas y fotos de usuarios (moderadas por IA antes de publicar).
- Webhooks de Stripe (suscripciones, boosts).

**Output:**
- Feed rankeado (RPC SQL: embeddings pgvector + heurísticas — **sin LLM por scroll**; boost pagado cap 1/8 cards, marcado).
- Respuestas del conserje (3 picks con porqué, compartibles — gancho viral).
- Informes semanales IA por negocio (panel + email Resend) y análisis competitivo mensual (Élite, Opus).
- Estadísticas B2B (visitas, guardados, clics), push FCM, páginas SEO de lugares (SSR/ISR).

**Storage (Supabase — esquema completo en `docs/05-modelo-de-datos.md`, es la fuente de verdad):**
- `cities`, `categories`, `category_mappings`: geografía + doble taxonomía OSM→propia (herencia v1).
- `places`, `place_categories`, `place_photos`, `place_stats`: lugares con PostGIS + pgvector + contenido IA; agregados por trigger.
- `profiles`, `taste_profiles`, `devices`: usuarios; perfil de gusto = embedding + resumen (lo escribe la IA, no el usuario).
- `interactions`: toda señal de comportamiento (alimenta ranking + analítica B2B + PostHog).
- `reviews`, `favorites`: una reseña viva por usuario/lugar, moderación IA.
- `events`, `event_rsvps`: evento único por lugar/fecha (herencia v1), aprobación, boost.
- `businesses`, `business_members`, `claims`, `subscriptions`, `boosts`, `business_reports`: capa B2B completa.
- `ai_usage`, `concierge_quota`, `moderation_queue`, `audit_log`, `feed_config`: operación, presupuesto IA y pesos del ranking sin deploy.
- Extensiones requeridas: `postgis`, `vector`, `pg_trgm`, `unaccent`, `pg_cron`.

## 5. KPI de Éxito

**Métrica norte:** % de sesiones que terminan en una decisión (guardar / cómo llego / RSVP) → **>35%**.

| Lado | KPI | Umbral |
|---|---|---|
| C | Retención D30 | >20% |
| C | Consultas conserje / usuario activo | >2/mes |
| B | Negocios reclamados / total fichas | >15% |
| B | Churn mensual de pago | <6% |
| B | % informes semanales abiertos | >60% |
| $ | Coste IA / MRR | <10% (y <$0.30/usuario activo/mes) |

**Gate de escalado:** D30 >20% y >30 negocios activos → activar cobro / segunda ciudad.

## 6. Especificación Técnica (Para el Agente)

### Features a Implementar (Feature-First)

```
src/features/
├── auth/           # Supabase Auth: email + Google (usuarios), OTP teléfono (owners)
├── feed/           # Cards full-screen, RPC get_feed (PostGIS+pgvector+heurísticas), interactions
├── places/         # Ficha de lugar (SSR/ISR SEO), reseñas moderadas, favoritos, búsqueda fuzzy
├── concierge/      # Chat "decide por mí": Sonnet + prompt caching + cuota free 8-10/mes
├── events/         # "Hoy/Esta semana", RSVP 1-toque realtime, push recordatorio
├── business/       # Reclamar ficha, panel B2B, menú por visión IA, promos IA, stats
├── billing/        # Stripe: planes Impulso/Pro/Élite + boosts one-off, webhook → subscriptions
├── reports/        # Informe semanal IA (batch domingo) + análisis competitivo (Élite)
├── etl/            # Pipeline OSM → dedupe → mapeo taxonomía → enriquecimiento por niveles
└── admin/          # Moderación, métricas norte, dashboard coste IA, edición de fichas
```

### Stack Confirmado (Golden Path + docs 04)
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + shadcn/ui
- **Backend:** Supabase (Auth + Postgres 15 + PostGIS + pgvector + Storage + Edge Functions + pg_cron + Realtime)
- **Móvil:** Capacitor (Android primero) — shell estático + supabase-js directo; SSR solo web
- **IA:** Claude API tras interfaz única `LLM` (tiers: cheap=Haiku 4.5 batch / smart=Sonnet 4.6+cache / max=Opus 4.8) + embeddings Voyage/OpenAI
- **Mapas:** MapLibre GL + MapTiler · **Pagos:** Stripe · **Push:** FCM · **Email:** Resend · **Observabilidad:** Sentry + PostHog
- **Validación:** Zod · **Estado:** Zustand · **MCPs:** Next.js DevTools + Playwright + Supabase

> Nota de estructura: los docs (04 §2) proponen monorepo pnpm+Turborepo; este repo arranca con la estructura flat de SaaS Factory. Decidir en Fase 0 si se migra a monorepo o se mantienen `packages/{ai,etl}` como `src/shared/lib/ai` y `scripts/etl` hasta que exista la app móvil.

### Reglas duras de IA (doc 03 §5.3 y 04 §5.1 — no negociables)
1. **Determinista primero:** lo que OSM da estructurado jamás pasa por un LLM; la IA solo redacta sobre datos verificados. Si no hay dato, el campo queda vacío (cero alucinaciones factuales).
2. **Sin LLM en el scroll:** el feed es SQL + embeddings; el LLM solo refresca perfiles (batch semanal).
3. **Enriquecimiento por niveles:** ancla ~50 (manual+IA revisada) / completo ~500 (batch) / cola larga on-demand al primer view.
4. **Prompt congelado** contra muestra de 50 lugares antes de cualquier batch masivo.
5. **Nunca re-pagar:** todo output IA se persiste; re-runs saltan lo generado salvo nueva versión de prompt.
6. **Presupuesto con corte:** contador en `ai_usage`, corte suave a `cheap` al 2× del presupuesto. Patrocinado nunca >1/8 cards.

### Plan de ejecución (14 semanas — detalle y criterios de salida en `docs/06-plan-de-implementacion.md`)
1. [ ] **Fase 0 — Fundaciones (s1–2):** Supabase (extensiones + migración doc 05 + seed taxonomía), auth con trigger on-signup, deploy Vercel, shell Capacitor, CI, Sentry+PostHog. *Salida: registro desde APK → profile en prod.*
2. [ ] **Fase 1 — Datos (s2–4):** ETL Overpass + dedupe + parsers deterministas + enriquecimiento por niveles + admin de fichas. *Salida: ≥500 lugares publicados, ≥80% con descripción, 50 ancla impecables.* **Esta fase decide el lanzamiento.**
3. [ ] **Fase 2 — Feed y ficha (s4–7):** RPC get_feed, UI swipe, interactions, ficha SEO, reseñas, favoritos, búsqueda, onboarding ≤3 preguntas. *Salida: sesión media >3 min en beta interna.*
4. [ ] **Fase 3 — Conserje + eventos (s7–9):** /api/ai/concierge con streaming + cuota + resultado compartible; eventos con RSVP realtime y push. *(Desactivable si hay que cortar — nunca cortar feed ni panel B2B.)*
5. [ ] **Fase 4 — Panel de negocio (s9–12):** claims, panel, menú visión, promos IA, informe semanal, Stripe + gates por plan, 30 negocios ancla. *Salida: 20 reclamados, 10 publican solos.*
6. [ ] **Fase 5 — Pulido y lanzamiento (s12–14):** push re-engagement, performance (<1.5s p95), Play Store, landing SEO, panel admin.

### Decisiones abiertas (bloquean Fase 0/1)
- [ ] **Ciudad piloto** (doc 03 §3 — única decisión que bloquea el arranque).
- [ ] **Nombre y marca** (doc 02 §8 — no bloquea: se desarrolla con codename "Goospe 2.0").
- [ ] Validar ETL de prueba sobre la ciudad elegida (cuántos lugares reales salen de OSM) antes de escribir UI.
