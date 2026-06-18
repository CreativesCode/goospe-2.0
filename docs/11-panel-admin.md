# 11 · Panel de Administración (Goospe Admin)

> Backoffice para el equipo Goospe: visión total del piloto, gestión de lugares,
> usuarios, reclamos, moderación y **gastos de IA** (tokens + monto).
> Estado: 🔲 pendiente · 🟡 en curso · ✅ hecho.

---

## 0. Credenciales del admin (ya creado)

| Campo | Valor |
|-------|-------|
| Email | `admin@goospe.cl` |
| Password | `GoospeAdmin2026!` |
| Rol | `profiles.is_admin = true` |

> Creado directo en `auth.users` + `auth.identities` + `profiles` (bcrypt vía pgcrypto).
> El demo (`demo@goospe.cl`) también es admin; este es el admin "limpio" del backoffice.
> **Cambiar la contraseña tras el primer login** (Perfil → o vía Supabase Auth).

---

## 1. Objetivo

Un único usuario (o equipo) con `is_admin` puede:

1. **Dashboard general** — KPIs del piloto de un vistazo.
2. **Lugares** — ver, **crear** y **editar TODOS** los lugares (no solo los propios).
3. **Usuarios** — lista de registrados, su actividad y rol.
4. **Reclamos** — qué lugares están reclamados y **qué usuario** los tiene.
5. **Gastos de IA** — tokens y monto (USD) gastados por feature, modelo, usuario, negocio y en el tiempo; detalle fila a fila.
6. **Estadísticas de lugares** — métricas agregadas (vistas, guardados, cómo llego, etc.) globales y por lugar.
7. **Moderación** — fotos y contenido (ya existe en `/admin/photos` y `/admin/content`; se integra al panel).

---

## 2. Arquitectura

### Rutas (bajo `/admin`) — **segmentos en inglés** (consistencia del backoffice)
```
/admin                 → Dashboard general (KPIs + accesos)
/admin/places          → Lista + buscador + filtros de TODOS los lugares
/admin/places/new      → Crear lugar
/admin/places/[id]     → Editar lugar (ficha completa, publicar/ocultar, categorías, coordenadas)
/admin/users           → Usuarios registrados + actividad
/admin/claims          → Lugares reclamados ↔ dueño (+ acción des-reclamar)
/admin/ai-costs        → Gastos de IA (resúmenes + detalle)
/admin/stats           → Métricas globales de lugares
/admin/photos          → Moderación de fotos
/admin/content         → Moderación de reseñas/eventos
```
> Nota: las etiquetas visibles siguen en español; sólo las URLs son inglés.

### Guard y layout
- **Guard**: `src/app/admin/layout.tsx` (server) → `requireUser()` + `isAdmin(user.id)`; si no, `redirect('/feed')`. Cubre todas las subrutas con un solo check.
- **Layout admin**: `AppNav` arriba + **sub-nav lateral/superior de admin** (Dashboard · Lugares · Usuarios · Reclamos · Gastos IA · Estadísticas · Moderación). Componente nuevo `AdminNav` (reusa tokens claro/oscuro + Lucide).
- Las páginas actuales `/admin/photos` y `/admin/content` migran su "tab switch" a este `AdminNav`.

### Acceso a datos (seguridad)
Todo el panel lee/escribe con el **admin client (service role)** en Server Components y Server Actions, **siempre** detrás del guard `isAdmin`. Para queries pesadas/repetidas se crean **RPC `SECURITY DEFINER`** que validan `is_admin` internamente (defensa en profundidad) y devuelven agregados ya calculados. No se relaja RLS de ninguna tabla.

---

## 3. Modelo de datos disponible (verificado)

| Tabla | Uso en el panel |
|-------|-----------------|
| `places` (213) | Lugares: CRUD, publicar/ocultar, fuente, reclamado |
| `place_stats` (213) | Agregados por lugar (saves, rating, reviews_count) |
| `place_photos` (590) | Fotos + estado de moderación |
| `place_categories` / `categories` | Categorización |
| `interactions` (36) | Eventos de comportamiento (view_card, view_detail, save, directions, share, rsvp, concierge_pick…) |
| `profiles` (1) | Usuarios (display_name, is_admin, onboarding) |
| `auth.users` | Email, alta, último login |
| `businesses` / `business_members` / `claims` | Reclamos (negocio ↔ usuario ↔ lugar) |
| `ai_usage` (436) | **Gastos de IA**: `feature, model, input_tokens, output_tokens, cached_tokens, cost_usd, user_id, business_id, created_at` |
| `reviews` (1) / `events` (1) | Moderación |
| `favorites` (1) / `event_rsvps` | Actividad de usuario |
| `boosts` / `business_reports` / `notifications` | Secundarios |

