# 10 — Plan de implementación del rediseño

> Origen: mockups de **Claude Design** en `docs/design/*.dc.html` (6 archivos: Mobile/Tablet/Web × Claro/Oscuro).
> Objetivo: llevar esos diseños al app real (Next.js 16 + Tailwind) con **iconos Lucide**, **modo claro/oscuro** y **responsive mobile · tablet · web**.
> Inventario de vistas de referencia: [`docs/design/VISTAS.md`](design/VISTAS.md).

---

## 1. Diagnóstico (estado actual vs. diseño)

| Aspecto | Hoy en código | En los mockups | Acción |
|---|---|---|---|
| **Iconos** | **Emojis** en 29 archivos (`✨ 🧭 📍 ★ ❤ 📅 ☕ 🍽 …`) → "se ven raros" | SVG inline a mano | **Migrar todo a `lucide-react`** |
| **Tema** | Sin dark mode. `globals.css` solo define 4 tokens verdes | Claro (papel cálido) + Oscuro (negro cálido) completos | Añadir `darkMode:'class'` + tokens de superficie |
| **Tokens** | Solo `goospe.green/-light/-dark/gray` | Paleta completa papel + negro cálido | Extender `tailwind.config.ts` |
| **Responsive** | Páginas sueltas, sin layout maestro-detalle | Mobile (deck), Tablet (master-detail), Web (landing + columnas) | Layouts por breakpoint |
| **Vistas** | 24 rutas existen pero con estilo legacy | 24 frames rediseñados | Re-skin pantalla por pantalla |

El esqueleto de rutas/lógica **ya existe** (43 `.tsx`). Esto es un **re-skin**, no una reescritura: cambiamos presentación (markup + clases + iconos), no la lógica de datos.

---

## 2. Tokens de diseño (extraídos de los mockups)

### Claro — "papel cálido"
| Token | Valor | Uso |
|---|---|---|
| `bg` | `#E5E1D8` (radial `#EFEBE2 → #E5E1D8 → #DED9CE`) | Fondo app |
| `paper` | `#FBF9F5` | Superficie de pantalla |
| `card` | `#FFFFFF` | Tarjetas |
| `border` | `#ECE7DE` | Bordes/divisores |
| `text` | `#1C1C1A` | Texto principal |
| `text-soft` | `#636363` | Texto secundario (`goospe.gray`) |
| `muted` | `#9A968D` | Labels/uppercase |

### Oscuro — "negro cálido"
| Token | Valor | Uso |
|---|---|---|
| `bg` | `#131210` | Fondo app / superficie |
| `card` | `#201C17` | Tarjetas |
| `border` | `#2E2A24` | Bordes/divisores |
| `text` | `#F3EFE8` | Texto principal |
| `muted` | `#8A8278` | Texto secundario |
| `black-deep` | `#121311` / `#0e0e0c` | Feed inmersivo / marco device |

### Marca (ya existen, se conservan)
`green #2dc186` · gradiente `#28af79 → #27f1a0` · `green-dark #28af79`.
Tipografía **Roboto** (300/400/500/700) — ya cargada vía `var(--font-roboto)`.

> Nota: el **Feed** es negro inmersivo en **ambos** temas (es una decisión de diseño, no del tema).

---

## 3. Estrategia de tema (claro/oscuro)

1. `tailwind.config.ts` → `darkMode: 'class'`.
2. Tokens como **CSS vars semánticas** en `globals.css` (`--bg`, `--card`, `--border`, `--text`, `--muted`) con override en `.dark`. Tailwind las mapea: `bg-surface`, `text-fg`, `border-line`, etc.
3. Clase `dark` en `<html>` controlada por un `ThemeProvider` (Zustand + `localStorage`, respeta `prefers-color-scheme` inicial). Toggle vive en **Perfil** y en el menú de cuenta.
4. Capacitor: fijar el color de la status bar por tema.

Patrón de clases: `bg-surface text-fg` + variantes `dark:` solo donde el token semántico no alcance.

---

## 4. Iconos: migración a Lucide

```bash
npm i lucide-react
```

Regla: **cero emojis en UI**. Tamaño base `size={20}`, `strokeWidth={1.75}` (combina con Roboto Light + estética minimalista). Color por `currentColor`.

