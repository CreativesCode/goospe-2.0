---
name: rediseno-audaz
description: Estado del rediseño visual (variante audaz) del handoff de Claude Design y qué quedó sin revisar
type: project
---

Rediseño visual aplicado el 2026-10-13 a partir de `docs/design/design_handoff_goospe_rediseno/`
(variante **audaz**; "pulido" no se implementa). Sin commit ni push al cerrar la sesión: el
usuario decide cuándo sube.

Convenciones que introdujo (respetarlas en pantallas nuevas):
- Breakpoints Tailwind: `md` = 720 px (tablet), `lg` = 1100 px (web); 900 px con `min-[900px]:`.
- Texto verde sobre fondo claro: `text-ink`. Texto sobre verde o degradado: `text-on-brand`.
  `text-goospe-green` queda para iconos y rellenos.
- Tokens nuevos: `tint`, `tint2`, `deep`, `deep-soft`, `ph`, `bg-goospe-deep`; helpers en
  `src/shared/lib/ui.ts` (`appContainer` 1320 px, `pageTitle`, `eyebrow`, `pill`).
- Sin foto: `PhotoImg` con `tone="tint"` (tarjetas) o `tone="deep"` (mazo, portada).
- En móvil el pie no se muestra; la cuenta vive en la pestaña Perfil (cerrar sesión, ayuda).

Revisado en navegador (390 / 820 / 1440, claro y oscuro parcial): landing, feed, ficha, buscar,
cartelera vacía, acceso, onboarding, perfil, Decídeme sin lanzar consulta, índice del panel.

Revisado además el 2026-10-19 (390 / 1440): pantallas que se habían quedado con el estilo
antiguo y ya están pasadas al rediseño: reclamar y proponer lugar (columna `deep` `ClaimSteps`),
enviar comentarios, notificaciones, cuenta, mi actividad, editar perfil, índice de ciudades,
listados por ciudad y páginas institucionales (`LegalPage`). Encabezado común en
`src/shared/components/page-header.tsx` y contenedor `pageShell` en `src/shared/lib/ui.ts`:
usarlos en toda pantalla nueva.

Backoffice `/admin/*` pasado al rediseño el 2026-10-19 (sin revisar en navegador: hace falta sesión
de admin): lateral agrupado (Operación, Bandejas, Moderación, Métricas, Ajustes) como el panel del
dueño, chips en móvil, `adminTitle` y `adminChip` en `src/features/admin/ui.ts`, botones verdes
planos. Sigue con estilo antiguo solo la tarjeta de `/unsubscribe`.

Sin revisar en navegador:
- Panel de un lugar (`/panel/[placeId]`, secciones por `?tab=`): solo el dueño real tiene acceso.
- Cartelera agrupada por día: no había eventos próximos.
- `npm run build` no se ejecutó.

Qué se hizo, por pantalla: navegación (barra superior en píldoras, barra inferior móvil con
Decídeme al centro, pie compacto solo en web), feed (mazo con snap en móvil y en web con panel
lateral; desaparece el layout propio de tablet), ficha (portada a sangre + columna de datos fija),
buscar (filtros laterales), Decídeme (chips "con quién" y "presupuesto" que viajan al conserje,
"Otras 3 opciones" que excluye las ya vistas, y `?q=` desde el landing que lanza la consulta),
cartelera por día, guardados con chips, perfil en dos columnas, panel de negocio con lateral y
secciones por `?tab=` más un Resumen nuevo, acceso en pantalla partida, onboarding y landing.

Decisiones del agente **confirmadas por el usuario el 2026-10-19** (también revisó los resultados de Decídeme):
- "Paso" sigue descartando el lugar (con deshacer); el diseño solo saltaba a la siguiente.
- "Por qué te sugerimos" se arma con datos del lugar, sin IA (`src/features/feed/feed-why.ts`).
- La cartelera perdió la fila de chips por ciudad; queda el selector.
- Los resultados de ejemplo del conserje en el landing usan nombres inventados, sin fotos.
- Los deltas del panel comparan 7 días contra los 7 anteriores; sin base dicen "nuevo".

Pendiente de código detectado y no hecho: la acción `signup` ignora `?next=` (se pierde al crear
cuenta); `src/features/business/completeness.ts` no tiene test.

Lista para que el usuario lo revise: `docs/16-revision-local.md`, sección 0.
