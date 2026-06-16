-- 0002 — Esquema inicial (doc 05 §1)
-- Orden de creación reordenado vs. el doc para resolver dependencias de FK
-- (businesses antes de places; events antes de interactions). El contenido de
-- cada tabla es idéntico al doc 05, que sigue siendo la fuente de verdad.

-- ============ GEOGRAFÍA ============
create table cities (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text unique not null,
  region      text,
  country     text not null,
  center      geography(point) not null,
  timezone    text not null default 'America/Havana',
  is_active   boolean default false,
  created_at  timestamptz default now()
);

-- ============ TAXONOMÍA (doble capa OSM→propia) ============
create table categories (
  id        bigint generated always as identity primary key,
  parent_id bigint references categories(id),
  name      text not null,
  slug      text unique not null,
  emoji     text,
  enabled   boolean default true,
  sort      int default 0
);

create table category_mappings (
  osm_tag     text primary key,
  category_id bigint not null references categories(id)
);

-- ============ B2B (businesses primero: places lo referencia) ============
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand_voice text,
  plan        text not null default 'free',     -- free | impulso | pro | elite
  stripe_customer_id text,
  created_at  timestamptz default now()
);

-- ============ LUGARES ============
create table places (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  city_id       bigint not null references cities(id),
  location      geography(point) not null,
  address       jsonb,
  phone         text, whatsapp text, website text, instagram text, email text,
  hours         jsonb,
  price_level   smallint check (price_level between 1 and 4),
  description   text,
  vibe_line     text,
  tags          text[] default '{}',
  ai_enriched_at timestamptz,
  embedding     vector(1024),
  source        text not null default 'osm',     -- osm | manual | owner
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
  author_id uuid references auth.users(id),
  status    text default 'approved',             -- pending | approved | rejected
  created_at timestamptz default now()
);

create table place_stats (
  place_id     uuid primary key references places(id) on delete cascade,
  rating       numeric(3,2) default 0,
  votes_1 int default 0, votes_2 int default 0, votes_3 int default 0,
  votes_4 int default 0, votes_5 int default 0,
  reviews_count int default 0,
  saves_count   int default 0,
  views_30d     int default 0,
  trending_score numeric default 0
);

-- ============ USUARIOS ============
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  home_city_id  bigint references cities(id),
  birth_year    int,
  onboarding    jsonb,
  is_admin      boolean default false,
  created_at    timestamptz default now()
);

create table taste_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  summary     text,
  embedding   vector(1024),
  cat_affinity jsonb default '{}',
  updated_at  timestamptz default now()
);

create table devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  fcm_token   text,
  platform    text default 'android',
  last_seen   timestamptz default now()
);

-- ============ EVENTOS (antes de interactions: lo referencia) ============
create table events (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places(id) on delete cascade,
  business_id uuid references businesses(id),
  name        text not null,
  description text,
  image_url   text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  status      text default 'pending',             -- pending | approved | rejected | canceled
  is_boosted  boolean default false,
  created_at  timestamptz default now(),
  unique (place_id, starts_at)
);

create table event_rsvps (
  user_id  uuid references auth.users(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status   text not null default 'going',         -- going | interested
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- ============ COMPORTAMIENTO ============
create table interactions (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id),
  device_id  uuid references devices(id),
  place_id   uuid references places(id),
  event_id   uuid references events(id),
  kind       text not null,    -- view_card | view_detail | save | unsave | dismiss
                               -- | directions | call | share | rsvp | concierge_pick
  context    jsonb,
  created_at timestamptz default now()
);
create index on interactions (place_id, kind, created_at);
create index on interactions (user_id, created_at);

-- ============ RESEÑAS ============
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  place_id   uuid not null references places(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 500),
  status     text default 'pending',               -- pending | approved | blocked
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, place_id)
);

create table favorites (
  user_id  uuid references auth.users(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);

-- ============ B2B (resto) ============
create table business_members (
  business_id uuid references businesses(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text default 'owner',                 -- owner | staff
  primary key (business_id, user_id)
);

create table claims (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places(id),
  user_id     uuid not null references auth.users(id),
  method      text,                                 -- phone | photo | manual
  evidence    jsonb,
  status      text default 'pending',               -- pending | approved | rejected
  created_at  timestamptz default now()
);

create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id),
  plan          text not null,
  status        text not null,                       -- active | past_due | canceled
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

create table business_reports (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  period_start date, period_end date,
  kind        text default 'weekly',                 -- weekly | competitive
  content     jsonb,
  created_at  timestamptz default now()
);

-- ============ IA / OPERACIÓN ============
create table ai_usage (
  id          bigint generated always as identity primary key,
  feature     text not null,
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

create table moderation_queue (
  id          uuid primary key default gen_random_uuid(),
  object_type text not null, object_id uuid not null,
  ai_verdict  text,                                  -- ok | flagged | blocked
  ai_reason   text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at  timestamptz default now()
);

create table audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid, action text, object_type text, object_id text,
  payload    jsonb, ip inet,
  created_at timestamptz default now()
);

create table feed_config (
  key text primary key, value jsonb
);
