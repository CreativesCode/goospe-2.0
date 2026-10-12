# PRP-002: Ideas del legacy (`setup-2026`) + cierre de brechas, por fases desplegables

> **Estado**: PENDIENTE
> **Fecha**: 2026-10-12
> **Proyecto**: goospe-2.0
> **Insumo**: `docs/15-analisis-brechas-y-qa.md` (foto de estado al 12-oct-2026). Los códigos
> S#, F#, P# y §4.x de este PRP remiten a ese documento; no se repiten aquí.

---

## Objetivo

Llevar Goospe 2.0 de "construido de punta a punta pero no publicable" a un producto lanzable y
vendible a dueños de negocio: cerrar las brechas reales de seguridad, funcionamiento, datos e
ingeniería del doc 15, y traer del legacy `setup-2026` las **ideas** que valen (el "panel de
inteligencia para dueños": series temporales, informes programados, alertas, respuesta a
reseñas, notificaciones), reimplementadas sobre el stack actual. Cada fase se despliega sola y
deja la app en mejor estado que antes.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hay fallos de seguridad confirmados; el endurecimiento ya está en código (commit `87e2b31`) pero falta confirmar que quedó aplicado y cerrar lo que no cubrió. | Fase 1: verificar despliegue de 0033/0034, cerrar S14 y los hallazgos "vistos solo en código". |
| Lo que el usuario ve está roto o degradado: ninguna foto de Google carga, botones del feed móvil no responden, el admin no puede guardar fichas, el feed se corta en 40. | Fase 2: F1–F17, P1–P8 y menores. |
| Sin tests, sin lint, sin CI, y la base de datos no se reconstruye desde el repo. Cada fase siguiente es una apuesta. | Fase 3: red de seguridad de ingeniería antes de construir features. |
| El 70% de los lugares no tiene descripción ni embedding (invisibles para el conserje); 19% con horario; zonas activas vacías. | Fase 4: calidad de datos con presupuesto de IA acotado. |
| El dueño solo edita una parte de su ficha, ve contadores a 7/30 días y la respuesta a reseñas se queda en el portapapeles. El legacy demostró que esa capa B2B es lo que se vende. | Fases 5 y 6: panel completo + analítica, emails e informes programados. |
| El lado usuario no retiene: feed finito, eventos sin página propia, perfil de solo lectura, búsqueda solo por nombre. | Fase 7. |
| No existe forma de cobrar; el legacy tampoco la tuvo (pasarela stub). | Fase 8, condicionada al OK del equipo. |

**Valor de negocio**: desbloquea el lanzamiento público (hoy bloqueado por seguridad y fotos),
convierte el panel del dueño en algo por lo que se puede cobrar Impulso/Pro/Élite (doc 03), y
permite medir la métrica norte y D30 en vez de suponerlas.

## Qué

### Criterios de Éxito
- [ ] Los 14 hallazgos S1–S14 y los "vistos solo en código" dan negativo al repetir las pruebas del doc 15 contra el entorno desplegado (no solo en desarrollo).
- [ ] Los 17 F y los 8 P quedan cerrados o explícitamente descartados con motivo; el QA del doc 15 repetido baja de 49 fallos a 0 fallos de severidad alta.
- [ ] CI en cada push: tipos, lint, build y smoke e2e en verde; `hours` y `profanity` con tests unitarios; la base se reconstruye desde `supabase/migrations` sin pasos manuales y `database.types.ts` no necesita `as never`.
- [ ] Al menos 90% de los lugares publicados en zonas activas tiene descripción y embedding; ninguna zona activa tiene 0 lugares o 0 enriquecidos; "abierto ahora" usa la zona horaria de la ciudad.
- [ ] Un dueño puede, sin ayuda: editar toda su ficha (incluidos horario, fotos y portada), responder públicamente una reseña, ver sus estadísticas como serie temporal y recibir por email su informe semanal sin pulsar nada.
- [ ] Un usuario puede hacer scroll más allá de 40 lugares, cambiar de ciudad, abrir y compartir la página de un evento, llamar/escribir por WhatsApp desde la ficha, editar su perfil y eliminar su cuenta.
- [ ] Cada fase se desplegó por separado y pasó su validación antes de empezar la siguiente.
- [ ] (Fase 8, si se aprueba) Un dueño paga un plan, `businesses.plan` se sincroniza por webhook y los gates se verifican en servidor.

