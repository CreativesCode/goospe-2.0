# 05 — Modelo de Datos (Supabase / PostgreSQL)

> Esquema **nuevo, diseñado desde cero** para el producto nuevo (feed + conserje + B2B). Del dominio del proyecto antiguo se toman solo los *conceptos* que demostraron funcionar (agregados por trigger, taxonomía propia con mapeo OSM, evento único por lugar/fecha) — ver tabla §4. Extensiones requeridas: `postgis`, `vector` (pgvector), `pg_trgm`, `unaccent`, `pg_cron`.

---

## 1. Esquema SQL (migración inicial)

```sql
-- ============ GEOGRAFÍA ============
create table cities (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text unique not null,
  region      text,
  country     text not null,
  center      geography(point) not null,
  timezone    text not null default 'America/Havana',
  is_active   boolean default false,          -- ciudades "abiertas" en la app
  created_at  timestamptz default now()
);

-- ============ TAXONOMÍA (herencia v1: doble capa OSM→propia) ============
create table categories (                      -- taxonomía propia, jerárquica
  id        bigint generated always as identity primary key,
  parent_id bigint references categories(id),
  name      text not null,
  slug      text unique not null,
  emoji     text,
  enabled   boolean default true,
  sort      int default 0
);

create table category_mappings (               -- tag OSM → categoría propia
  osm_tag     text primary key,                -- ej. 'amenity=restaurant'
  category_id bigint not null references categories(id)
);

-- ============ LUGARES ============
create table places (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  city_id       bigint not null references cities(id),
  location      geography(point) not null,
  address       jsonb,                         -- {street, number, unit, village, formatted}
  phone         text, whatsapp text, website text, instagram text, email text,
  hours         jsonb,                         -- {mon:[["09:00","23:00"]], ...}
  price_level   smallint check (price_level between 1 and 4),
  -- contenido enriquecido por IA:
  description   text,
  vibe_line     text,                          -- 1 línea para la card del feed
  tags          text[] default '{}',
  ai_enriched_at timestamptz,
  embedding     vector(1024),
  -- estado:
  source        text not null default 'osm',   -- osm | manual | owner
  claimed       boolean default false,
  business_id   uuid references businesses(id),
  is_published  boolean default true,
  cover_url     text, logo_url text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on places using gist(location);
create index on places using hnsw (embedding vector_cosine_ops);
create index on places using gin (name gin_trgm_ops);
create index on places (city_id, is_published);

create table place_categories (
  place_id    uuid references places(id) on delete cascade,
  category_id bigint references categories(id),
  primary key (place_id, category_id)
);

create table place_photos (
  id        uuid primary key default gen_random_uuid(),
  place_id  uuid not null references places(id) on delete cascade,
  url       text not null,
  author_id uuid references auth.users(id),    -- null = del negocio/sistema
  status    text default 'approved',           -- pending | approved | rejected
  created_at timestamptz default now()
);

-- estadísticas agregadas (herencia PlaceStatistics v1; se actualizan por trigger)
create table place_stats (
  place_id     uuid primary key references places(id) on delete cascade,
  rating       numeric(3,2) default 0,
  votes_1 int default 0, votes_2 int default 0, votes_3 int default 0,
  votes_4 int default 0, votes_5 int default 0,
  reviews_count int default 0,
  saves_count   int default 0,
  views_30d     int default 0,
  trending_score numeric default 0             -- rating ponderado últimos 30d (cron)
);

-- ============ USUARIOS ============
create table profiles (                        -- 1:1 con auth.users
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  home_city_id  bigint references cities(id),
  birth_year    int,
  onboarding    jsonb,                         -- las ≤3 respuestas iniciales
  is_admin      boolean default false,
  created_at    timestamptz default now()
);

create table taste_profiles (                  -- generado por IA, no editado a mano
  user_id     uuid primary key references auth.users(id) on delete cascade,
  summary     text,                            -- legible, lo ve el conserje
  embedding   vector(1024),
  cat_affinity jsonb default '{}',             -- {"bares":0.8,"cafes":0.3,...}
  updated_at  timestamptz default now()
);

create table devices (                         -- push + perfil anónimo pre-registro
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  fcm_token   text,
  platform    text default 'android',
  last_seen   timestamptz default now()
);

-- ============ COMPORTAMIENTO (alimenta ranking + analítica B2B) ============
create table interactions (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id),
  device_id  uuid references devices(id),
  place_id   uuid references places(id),
  event_id   uuid references events(id),
  kind       text not null,    -- view_card | view_detail | save | unsave | dismiss
                               -- | directions | call | share | rsvp | concierge_pick
  context    jsonb,            -- {hour, dow, lat, lng, feed_position}
  created_at timestamptz default now()
);
create index on interactions (place_id, kind, created_at);
create index on interactions (user_id, created_at);

-- ============ RESEÑAS (Rank+Comment v1 unificados) ============
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  place_id   uuid not null references places(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 500),
  status     text default 'pending',           -- pending | approved | blocked (IA modera)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, place_id)                   -- v2: una reseña viva por usuario/lugar,
);                                             -- editable; el trigger recalcula stats

create table favorites (
  user_id  uuid references auth.users(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);

-- ============ EVENTOS ============
create table events (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places(id) on delete cascade,
  business_id uuid references businesses(id),
  name        text not null,
  description text,
  image_url   text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  status      text default 'pending',          -- pending | approved | rejected | canceled
  is_boosted  boolean default false,
  created_at  timestamptz default now(),
  unique (place_id, starts_at)                 -- herencia v1
);

create table event_rsvps (
  user_id  uuid references auth.users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status   text not null default 'going',      -- going | interested
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- ============ B2B ============
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand_voice text,                            -- tono para la IA ("cercano, juvenil…")
  plan        text not null default 'free',    -- free | impulso | pro | elite
  stripe_customer_id text,
  created_at  timestamptz default now()
);

create table business_members (
  business_id uuid references businesses(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text default 'owner',            -- owner | staff
  primary key (business_id, user_id)
);

create table claims (                          -- flujo de reclamar ficha
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places(id),
  user_id     uuid not null references auth.users(id),
  method      text,                            -- phone | photo | manual
  evidence    jsonb,
  status      text default 'pending',          -- pending | approved | rejected
  created_at  timestamptz default now()
);

create table subscriptions (                   -- espejo de Stripe vía webhook
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id),
  plan          text not null,
  status        text not null,                 -- active | past_due | canceled
  current_period_end timestamptz,
  stripe_sub_id text unique
);

create table boosts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  place_id    uuid references places(id),
  event_id    uuid references events(id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  amount_usd  numeric(8,2),
  status      text default 'active'
);

create table business_reports (                -- informes semanales IA
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  period_start date, period_end date,
  kind        text default 'weekly',           -- weekly | competitive
  content     jsonb,                           -- structured output del LLM
  created_at  timestamptz default now()
);

-- ============ IA / OPERACIÓN ============
create table ai_usage (
  id          bigint generated always as identity primary key,
  feature     text not null,                   -- enrich | concierge | report | ...
  model       text not null,
  input_tokens int, output_tokens int, cached_tokens int,
  cost_usd    numeric(10,6),
  user_id     uuid, business_id uuid,
  created_at  timestamptz default now()
);

create table concierge_quota (
  user_id uuid primary key references auth.users(id),
  month   date not null,
  used    int default 0
);

create table moderation_queue (                -- herencia ReviewAssignment v1
  id          uuid primary key default gen_random_uuid(),
  object_type text not null, object_id uuid not null,
  ai_verdict  text,                            -- ok | flagged | blocked
  ai_reason   text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at  timestamptz default now()
);

create table audit_log (                       -- herencia Trace v1
  id         bigint generated always as identity primary key,
  user_id    uuid, action text, object_type text, object_id text,
  payload    jsonb, ip inet,
  created_at timestamptz default now()
);

create table feed_config (                     -- pesos del ranking sin deploy
  key text primary key, value jsonb
);
```