### Mapa emoji → Lucide (inventario real del código)
| Emoji | Contexto | Lucide |
|---|---|---|
| ✨ | IA / Decídeme / Conserje / "sugiere" | `Sparkles` |
| 🧭 | Conserje / navegación | `Compass` |
| 📍 | Ubicación / lugar | `MapPin` |
| ★ ⭐ | Rating | `Star` (fill para activo) |
| ❤ 🤍 💕 | Guardar / favorito | `Heart` |
| 📅 | Eventos / fecha | `Calendar` |
| 🕒 | Horario / "abierto ahora" | `Clock` |
| 🔍 | Buscar | `Search` |
| ☕ | Café | `Coffee` |
| 🍽 | Comer | `Utensils` |
| 🍸 | Bares / noche | `Martini` (o `Wine`) |
| 🧘 | Tranquilo / ambiente | `Flower2` |
| 🌲 | Aire libre / Puerto Varas | `Trees` |
| 📷 | Fotos / subir | `Camera` |
| 📤 | Compartir | `Share2` |
| 🔔 | Notificaciones | `Bell` |
| 📲 | Instalar PWA / push | `Smartphone` |
| 🎫 🎟 | RSVP / entradas | `Ticket` |
| 🎉 | Evento / boost | `PartyPopper` |
| 📊 | Estadísticas | `BarChart3` |
| 🏪 | Negocio / panel | `Store` |
| 🛡 | Moderación / admin | `ShieldCheck` |
| 👁 | Vistas / preview | `Eye` |
| 📬 📷→correo | Revisa tu correo | `MailCheck` |
| 💻 | Web / B2B | `Monitor` |
| 🌙 | Tema oscuro | `Moon` / `Sun` |
| ✓ ✅ | Confirmación / éxito | `Check` / `CheckCircle2` |
| ❌ ✕ 🚫 | Cerrar / rechazar | `X` / `Ban` |
| ← → | Navegación | `ArrowLeft` / `ArrowRight` |
| 👩👨👧 | "¿con quién?" onboarding | `Users` / `User` |

Crear `src/shared/components/Icon` opcional como wrapper, o importar Lucide directo. Recomendado: importar directo (tree-shaking) y centralizar solo los **mapas categoría→icono** (categorías de lugar, ambientes) en `src/shared/lib/icons.ts` para no repetir el switch.

---

## 5. Estrategia responsive

| Breakpoint | Tailwind | Layout (de los mockups) |
|---|---|---|
| **Mobile** `<768px` | base | Deck/stack a pantalla completa, bottom-nav, feed inmersivo. Fuente de verdad: `Goospe Mobile*.dc.html` (24 vistas) |
| **Tablet** `≥768px` | `md:` | **Maestro-detalle**: lista a la izquierda, detalle a la derecha (Feed, Buscar, Ficha, Panel, Admin). `Goospe Tablet*.dc.html` |
| **Web** `≥1024px` | `lg:` | Landing completa + nav superior pill + grillas multi-columna. `Goospe Web*.dc.html` |

Construir cada pantalla mobile-first y agregar `md:`/`lg:` para reflujo. Navegación: bottom-nav en mobile → sidebar/topbar pill en tablet/web.

---

## 6. Mapeo vistas ↔ rutas ↔ frame de diseño

(24 frames están en `Goospe Mobile.dc.html`; ver `VISTAS.md` para el detalle por sección.)

| # | Vista | Ruta / componente | Notas de re-skin |
|---|---|---|---|
| 01 | Splash | layout/boot | Flip isotipo + barra sync (negro/gradiente) |
| 02 | Onboarding | `/onboarding` | Chips: gusto/ambiente/presupuesto |
| 03 | Welcome/Landing | `/` `page.tsx` | "¿Dónde voy hoy?" + CTAs; Web = landing full |
| 04-07 | Login·Signup·Recuperar·Nueva·Revisa correo | `(auth)/*` | Card sobre gradiente |
| 08 | Feed | `/feed` | **Negro inmersivo** (ambos temas) |
| 09 | Buscar/filtros | `/buscar` | Input + chips + "abierto ahora" + grid |
| 10-11 | Ficha + detalle | `/places/[slug]` | Header+vibe+meta+acciones; secciones carta/mapa/eventos/reseñas |
| 12 | Reseñas | `features/reviews/PlaceReviews` | Estrellas (`Star`) + form |
| 13 | Decídeme/Conserje | `/concierge` | 3 planes + streaming, `Sparkles` |
| 14 | Hoy/Eventos | `/eventos` | Cartelera + RSVP (`Ticket`) |
| 15 | Guardados | `/saved` | Grid + estado vacío |
| 16 | Perfil | AccountMenu/perfil | Stats + menú + **toggle de tema** + gancho B2B |
| 17-23 | Panel B2B | `/panel/*` + `features/business/*` | Mis lugares, reclamar, editar, stats, informe IA, boost, carta IA, eventos IA, responder reseñas |
| 24-25 | Moderación fotos/contenido | `/admin/*` | Colas aprobar/rechazar (`Check`/`X`) |