### Comportamiento Esperado

**Usuario**: abre el feed en su ciudad → ve fotos reales, "abierto ahora" correcto y eventos
intercalados → hace scroll sin tope → guarda, comparte o descarta desde cualquier tamaño de
pantalla → entra a una ficha y llama o escribe por WhatsApp → se apunta a un evento desde su
página propia → recibe aviso cuando un lugar guardado publica algo.

**Dueño**: reclama su lugar → recibe email al aprobarse (o el motivo si se rechaza) → completa
toda la ficha → ve cuánta gente lo vio, guardó, pidió ruta y llamó, por día → responde reseñas
con sello de dueño → recibe alerta ante una reseña crítica y, cada semana, su informe por email
→ si quiere más alcance o más IA, paga un plan (Fase 8).

**Equipo**: cada cambio pasa por CI; cada acción de admin queda en auditoría; el gasto de IA
tiene presupuesto con corte; los errores de producción llegan a un monitor.

---

## Contexto

### Hallazgos de la investigación que cambian el plan

- **El legacy no está en este repo.** `origin/setup-2026` pertenece al repo `Goospe`, que no
  está clonado junto a este proyecto. Todo lo aprovechable ya está destilado en el doc 15 §4;
  el doc concluye que **no hay código reutilizable** (Python/Django, scikit-learn, grafos). Se
  traen ideas y reglas de negocio, no archivos. No copiar secretos (doc 15 §4.9).
- **La Ola 0 del doc 15 ya está mayormente hecha en código** (commit `87e2b31`, mismo día):
  `src/proxy.ts`, `requireAdmin()` en cada página y export de `/admin`, migración
  `0033_security_hardening.sql` (grants por columna en `profiles`/`businesses`, vista
  `public_profiles`, revoke de funciones internas, trigger de reseñas, tabla `rate_limits`,
  `search_path` de `admin_save_place`), rate limit + Zod en las 4 rutas `/api`, `safe-next`,
  cabeceras de seguridad, `listing-schema.ts`. **No verificado**: que 0033 y 0034 estén
  aplicadas en la base real y en el orden que exige el encabezado de 0033 (0033 → deploy →
  0034). No se pudo consultar la base en esta sesión.
- **Sigue pendiente de la Ola 0**: S14 (configuración de Supabase Auth), y parte de los
  "vistos solo en código" (`suggestReviewReply`, `reverseGeocodeZone`).
- **Siguen abiertos, comprobado en código**: feed fijo en `p_limit: 40, p_offset: 0`
  (`use-feed.ts:131`); `America/Santiago` por defecto en `hours.ts:122`; `revalidate = 3600`
  en la ficha sin revalidación desde las acciones del dueño; no existe `/auth/callback`; no hay
  `eslint.config.*` y `npm run lint` sigue apuntando a `next lint`; el único workflow es el
  keepalive; siguen `features/dashboard` y `(main)/dashboard`; hay dos migraciones `0030`.
- **Tablas que ya existen sin uso** y se aprovechan en vez de crear otras: `audit_log`,
  `moderation_queue`, `feed_config`, `subscriptions`, `devices`.

### Referencias
- `docs/15-analisis-brechas-y-qa.md` — fuente de todas las brechas y del orden sugerido (§5).
- `docs/03-modelo-de-negocio-y-planes.md` — planes Free / Impulso $19 / Pro $49 / Élite $99 y cuotas de IA por plan.
- `docs/04-arquitectura-tecnica.md` — Resend, Sentry y PostHog ya previstos.
- `docs/11-panel-admin.md`, `docs/13-capacitor-appflow.md`, `docs/14-expansion-zonas.md`.
- `supabase/migrations/0033_security_hardening.sql` — contrato con el código y consultas de verificación al final del archivo.
- `src/lib/admin-guard.ts`, `src/lib/rate-limit.ts`, `src/lib/validation.ts`, `src/features/business/listing-schema.ts` — patrones de guard, rate limit y Zod a seguir en todas las acciones.
- `src/actions/*.ts` — server actions por dominio (patrón vigente; no hay `services/` por feature).
- `src/app/panel/[placeId]/page.tsx` + `src/features/business/*` — panel del dueño actual.
- `src/features/feed/use-feed.ts`, `supabase/migrations/0012/0014/0016/0020` — feed y ranking.
- `src/lib/hours.ts`, `src/lib/profanity.ts` — lógica pura sin tests, con bugs F8 y F11.
- `etl/*` + skill `load-zone` — pipeline de datos (local-only, gasta).
- Skills de la fábrica a usar por fase: `supabase`, `add-emails`, `add-payments`, `add-mobile`, `playwright-cli`.