### `ai_usage` — estado actual (referencia)
- Features registradas hoy: `enrich_text` (218, ~0.405 USD), `enrich_embed` (218, ~0.002 USD).
- El código ya inserta también: `menu_vision`, y debería cubrirse `concierge`, `weekly_report`, `promo`, `review_reply` (verificar que **todas** las llamadas IA escriban en `ai_usage`; ver Fase 5).

---

## 4. Pantallas (detalle de cada una)

### 4.1 Dashboard general `/admin`
Tarjetas KPI (con comparativa 7d donde aplique):
- Lugares totales / publicados / con foto / reclamados.
- Usuarios registrados (+ nuevos 7d).
- Interacciones totales por tipo (mini barras).
- **Gasto IA total (USD) + tokens totales** (in/out/cached) + gasto últimos 7/30 días.
- Reseñas y eventos pendientes de moderar (badges con enlace).
- Top 5 lugares por interacciones.

### 4.2 Lugares `/admin/places`
- Tabla/grid con buscador (nombre), filtros (publicado/oculto, con/sin foto, reclamado, categoría).
- Columnas: nombre, categoría, estado, #fotos, rating, saves, dueño (si reclamado).
- Acciones rápidas: publicar/ocultar, ir a editar, ver ficha pública.
- **Crear** (`/admin/places/new`) y **Editar** (`/admin/places/[id]`): formulario completo (nombre, slug, descripción, vibe, contacto, precio, tags, categorías, coordenadas, publicar). Reusar/extender `ListingForm` o crear `AdminPlaceForm` (incluye campos que el dueño no controla: slug, is_published, categorías, lat/lng).
- Gestión de fotos del lugar (aprobar/rechazar/eliminar inline).

### 4.3 Usuarios `/admin/users`
- Lista: email, nombre, alta, último acceso, is_admin, #guardados, #reseñas, #RSVPs, negocios que administra.
- Detalle por usuario (opcional fase 2): su actividad y gasto IA atribuido.
- Acción: marcar/desmarcar admin (con confirmación).

### 4.4 Reclamos `/admin/claims`
- Lista de lugares reclamados ↔ **usuario dueño** (email) ↔ negocio ↔ fecha del claim/estado.
- Acción **des-reclamar** (revierte `claims`/`business_members`/`places.business_id`/`claimed` y borra el `business` huérfano — misma lógica que ya ejecutamos a mano).
- (Opcional) aprobar/rechazar claims si se reactiva la revisión manual.

### 4.5 Gastos de IA `/admin/ai-costs`  ⭐ (pedido explícito)
- **Resumen**: gasto total USD, tokens in/out/cached totales, nº de llamadas; selector de rango (hoy / 7d / 30d / todo).
- **Por feature**: tabla `feature → llamadas, in_tok, out_tok, cached_tok, USD` (orden por USD).
- **Por modelo**: `model → llamadas, tokens, USD`.
- **Por usuario / negocio**: quién consume IA.
- **Serie temporal**: gasto por día (gráfico simple de barras).
- **Detalle**: tabla paginada de `ai_usage` (fecha, feature, modelo, tokens, USD, usuario/negocio).
- RPC sugerida: `admin_ai_costs(p_from timestamptz, p_to timestamptz)` `SECURITY DEFINER` que valida `is_admin` y devuelve los agregados; el detalle se lee directo con admin client.

### 4.6 Estadísticas de lugares `/admin/stats`
- Globales: interacciones por tipo (totales y 7/30d), funnel (view_card → view_detail → save/directions/share), nº conserje_pick.
- Ranking de lugares por cada métrica.
- Por lugar: enlace al detalle con su desglose (reusar `place_metrics`).

### 4.7 Moderación (existente)
- `/admin/photos` y `/admin/content` ya funcionan; se integran al `AdminNav` y al dashboard (badges de pendientes).

---

## 5. Fases de implementación

**Fase A — Cimientos** ✅ **HECHA**
- ✅ `src/app/admin/layout.tsx` con guard `isAdmin` (cubre todo `/admin/*`; no-admin → `/feed`).
- ✅ `AdminNav` (`features/admin/AdminNav.tsx`): sidebar en `lg:`, tabs con scroll en móvil.
- ✅ `/admin` Dashboard: KPIs (lugares/publicados/con foto, usuarios +7d, gasto IA, interacciones), pendientes de moderación, gasto IA 7/30/total, interacciones por tipo, top 5 lugares.
- ✅ `/admin/photos` y `/admin/content` integrados al layout (sin AppNav/footer propios; nav vía `AdminNav`).
- ✅ Placeholders para Lugares/Usuarios/Reclamos/Estadísticas (no 404).

