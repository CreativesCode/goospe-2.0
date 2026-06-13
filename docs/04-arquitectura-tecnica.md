# 04 — Arquitectura Técnica

> Stack decidido: **Next.js + Supabase + Capacitor (Android primero)**. Este documento define cómo se arma todo, incluida la capa de IA.

---

## 1. Diagrama general

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
│  ┌──────────────────┐   ┌──────────────────────────────┐    │
│  │ App Android      │   │ Web (mismo Next.js)          │    │
│  │ Capacitor +      │   │ - app.goospe.com (PWA feed)  │    │
│  │ Next.js (export) │   │ - goospe.com (landing+SEO)   │    │
│  └────────┬─────────┘   │ - panel.goospe.com (B2B)     │    │
│           │             └──────────┬───────────────────┘    │
└───────────┼────────────────────────┼────────────────────────┘
            │ supabase-js + API routes│
┌───────────▼────────────────────────▼────────────────────────┐
│ Next.js (Vercel) — App Router                                │
│  - SSR/ISR páginas públicas de lugares (SEO)                 │
│  - Route Handlers /api/*: conserje IA, feed, webhooks Stripe │
│  - Server Actions panel B2B                                  │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│ SUPABASE                                                      │
│  Postgres 15 + PostGIS + pgvector  ← núcleo                   │
│  Auth (email, Google, teléfono)                               │
│  Storage (fotos lugares/menús/eventos)                        │
│  Edge Functions (jobs IA batch, triggers)                     │
│  Realtime (contadores RSVP, notificaciones in-app)            │
│  pg_cron (informes semanales, refresh perfiles, agregados)    │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│ SERVICIOS EXTERNOS                                            │
│  Claude API (Haiku 4.5 batch / Sonnet 4.6 + cache)            │
│  Voyage/OpenAI embeddings · MapLibre + MapTiler tiles         │
│  FCM (push) · Stripe (B2B) · Resend (email)                   │
│  OSM/Overpass (ETL lugares) · Sentry · PostHog                │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo

```
goospe/
├── apps/
│   ├── web/                  # Next.js 15 (App Router) — feed, conserje, fichas SEO, landing
│   │   ├── app/(feed)/       # feed, lugar/[slug], eventos, conserje
│   │   ├── app/(panel)/      # panel B2B (negocios)
│   │   ├── app/api/          # route handlers: ai/, feed/, stripe/
│   │   └── ...
│   └── mobile/               # Capacitor (envuelve build estático o webview a app.goospe.com)
│       ├── android/
│       └── capacitor.config.ts
├── packages/
│   ├── db/                   # tipos generados de Supabase + queries compartidas
│   ├── ai/                   # capa de IA: prompts, clientes, presupuesto (ver §5)
│   ├── ui/                   # componentes compartidos (cards, mapa, etc.)
│   └── etl/                  # place-pipeline (sucesor del place-uploader)
├── supabase/
│   ├── migrations/           # SQL (doc 05)
│   ├── functions/            # Edge Functions (Deno)
│   └── seed/
└── turbo.json / pnpm-workspace.yaml
```

**Decisión Capacitor:** empaquetar la web como app con `output: 'export'` para las rutas del feed **no** funciona bien con SSR; la estrategia correcta es: la app Capacitor carga un build estático del shell (feed cliente-side con supabase-js directo) y usa plugins nativos para: Geolocation, Push (FCM), Share, StatusBar, App Links. Las páginas SEO siguen siendo SSR en la web. Un solo codebase, dos targets.

---

## 3. Decisiones clave y por qué

| Tema | Decisión | Por qué |
|---|---|---|
| BD geográfica | **PostGIS** (`location geography(Point)`) | búsquedas por radio/bbox idénticas a las del legacy pero gratis (`ST_DWithin`) |
| Búsqueda semántica | **pgvector** (embeddings de lugar y de usuario) | sustituye al kNN artesanal v1; un índice HNSW y a correr |
| Búsqueda texto | `pg_trgm` (ya validado en v1) + unaccent | fuzzy en español con tildes |
| Mapas | **MapLibre GL** + tiles MapTiler (free tier 100k loads) | sin servidores de tiles propios; offline ligero = caché de tiles si hace falta |
| Auth | Supabase Auth: teléfono (OTP) para owners, Google/email para usuarios | el owner cubano/latino vive en el teléfono |
| Pagos | Stripe Billing (suscripciones) + Checkout (boosts) | webhooks → tabla `subscriptions` |
| Push | FCM vía Capacitor Push plugin; tokens en tabla `devices` | gratis |
| Imágenes | Supabase Storage + transformaciones; subida directa firmada | |
| Analítica producto | PostHog (eventos = misma tabla `interactions` que alimenta el ranking, doble destino) | una sola instrumentación |
| Jobs | `pg_cron` + Edge Functions; lo pesado de IA via **Batch API** nocturna | sin colas externas en MVP |

---

## 4. El feed: cómo se calcula (sin LLM por request)

```
GET /api/feed?lat&lng&session
1. Candidatos (SQL): lugares a <X km, abiertos o por abrir, no descartados
   recientemente por el usuario.            ~200 filas, <30ms con índices
2. Score = w1·sim_embedding(usuario, lugar)        (pgvector)
         + w2·afinidad_categoría(historial)
         + w3·calidad (rating bayesiano + trending 30d, herencia v1)
         + w4·contexto (hora/día: bar de noche, café de mañana)
         + w5·novedad (no visto recientemente)
         + boost pagado (cap 1/8, etiquetado)
3. Re-rank de diversidad (no 5 pizzerías seguidas) y paginación por cursor.
```
- El score se computa en una función SQL/RPC de Supabase (rápido y barato). Los pesos `w` viven en una tabla `feed_config` para iterar sin deploy.
- El **perfil de usuario** (embedding + resumen) lo refresca un job semanal (Haiku) leyendo `interactions`. Usuarios anónimos: perfil por device_id con afinidad de categorías simple.

## 5. Capa de IA (`packages/ai`)

```ts
// interfaz única — el proveedor es intercambiable, los prompts son el activo
export interface LLM {
  complete(req: { system: string; messages: Msg[]; model: Tier; maxTokens: number; cache?: boolean }): Promise<Out>;
  batch(reqs: BatchReq[]): Promise<BatchHandle>;     // Batch API -50%
  embed(texts: string[]): Promise<number[][]>;
}
type Tier = 'cheap' /* Haiku 4.5 */ | 'smart' /* Sonnet 4.6 */ | 'max' /* Opus 4.8 */;
```

| Caso de uso | Tier | Modo | Notas |
|---|---|---|---|
| Enriquecer ficha (descripción, vibe, tags, precio estimado) | cheap | batch nocturno | trigger al insertar lugar nuevo |
| Estructurar menú desde foto | smart | online | visión; structured outputs (JSON schema) |
| Moderación UGC (reseña/foto) | cheap | online (<1s) | bloquea antes de publicar |
| Perfil de gusto semanal | cheap | batch | input: interactions agregadas |
| Conserje | smart | online + prompt caching (contexto ciudad, TTL 1h) | candidatos pre-filtrados por SQL; el LLM elige 3 y explica |
| Informe semanal negocio | cheap (Impulso) / smart (Pro) | batch domingo noche | structured output → se renderiza en panel + email |
| Respuestas a reseñas, promos | cheap/smart | online | tono del negocio guardado en su ficha |
| Análisis competitivo (Élite) | max | batch mensual | |

Reglas duras: presupuesto mensual con contador en BD (`ai_usage`), corte suave a `cheap` al 2× del presupuesto, structured outputs en todo lo que se parsea, prompts versionados en el repo.

### 5.1 Principios de frugalidad de IA (valen más que cambiar de modelo)

El coste por token es ruido a esta escala (~$25 los 10.000 lugares); lo que dispara el gasto real son las re-ejecuciones y el mal reparto de trabajo. Cuatro principios de diseño, en orden de impacto:

1. **Determinista primero, IA solo para redactar.** Todo lo que OSM ya da estructurado se procesa con código, nunca con LLM: categoría (`amenity=*`, `cuisine=*` → `category_mappings`), horario (`opening_hours` con parser de librería), teléfono, web, dirección. El LLM solo genera lo que no existe (descripción, `vibe_line`, tags de ambiente, precio estimado) **a partir de los datos ya verificados**. Resultado: ~70% menos tokens y cero alucinaciones en campos factuales — si no hay dato, el campo queda vacío y la UI lo omite.
2. **Enriquecimiento por niveles, no café para todos.**
   - *Nivel ancla* (~50 lugares): manual + IA con revisión humana — son el escaparate.
   - *Nivel completo* (top ~500 que el feed mostrará de verdad): enriquecimiento batch completo + embedding.
   - *Cola larga*: ficha mínima determinista (nombre, categoría, mapa); se enriquece **on-demand** la primera vez que alguien abre la ficha (online, `cheap`, y se persiste para no re-pagar).
3. **Prompt congelado antes del run grande.** Los prompts se ajustan contra una muestra fija de ~50 lugares; solo cuando el output está validado se lanza el batch de miles. Nunca iterar prompts contra el dataset completo.
4. **Nunca re-pagar lo generado.** El output crudo de cada enriquecimiento se persiste (`ai_enriched_at` + contenido en `places`); los re-runs del ETL saltan lo ya enriquecido salvo invalidación explícita (cambio de versión de prompt).

El cambio de proveedor/modelo (Gemini Flash, open-source, etc.) queda como optimización futura tras la interfaz `LLM` — es una tarde de trabajo cuando el gasto lo justifique (>$500/mes), no una decisión de MVP.

## 6. ETL de lugares (`packages/etl`) — sucesor del place-uploader

1. **Extract**: Overpass API (OSM) por bbox de la ciudad → POIs de categorías objetivo. Fuente secundaria: scraping ligero de webs/IG públicos del propio negocio (solo para enriquecer su ficha).
2. **Transform (100% determinista, sin LLM)**: dedupe (nombre+distancia), mapeo de tags OSM → taxonomía propia (tabla `category_mappings`), parser de `opening_hours`, geocoding inverso para dirección humanizada.
3. **Enrich (IA, según niveles de §5.1)**: Haiku en batch genera descripción, vibe-line, tags, rango de precio estimado **solo sobre los datos verificados del paso 2**; embeddings del lugar. Cola larga: ficha mínima, enriquecimiento on-demand al primer view.
4. **Load**: upsert a Supabase con `source='osm'` y `claimed=false`.
5. Re-run mensual: detecta nuevos/cerrados (los reclamados nunca se sobreescriben; lo ya enriquecido no se re-genera salvo nueva versión de prompt).

## 7. Seguridad y multi-tenancy

- **RLS en todo**: usuarios solo escriben sus interactions/reviews/RSVPs; owners solo editan lugares donde `business_members.user_id = auth.uid()`; panel admin con role claim.
- Service role solo en server (route handlers / edge functions); la app móvil usa siempre anon key + RLS.
- Auditoría: tabla `audit_log` por trigger en tablas sensibles (herencia del `Trace` de v1).
- Moderación: cola `moderation_queue` (IA pre-filtra, humano decide los dudosos) — herencia de `ReviewAssignment`.
- Rate limiting del conserje por usuario (tabla de contadores) además del límite de plan.

## 8. Entornos y CI/CD

- `dev` (Supabase local + branch), `staging`, `prod`. Migraciones SQL versionadas con supabase CLI.
- GitHub Actions: lint+test+typecheck → deploy Vercel (web) → build APK firmado (mobile) en tags.
- Android: primera distribución por APK directo + Play Store interna track; release pública al final de la beta.
- Observabilidad: Sentry (web+móvil), logs de Edge Functions, dashboard de coste IA (tabla `ai_usage` → vista en panel admin).

## 9. Coste de infraestructura estimado (MVP, 1 ciudad)

| Servicio | Plan | $/mes |
|---|---|---|
| Supabase | Pro | 25 |
| Vercel | Pro | 20 |
| MapTiler | Free → Essential | 0–25 |
| Claude API | según doc 03 §5 | 40–600 |
| FCM / Resend / Sentry / PostHog | free tiers | 0–30 |
| Play Store | one-off | 25 único |
| **Total arranque** | | **~$90–150/mes** + IA variable |