### Arquitectura Propuesta (Feature-First)

Se respeta lo que hay: server actions en `src/actions/`, UI en `src/features/<dominio>/`,
utilidades en `src/lib/`. Solo se añade lo nuevo:

```
src/features/
├── business/            # existente: se amplía (ficha completa, respuesta a reseña, voz de marca)
├── analytics/           # NUEVO: series temporales y gráficos del dueño, rendimiento de boost
├── events/              # existente: se amplía (detalle, edición/cancelación, cartelera)
├── notifications/       # existente: más tipos, enlace de destino, historial
├── profile/             # NUEVO: perfil editable, mi actividad, eliminar cuenta
├── feedback/            # NUEVO: feedback y "sugerir corrección" + bandeja admin
└── billing/             # NUEVO (Fase 8): checkout, estado del plan, gates

src/app/
├── auth/callback/       # NUEVO: confirmación de email y recuperación de contraseña
├── events/[id]/         # NUEVO: detalle de evento compartible
├── [ciudad]/[categoria] # NUEVO: listados SEO por ciudad y categoría (ruta exacta a definir en la fase)
└── api/cron/            # NUEVO: tareas programadas que necesitan Node (emails, informes)

src/emails/              # NUEVO: plantillas React Email
tests/                   # NUEVO: unitarios (hours, profanity) y smoke e2e
.github/workflows/ci.yml # NUEVO
eslint.config.mjs        # NUEVO
```

Decisiones de arquitectura:

1. **Ideas del legacy, no código.** La analítica avanzada (sentimiento, demografía,
   competitivo) se resuelve con SQL + pgvector + el LLM ya integrado, no con scikit-learn.
2. **Agregados en SQL, no en el cliente.** Las series temporales salen de RPC sobre
   `interactions` con acceso solo service-role tras validar propiedad (mismo contrato que 0033).
3. **Programación en dos carriles.** Lo que es solo SQL sigue en `pg_cron`; lo que envía emails
   o llama a la IA va por rutas `/api/cron/*` protegidas con secreto.
4. **Todo cambio de datos pasa por el servidor**: Zod + guard de propiedad/admin + rate limit +
   escritura en `audit_log` para acciones de admin.
5. **Zona horaria por ciudad** como dato (`cities.timezone`), nunca constante en código.
6. **Monetización al final y aislada**: los gates por plan se construyen de modo que funcionen
   con `businesses.plan` asignado a mano antes de que exista la pasarela.

### Modelo de Datos

Dirección de los cambios; el SQL exacto se define al entrar a cada fase tras leer el estado real
de la base (hay drift). Toda tabla nueva lleva RLS activa y, por el default ACL de Supabase,
`revoke` explícito a `anon`/`authenticated` en lo que no deban tocar.