Estados transversales: vacíos (guardados, panel, eventos, fotos), carga (feed splash, conserje "pensando"), dropdown de cuenta.

---

## 7. Plan por fases

> Cada fase: re-skin + reemplazo de emojis por Lucide + soporte claro/oscuro + responsive de esas vistas. Verificar con Playwright (claro y oscuro) antes de pasar de fase.

**Fase 0 — Fundaciones** ✅ **TERMINADA** *(bloqueante)*
- ✅ `npm i lucide-react`.
- ✅ `darkMode:'class'` + tokens semánticos en `tailwind.config.ts` y `globals.css` (claro/oscuro, vars `--surface/--card/--line/--fg/--fg-soft/--muted`).
- ✅ `ThemeProvider` + `ThemeToggle` + persistencia (`localStorage` + script anti-flash en `<head>`).
- ✅ `src/shared/lib/icons.ts` (mapas like/vibe/categoría → Lucide), `src/shared/lib/ui.ts` (`fieldClass`, `primaryBtn`) y primitivo `Chip`.

**Fase 1 — Entrada y Auth** ✅ **TERMINADA** (vistas 02-07)
- ✅ Welcome/Landing (`/`), Onboarding (`/onboarding` → fondo papel + chips Lucide), Login, Signup, Recuperar, Nueva contraseña, Revisa correo (todos con tokens semánticos + Lucide, sin emojis).
- ⏳ **Splash**: no existe ruta; el boot se maneja nativo (Capacitor) o como overlay futuro. Diferido.
- ↪ `AccountMenu` (menú de cuenta) queda para **Fase 3 — Perfil**.

**Fase 2 — Descubrir** ✅ **TERMINADA** (vistas 08-12)
- ✅ Feed (`/feed`): negro cálido inmersivo `#121311`, acciones laterales (Heart con fill, Compass, Share2, Ban), badges y meta con Lucide (Sparkles, Star, categoría dinámica vía `categoryIcon`). También `EventFeedCard` (Calendar, Ticket/Check, Compass, MapPin).
- ✅ Buscar (`/buscar`): input con icono Search, chips de categoría con Lucide, "abierto ahora" con Clock, grid de resultados con tokens semánticos + Star/MapPin.
- ✅ Ficha (`/places/[slug]`): tokens semánticos en todo (header, datos, carta, mapa, meta, eventos), categorías con `categoryIcon`, borrar foto con `X`, "cómo llegar" con `Compass`. Incl. `PhotoUpload` (Camera) y `RsvpButton` (Check).
- ✅ Reseñas (`PlaceReviews`): estrellas `Star` (fill activo) en display e input interactivo, tarjetas con tokens.
- ✅ `tsc --noEmit` limpio · 0 emojis en las vistas tocadas.

**Fase 3 — Decidir y Tu Goospe** ✅ **TERMINADA** (vistas 13-16)
- ✅ Conserje (`/concierge`): sobre gradiente (constante en ambos temas), botón "Decidir" con `Sparkles`, "cómo llego" con `Compass`.
- ✅ Eventos (`/eventos`): tokens semánticos, back con `ArrowLeft`, RSVP con `Check`.
- ✅ Guardados (`/saved`): header con `Heart`, estado vacío con `Heart` en círculo, placeholders con `categoryIcon`, tokens semánticos.
- ✅ Perfil / `AccountMenu`: dropdown re-skineado (bg-card, items con Lucide: Heart/Store/Calendar/Sparkles/ShieldCheck/LogOut) + **fila de toggle de tema** (Sun/Moon) que cumple "toggle de tema en Perfil". `Notifications` con `Bell` + toast en tokens.
- ✅ **Página de Perfil dedicada (`/perfil`)** — frame 16: avatar/inicial + nombre, **stats** (guardados/reseñas/eventos vía counts a `favorites`/`reviews`/`event_rsvps`), **perfil de gusto** (chips de likes/vibes con `taste()` de icons.ts + presupuesto), menú de accesos, **gancho B2B** (→ /panel) y `ThemeToggle` en el header. Enlazada desde `AccountMenu` ("Mi perfil"). Build OK.
- ✅ `tsc --noEmit` limpio · sin emojis de UI.