**Fase B — Gastos de IA** ✅ **HECHA** (prioridad del usuario)
- ✅ Auditoría: **todas** las llamadas IA registran en `ai_usage` — `enrich_text`, `enrich_embed`, `menu_vision`, `concierge`, `weekly_report`, `promo`, `review_reply`. Sin huecos.
- ✅ `/admin/ai-costs`: selector de rango (7/30/Todo), KPIs (costo total, tokens in/out/cache, llamadas, costo/llamada), **costo por día** (barras CSS), desgloses **por feature / modelo / usuario** (barras), y **tabla de detalle** (últimas 60 filas: fecha, feature, modelo, in/out, USD, usuario).
- Nota: agregación en server con admin client detrás del guard (datos pequeños); RPC `admin_ai_costs` queda como optimización futura si el volumen crece.
- ✅ Build de producción verde con todas las rutas `/admin`.

**Fase C — Lugares (CRUD total)** ✅ **HECHA**
- ✅ `/admin/places` (lista + buscador por nombre + filtros estado/categoría + toggle publicar inline + dueño si reclamado).
- ✅ `/admin/places/new` y `/admin/places/[id]`: `AdminPlaceForm` con TODOS los campos (nombre, slug, descripción, vibe, contacto, precio, tags, **categorías**, **coordenadas lat/lng**, publicar).
- ✅ RPC `admin_save_place` SECURITY DEFINER (upsert atómico: geografía vía `ST_MakePoint` + reemplazo de `place_categories`); `execute` revocado a anon/authenticated, sólo `service_role`.
- ✅ Server actions `actions/admin-places.ts`: `saveAdminPlace` (slug único auto), `setPublished`. Guard `requireAdmin` (sesión + `is_admin`).

**Fase D — Usuarios y Reclamos** ✅ **HECHA**
- ✅ `/admin/users`: emails vía `auth.admin.listUsers` + perfil (rol admin, alta, último acceso) + actividad (guardados, reseñas, RSVPs, negocios).
- ✅ `/admin/claims`: lugares reclamados ↔ dueño ↔ fecha/estado del claim + **des-reclamar** (`actions/admin-claims.ts` → limpia claims/members, libera el place, borra negocio huérfano).

**Fase E — Estadísticas** ✅ **HECHA**
- ✅ `/admin/stats`: interacciones por tipo (total/30d/7d), embudo (feed → ficha → acciones) y ranking top 10 lugares por interacciones de valor.

**Fase F — Pulido** ✅ **HECHA**
- ✅ **Toggle admin** desde la tabla de usuarios (`actions/admin-users.ts` + `AdminToggle`, con confirmación; no te puedes auto-degradar).
- ✅ **Export CSV** con guard admin: `/admin/ai-costs/export` (todas las llamadas IA) y `/admin/users/export` (usuarios + actividad). Helper `lib/csv.ts` (RFC 4180 + BOM para Excel).
- ✅ **Paginación**: lista de lugares (50/pág) y tabla de detalle de gastos IA (60/pág), preservando filtros/rango.
- ✅ **Estado de carga**: `app/admin/loading.tsx` (skeleton para todo el backoffice) + estados vacíos en cada pantalla.

---

## 9. Estado final

**Panel de administración COMPLETO** — Fases A→F hechas. Build de producción verde con todas las rutas `/admin/*` en inglés. Acceso: `admin@goospe.cl` / `GoospeAdmin2026!`.

---

## 5.1 Convención de rutas (corrección)
Las rutas del backoffice usan **segmentos en inglés** (`places`, `users`, `claims`, `ai-costs`, `stats`, `photos`, `content`); las etiquetas de UI siguen en español. Las rutas públicas del producto (`/buscar`, `/eventos`, `/perfil`…) se mantienen en español a propósito.

---

## 6. Auditoría de instrumentación IA (pre-requisito de Fase B)

Revisar que cada llamada a `visionJson` / `chat` / `embed` inserte en `ai_usage` con `feature`, `model`, tokens y `cost_usd`. Features esperadas:
`enrich_text`, `enrich_embed`, `menu_vision`, `concierge`, `weekly_report` (reports), `promo` (ai-assist), `review_reply` (ai-assist).
Si alguna no registra, añadir el insert (patrón ya usado en `actions/menu.ts`).

---

## 7. Decisiones abiertas
- ¿`AdminNav` lateral (sidebar) o superior (tabs)? → propongo **sidebar en `lg:`**, tabs en móvil.
- ¿Gráficos con librería (recharts) o barras CSS propias? → empezar con **barras CSS** (cero deps) y evaluar.
- ¿Exportación CSV desde el inicio? → Fase F.
- Crear lugar: ¿generar slug auto desde el nombre? → sí, con verificación de unicidad.

---

## 8. Verificación por fase
- `tsc --noEmit` + `npm run build`.
- Login con `admin@goospe.cl` y recorrer cada pantalla en claro/oscuro.
- Confirmar que un usuario NO admin es redirigido fuera de `/admin/*`.