---

## 2. Triggers y jobs

| Mecanismo | Qué hace | Herencia v1 |
|---|---|---|
| Trigger en `reviews` (insert/update aprobado) | recalcula `place_stats` (distribución 1–5 + promedio) | `Rank.save()` + `PlaceStatistics.update_ranking()` |
| Trigger en `favorites` / `interactions(save)` | `place_stats.saves_count` | `add_favorite()` |
| pg_cron diario | `trending_score` (rating de reviews ≤30 días, mínimo de votos bayesiano) + `views_30d` | `trending_ranking` |
| pg_cron semanal (dom 03:00) | encola batch: perfiles de gusto + informes semanales de negocios de pago | `update_users_suggestions` + `SummaryEmailCronJob` |
| Trigger en `places` (insert con source='osm') | encola enriquecimiento IA + embedding | nuevo |
| Webhook Stripe → `subscriptions` + `businesses.plan` | sincroniza plan | nuevo |

## 3. RLS — resumen de políticas

| Tabla | select | insert/update |
|---|---|---|
| places, events(approved), place_stats, categories | público | solo service role / owner del negocio (campos limitados) |
| reviews | público si `status='approved'`; propias siempre | propia fila (`auth.uid() = user_id`); rating editable |
| favorites, event_rsvps, interactions, concierge_quota | propias | propias |
| taste_profiles | propia | solo service role (la escribe la IA) |
| businesses, business_reports, boosts, subscriptions | miembros (`business_members`) | miembros con role owner; subscriptions solo service |
| claims | propias + admin | insert propio; update solo admin |
| moderation_queue, audit_log, ai_usage, feed_config | admin | service role |

## 4. Inspiración tomada del dominio antiguo (conceptos, no código ni datos)

| Concepto en el proyecto antiguo (Django) | En el esquema nuevo (Supabase) | Cambio |
|---|---|---|
| Place + Address + PlaceStatistics | places (address jsonb) + place_stats | dirección desnormalizada; PostGIS |
| GonetCategory / OSMCategory | categories + category_mappings | OSM ya no es entidad, solo mapeo en ETL |
| Rank + Comment (separados, 1/30 días) | reviews (unificado, editable) | UX moderna; el trigger conserva la integridad de stats |
| Suggestion.expected_rank (kNN) | taste_profiles.embedding + RPC de feed | embeddings sustituyen al kNN |
| 16 tablas de atributos de usuario | profiles.onboarding jsonb + señales | se eliminan los formularios |
| Event + Participation | events + event_rsvps | igual + boost |
| Place.user_owner | businesses + business_members + claims | multi-local y multi-usuario desde el día 1 |
| HomeDelivery / TakeawayFood | tags + hours en places (MVP) | se simplifica; volverá como módulo si hay demanda |
| Trace / ReviewAssignment | audit_log / moderation_queue | igual concepto, IA pre-filtra |
| Command queue (Android sync) | — | eliminado: online-first con caché |