**Fase 4 — B2B Panel** ✅ **TERMINADA** (vistas 17-23)
- ✅ Páginas: Mis lugares (`/panel`, estado vacío con `Store`, `Plus`, `ArrowRight`), Reclamar (`/panel/reclamar`), Editar ficha (`/panel/[placeId]`) — todas con tokens semánticos + logo por tema + back `ArrowLeft`.
- ✅ Componentes `features/business/`: `StatsPanel` (6 métricas con iconos Lucide: Eye/Smartphone/Heart/Compass/Share2/Sparkles + Star), `WeeklyReport` (`BarChart3`), `BoostControl` (`Sparkles`), `MenuUpload` (`Camera`), `EventManager` (`Sparkles`/`Plus` + asistente IA), `ReviewReplies` (`Star`/`Sparkles`/`Check`), `ListingForm` (tokens + `Check`).
- ✅ `tsc --noEmit` limpio · sin emojis.

**Fase 5 — Admin** ✅ **TERMINADA** (vistas 24-25)
- ✅ Moderación de fotos (`/admin/fotos`): estado vacío con `CheckCircle2`, `ModerationActions` con `Check`/`X`, tokens semánticos.
- ✅ Moderación de contenido (`/admin/contenido`): reseñas con `Star`, badges visible/oculto, `ModStatusButtons` con hover dark-safe, tokens.
- ✅ Bonus: página de validación `/places` también migrada (tokens + `categoryIcon` + `ArrowLeft`/`ArrowRight`).
- ✅ **0 emojis** en todo `src/**/*.tsx`.

**Responsive web/landing** ✅ **HECHO**
- ✅ Landing (`/`) enriquecida según `Goospe Web.dc.html`: hero a lo ancho (h1 hasta `lg:text-7xl`), grid de features `sm:grid-cols-3`, **"Cómo funciona"** (3 pasos), **highlight del Conserje** (`lg:grid-cols-2`) y **cierre B2B** — todo con tokens claro/oscuro.
- ✅ Resto de páginas de contenido ya escalan en desktop: grids `sm/lg/xl:grid-cols-*` (buscar, places, saved, panel) y contenedores centrados `max-w-*` (ficha, panel, admin).
- ✅ Build de producción OK (18 rutas) · `tsc --noEmit` limpio.

**Tablet maestro-detalle** ✅ **HECHO (Panel)**
- ✅ Panel (`/panel/[placeId]`): en `lg:` muestra **barra lateral "Mis lugares"** (lista de los lugares del dueño, el actual resaltado) + el **detalle** (stats, informe, boost, ficha, carta, eventos, reseñas) a la derecha — maestro-detalle fiel al `Goospe Tablet.dc.html`. En móvil sigue el índice `/panel` (lista) → detalle. Build OK.
- ⏳ Feed maestro-detalle (hero grande + columna "A continuación" en `lg:`): el mockup lo plantea, pero forka la interacción del deck snap-scroll (página más compleja). Queda como mejora opcional separada; hoy el deck inmersivo funciona a lo ancho en tablet/web.
- ~~Status bar de Capacitor por tema~~ — **N/A**: Capacitor aún no está instalado en el proyecto.

---

## 8. Verificación

- `npm run typecheck` + `npm run lint` por fase.
- Playwright: screenshot de cada vista en **claro y oscuro**, comparar contra `docs/design/*.dc.html`.
- Checklist de cierre: **0 emojis** en UI (`grep` de rango emoji = vacío), todas las vistas re-skineadas, toggle de tema persistente, tablet/web reflujo correcto.

---

## 9. Decisiones abiertas (confirmar antes de Fase 1)
1. ¿Toggle de tema manual **o** seguir siempre el sistema? (plan asume manual + default sistema).
2. Onboarding: ¿"¿con quién?" (variante v1) o el real de 3 grupos de chips? (`VISTAS.md` §1.3).
3. ¿Wrapper `<Icon/>` central o import directo de Lucide? (plan recomienda directo).