```sql
-- Fase 2
--   interactions.event_id  → on delete set null (P1)
--   admin_save_place       → versionada en el repo, sin city_id = 1 fijo (F2)
--   boosts                 → lectura pública de los activos vía get_feed (P3)
--   cities.timezone        → corregir default y backfill por coordenadas

-- Fase 3
--   renumerar el 0030 duplicado; versionar assign_nearest_city y admin_save_place;
--   reconciliar el historial de migraciones; regenerar database.types.ts

-- Fase 5
ALTER TABLE reviews ADD COLUMN owner_reply TEXT, ADD COLUMN owner_replied_at TIMESTAMPTZ;
ALTER TABLE claims  ADD COLUMN reject_reason TEXT, ADD COLUMN resolved_at TIMESTAMPTZ,
                    ADD COLUMN resolved_by UUID;
ALTER TABLE notifications ADD COLUMN kind TEXT, ADD COLUMN link TEXT;   -- si no existen ya
CREATE TABLE place_proposals (...);        -- lugar nuevo propuesto por un dueño
-- RPC place_metrics_series(place_id, desde, hasta, granularidad) — solo service_role
-- nuevos kinds en interactions: whatsapp, email (call ya existe y no se emite)

-- Fase 6
CREATE TABLE email_log (...);              -- registro de envíos
CREATE TABLE email_preferences (...);      -- bajas por tipo de email
-- business_reports: marcar origen (manual | programado) y fecha de envío

-- Fase 7
CREATE TABLE feedback (...);               -- feedback general y correcciones de lugar
ALTER TABLE event_rsvps ...;               -- distinguir "me interesa" de "asistiré"
-- get_feed: lee pesos desde feed_config; paginación real

-- Fase 8
--   subscriptions: adaptar columnas al proveedor elegido (hoy nombradas stripe_*)
ALTER TABLE boosts ADD COLUMN ...;         -- pago, impresiones, clics
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo FASES. Las subtareas se generan al entrar a cada fase con el bucle agéntico
> (mapear contexto → generar subtareas → ejecutar). Cada fase termina en un despliegue.

### Fase 1: Seguridad verificada en producción
**Objetivo**: Confirmar que el endurecimiento del commit `87e2b31` está aplicado de verdad
(0033 → deploy → 0034) y cerrar lo que no cubrió: S14 y los hallazgos vistos solo en código.
Al terminar, la app es segura de publicar.
**Validación**: Las consultas de verificación del final de 0033 dan lo esperado contra la base
real; las pruebas S1–S14 del doc 15 repetidas contra el build de producción dan negativo; los
advisors de seguridad de Supabase no reportan nada nuevo salvo la vista `public_profiles`.

### Fase 2: Que lo que hay funcione
**Objetivo**: Cerrar F1–F17, P1–P8 y los menores de §3.2–§3.4: fotos de Google visibles y sin
degradar en silencio, botones del feed móvil, admin que guarda fichas, ficha que solo muestra
fotos aprobadas, feed y listados paginados, horas de evento correctas, boost visible para todos.
**Validación**: Repetir el QA del doc 15 en móvil, tablet y desktop: cero fallos en las filas
F y P. Con un evento futuro creado, probar lo que quedó sin probar (RSVP por interfaz, card de
evento en el feed, notificación con contenido).

### Fase 3: Red de seguridad de ingeniería
**Objetivo**: Lint funcionando, CI en cada push, tests unitarios de `hours` y `profanity`, smoke
e2e de los flujos principales, migraciones reproducibles, tipos regenerados, scaffolding muerto
eliminado, monitoreo de errores y entorno de staging con variables documentadas.
**Validación**: Un push rompe el CI si falla tipos, lint, build o smoke; una base vacía se
levanta solo con las migraciones del repo; no queda ningún `as never` por tipos desactualizados;
un error forzado en staging aparece en el monitor.

### Fase 4: Calidad de datos
**Objetivo**: Enriquecer la cola larga (con on-demand al primer view), subir cobertura de
horarios y estado de negocio, deduplicar al importar, resolver las 1.613 fotos Mapillary
pendientes, desactivar zonas vacías, "abierto ahora" en cards y ficha con la zona de cada
ciudad, y presupuesto de IA con corte.
**Validación**: Las métricas de la tabla §2.1 del doc 15 recalculadas cumplen el criterio de
éxito (≥90% con descripción y embedding en zonas activas, ninguna zona activa vacía); el gasto
de IA de la fase queda dentro del tope aprobado antes de empezar.

### Fase 5: Panel del dueño completo
**Objetivo**: Todo §4.3 y lo esencial de §4.4: edición completa de ficha y fotos propias,
respuesta pública a reseñas, editor de voz de marca, editar/cancelar eventos avisando a
inscritos, proponer un lugar nuevo, un negocio con varios lugares, "mis solicitudes",
estadísticas como serie temporal con gráficos, métricas que faltan (llamadas/WhatsApp, RSVP,
reseñas y fotos por periodo), rendimiento del boost y notificaciones in-app al dueño. Incluye
auditoría de acciones de admin y motivo obligatorio al rechazar un reclamo.
**Validación**: Recorrido e2e con una cuenta de dueño: reclamar → aprobar → editar cada campo y
verlo en la ficha pública al instante → responder una reseña y verla con sello → ver la serie
temporal cuadrar con `interactions`. Un dueño no puede leer ni escribir datos de un lugar ajeno.

### Fase 6: Emails e informes programados
**Objetivo**: Infraestructura de email (remitente propio, plantillas, baja, registro de
envíos), callback de auth con emails propios, aviso de reclamo aprobado/rechazado y aviso al
equipo, informe semanal automático por email, resumen periódico de números sin IA, alerta ante
reseña crítica y tareas programadas de mantenimiento (vencimientos, poda de telemetría).
**Validación**: Registro, confirmación y recuperación de contraseña completan la sesión con
emails propios; un dueño de prueba recibe el informe semanal sin intervención y puede darse de
baja; cada envío queda en el registro; las tareas programadas dejan rastro de ejecución.

### Fase 7: Lado usuario
**Objetivo**: §4.6: feed con scroll infinito y cambio manual de ciudad, ranking con pesos en
`feed_config`, página de evento compartible, cartelera Hoy/Esta semana por ciudad, contacto
accionable con métrica, lugares relacionados, perfil editable con "mi actividad", aceptación de
términos y eliminación de cuenta, notificaciones con más tipos e historial, aviso a quienes
guardaron un lugar, feedback y "sugerir corrección", búsqueda más allá del nombre con estado en
la URL, listados SEO por ciudad y categoría, login con Google, páginas institucionales y 404
propio. Analítica de producto para medir D30 y la métrica norte.
**Validación**: Smoke e2e ampliado con estos flujos en los tres tamaños de pantalla; el sitemap
incluye todos los lugares publicados; `/places` deja de pesar megas; D30 y la métrica norte se
pueden leer en un panel.

### Fase 8: Monetización (requiere OK explícito del equipo)
**Objetivo**: Pasarela de pago con checkout y webhook que sincroniza `businesses.plan`, gates y
cuotas por plan verificados en servidor, ciclo de vida de la suscripción (estados, gracia,
renovación, emails) y boost de pago con tope de 1 cada 8 cards y etiqueta "Patrocinado".
**Validación**: Compra de prueba de punta a punta en modo sandbox; un plan vencido pierde sus
gates tras la gracia; ningún gate se puede saltar llamando la acción directamente; el feed nunca
muestra más de 1 patrocinado cada 8.

### Fase 9: Validación final
**Objetivo**: Sistema funcionando end-to-end y doc de estado al día.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] CI en verde, smoke e2e completo
- [ ] QA del doc 15 repetido entero contra producción, con capturas Playwright
- [ ] Criterios de éxito cumplidos
- [ ] `docs/09-estado-implementacion.md` reemplazado por una foto de estado actual

**Fuera de este PRP** (PRP propio cuando toque): móvil nativo y push (§4.8), y analítica
avanzada — sentimiento por reseña, demografía con umbral de anonimato, catálogo de informes,
competitivo y clustering — que el doc 15 difiere hasta tener volumen de interacciones.
**Descartado**: todo §4.9.

---

## Decisiones que necesita el equipo antes de aprobar

1. **Pagos**: ¿se activa la Fase 8 y con qué proveedor? La fábrica trae Polar por defecto; los
   docs 03/04 y el esquema (`stripe_customer_id`, `stripe_sub_id`) asumen Stripe.
2. **España**: ¿las 13 ciudades siguen activas o se concentra en Chile? Define cuánto se gasta
   en la Fase 4 (Granada sola tiene 1.485 lugares con 62 enriquecidos).
3. **Fotos Mapillary**: aprobar en bloque, moderar con IA o descartar las 1.613 pendientes.
4. **Reclamos**: ¿la verificación sigue siendo manual?
5. **Presupuesto de IA** para la Fase 4 (tope en USD).
6. **Facturación de Google Cloud**: reactivarla es una acción de cuenta del equipo y bloquea F1.
7. **Moderación de reseñas**: 0034 las deja en `pending` si entran por la API directa; confirmar
   que el piloto sigue con auto-aprobación vía servidor.

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-10-12 (Fase 2): `<form action>` borra los campos tras un error
- **Error**: React 19 reinicia los campos no controlados al terminar una acción; si el servidor devolvía un error se perdía lo escrito (P8, y también ficha y admin).
- **Fix**: enviar con `onSubmit` + `new FormData(e.currentTarget)` y limpiar el formulario solo si la acción tuvo éxito.
- **Aplicar en**: todo formulario con campos no controlados cuya acción pueda devolver un error.

### 2026-10-12 (Fase 2): `onError` de un `<img>` no salta si falló antes de hidratar
- **Error**: las fotos que ya venían rotas en el HTML del servidor nunca mostraban el placeholder.
- **Fix**: `useImgFallback` (`src/shared/components/photo-img.tsx`) revisa `complete && naturalWidth === 0` al montar.
- **Aplicar en**: cualquier `<img>` con fallback; usar `PhotoImg` / `useImgFallback`, no un `useState` suelto.

### 2026-10-12 (Fase 2): importar una constante de un módulo `'use client'` desde el servidor
- **Error**: en un server component llega una referencia de cliente, no el valor.
- **Fix**: las constantes compartidas entre servidor y cliente viven en un módulo sin `'use client'`.

### 2026-10-12 (Fase 2): cambiar el retorno de una función SQL
- **Error**: `create or replace` no admite cambiar columnas de `returns table`.
- **Fix**: `drop function if exists` + `create` en la misma transacción y **volver a dar los grants** (se pierden con el drop). Tras aplicar: `notify pgrst, 'reload schema'`.

---

## Gotchas

- [ ] **Orden de despliegue de seguridad**: 0033 primero, deploy inmediato, 0034 después. Al revés, el conserje anónimo responde 429 y las reseñas quedan invisibles.
- [ ] **Drift de base de datos**: no confiar en las migraciones del repo como fuente de verdad hasta terminar la Fase 3; leer siempre el estado real antes de escribir SQL.
- [ ] **Default ACL de Supabase**: todo objeto nuevo nace con ALL para `anon`/`authenticated`. Cada tabla, vista y función nueva necesita su `revoke` explícito (ver 0033).
- [ ] **PostGIS, pg_trgm, vector y unaccent viven en el schema `extensions`**: toda función que los use necesita `search_path = public, extensions`.
- [ ] **`is_admin()` es SECURITY DEFINER a propósito** (evita recursión en la policy de `profiles`); no revertir.
- [ ] **Aplicar SQL**: el MCP de Supabase no está autenticado; el camino vigente es la Management API con el token del CLI.
- [ ] **Dev server**: el usuario corre el suyo en :3000; no levantar otro. Las variables `NEXT_PUBLIC_*` requieren reinicio.
- [ ] **Auto-commit**: el repo commitea solo lo que está staged; un commit manual puede quedar en no-op.
- [ ] **Fotos de Google son display-only** (ToS): no descargar bytes ni borrar referencias por "rotas" mientras la facturación esté apagada.
- [ ] **El ETL es local-only y gasta**: la Fase 4 no puede correr desde Vercel; requiere las llaves del desarrollador y tope de gasto acordado.
- [ ] **Zona horaria**: producción corre en UTC. Todo `new Date()` sobre un `datetime-local` y todo formateador sin `timeZone` es un bug (P2).
- [ ] **`next lint` ya no existe en Next 16**: hace falta `eslint.config.mjs` y cambiar el script.
- [ ] **Topes de 1.000 filas** de la API de Supabase: cualquier listado o export grande debe paginar (F6, F13).
- [ ] **Secretos del legacy**: hay credenciales en claro en ese repo. No copiar nada; rotar lo que siga vivo.
- [ ] **Sin eventos futuros en la base**: crear datos de prueba antes de validar RSVP, cards de evento y notificaciones.

## Anti-Patrones

- NO portar código Python/Django del legacy ni su modelo de 23 planes; solo reglas e ideas.
- NO construir features nuevas (Fases 5+) antes de cerrar las Fases 1–3.
- NO poner guardas solo en la server action: lo que importa se refuerza en RLS, grants o trigger.
- NO consultar con service-role antes de validar sesión y propiedad.
- NO crear tablas nuevas si una existente sin uso sirve (`audit_log`, `moderation_queue`, `feed_config`, `subscriptions`).
- NO hardcodear ciudad, zona horaria ni `city_id`.
- NO tapar tipos desactualizados con `as never`; regenerar.
- NO degradar errores en silencio (el proxy de fotos es el ejemplo a no repetir).
- NO mostrar demografía sin umbral mínimo de anonimato.
- NO ignorar errores de TypeScript ni omitir Zod en inputs de usuario.

---

*PRP pendiente aprobación. No se ha modificado código.*
