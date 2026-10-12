# 15 — Análisis de brechas (legacy `setup-2026` + plan propio) y QA real

> Fecha de corte: **2026-10-12**. Insumo para el plan de implementación de lo que falta.
> Sustituye como foto de estado al doc 09 (desactualizado desde junio) y amplía el doc 01,
> que se escribió contra una versión vieja del legacy.

---

## 0. Cómo se hizo y qué límites tiene

- **Legacy.** El repo `Goospe` tenía la carpeta de trabajo en una rama de 2023. Lo recién
  descargado está en la rama remota **`origin/setup-2026`** (606 commits por delante de
  `develop`, ~33k líneas de Python frente a las ~10k que analizó el doc 01). Se leyó esa rama
  por subsistemas: dominio, IA y analítica, API, panel de dueños y suscripciones, web de
  usuario, admin e infra.
- **Goospe 2.0.** Lectura completa de código, migraciones y base de datos real (solo lectura).
- **Brechas.** Cada subsistema legacy y el plan propio (docs 02–14) se compararon contra el
  código actual; un segundo revisor intentó refutar cada brecha. Un barrido final enumeró
  rutas, modelos, crons y plantillas del legacy para detectar omisiones.
- **QA.** Pruebas en navegador real (Playwright) contra la app en desarrollo y la base real,
  en móvil, tablet y desktop. Cada fallo se reprodujo de forma independiente y se buscó su
  causa en el código.
- **Límites.**
  - Las pruebas corrieron en modo desarrollo. Sobre el build de producción solo se
    comprobó: que compila (1.025 páginas), que el proxy tampoco se registra, que
    `/admin/users` sin sesión responde 200 con los 5 emails, y que una ficha inexistente
    responde 200 en vez de 404.
  - No había eventos futuros en la base: RSVP por interfaz, cards de evento en el feed y
    notificaciones con contenido quedaron sin probar en la ronda principal.
  - No se leyó el material no técnico del legacy (presentación de negocio, modelo de negocio,
    colección Postman) ni el código Java de la APK.
  - Nadie auditó accesibilidad, consentimiento de cookies ni tratamiento de datos de menores.

---

## 1. Resumen ejecutivo

1. **El producto está construido de punta a punta, pero no es seguro publicarlo hoy.** Hay
   cuatro fallos de seguridad confirmados que se arreglan en horas y deben ir antes que
   cualquier feature (sección 3.1).
2. **Lo que el usuario ve está degradado por datos, no por código:** ninguna foto de Google
   carga (facturación desactivada en Google Cloud), el 70% de los lugares no tiene descripción
   ni embedding, y solo el 19% tiene horario.
3. **El legacy nuevo no aporta código reutilizable, pero sí valida el lado B2B.** Lo que
   construyeron en 2024 es un "panel de inteligencia para dueños": estadísticas por periodo,
   informes IA programados, sentimiento de reseñas, notificaciones al dueño y un motor de
   suscripciones. Goospe 2.0 tiene la base (telemetría, IA, panel) pero le falta casi toda esa
   capa. Las suscripciones del legacy **nunca cobraron**: la pasarela era un stub.
4. **De ~230 brechas brutas quedan unas 45 reales tras consolidar** (muchas se repetían entre
   subsistemas). Se agrupan en 9 temas en la sección 4.
5. **Sin red de seguridad de ingeniería:** no hay tests, el lint no funciona, no hay CI, y la
   base de datos no se puede reconstruir desde el repo.

---

## 2. Estado real de Goospe 2.0

### 2.1 Datos (12-oct-2026)

| Métrica | Valor |
|---|---|
| Ciudades | 28 (27 activas; 13 en España) |
| Lugares publicados | 3.706 |
| Con descripción y embedding | 1.114 (30%) |
| Con horario | 712 (19%) |
| Con precio | 1.100 (30%) |
| Con foto aprobada | 2.861 (77%), casi todas de Google |
| Fotos pendientes de moderar | 1.613 (Mapillary) |
| Con estado de negocio de Google | 16 (0,4%) |
| Usuarios / negocios reclamados | 5 / 1 |
| Reseñas / favoritos / eventos | 2 / 1 / 2 (ambos pasados) |
| Gasto IA acumulado | ~2,24 USD en ~2.380 llamadas |

- Nueva Braunau está activa con 0 lugares; Icod de los Vinos, activa con 81 lugares sin
  enriquecer ni fotos. Granada concentra 1.485 lugares con solo 62 enriquecidos.
- Los lugares sin embedding son invisibles para el conserje.
- Hay duplicados visibles en el catálogo (p. ej. varios "100 Montaditos" en Granada).
- Tablas sin ningún uso en código: `subscriptions`, `devices`, `moderation_queue`,
  `audit_log`, `feed_config`.

### 2.2 Ingeniería

- `tsc --noEmit` pasa limpio.
- **Lint roto:** `next lint` ya no existe en Next 16 y no hay `eslint.config`.
- **Cero tests** y sin CI.
- **Drift de base de datos:** el historial de la BD registra 8 migraciones con nombres que no
  coinciden con el repo; `admin_save_place` y `assign_nearest_city` existen en la BD y se usan
  en código, pero no tienen archivo SQL. Hay dos migraciones `0030`. `database.types.ts` está
  desactualizado y el código lo tapa con `as never`.
- Scaffolding muerto de la plantilla: `features/dashboard`, `features/.template`,
  `(main)/dashboard`, `places/[slug]/actions.ts` (contiene un `deletePhoto` sin autenticación
  que hoy nadie importa).

---

## 3. Resultado del QA

| Área | Pasa | Falla | Aviso | Sin probar |
|---|---|---|---|---|
| Público / anónimo | 34 | 15 | 20 | 3 |
| Usuario autenticado | 48 | 16 | 12 | 4 |
| Negocio y admin (ronda 1) | 27 | 4 | 13 | 9 |
| Seguridad y API | 26 | 14 | 16 | 1 |
| **Total** | **135** | **49** | **61** | **17** |

Todos los bugs listados abajo fueron confirmados por un segundo revisor. Esfuerzo: S = horas,
M = 1–3 días.

### 3.1 Seguridad — arreglar antes que nada

| # | Problema | Causa | Esf. |
|---|---|---|---|
| S1 | **Cualquier usuario puede hacerse admin** con un PATCH a su propio perfil | La policy `update own profile` (`0004_rls.sql:44`) no restringe columnas; `is_admin` vive en `profiles` | S |
| S2 | **Las páginas `/admin/*` entregan sus datos a visitantes sin sesión** (los 5 emails de usuarios en `/admin/users`) | El único guard está en `admin/layout.tsx`; cada página consulta con service-role antes de que el redirect surta efecto | S |
| S3 | **`proxy.ts` nunca se ejecuta**: sin redirecciones de rutas protegidas ni refresco de sesión en servidor | Está en la raíz del repo y la app vive en `src/`; Next lo busca en `src/proxy.ts` | S |
| S4 | **Funciones `admin_*` invocables por anónimos** (gasto IA, actividad por usuario, zonas de demanda); `assign_nearest_city` hace UPDATE masivo y también está abierta | Funciones `SECURITY DEFINER` sin `revoke ... from public` (0023, 0024, 0030); los revoke de 0031 y 0010 no surten efecto | S |
| S5 | `profiles` completa es legible sin sesión (`is_admin`, gustos, género, año de nacimiento) | Policy `read profiles using (true)` | S |
| S6 | El dueño puede cambiarse el plan a sí mismo | Policy `update own business` permite cualquier columna, incluida `plan` | S |
| S7 | Reseñas: se puede insertar por la API una reseña ya `approved`, saltando filtro y rate limit | Las guardas solo están en la server action; la policy solo exige `user_id = auth.uid()` | M |
| S8 | Conserje sin cuota ni rate limit para anónimos (gasto OpenAI abierto) | `api/concierge/route.ts:31-43` solo cuenta si hay usuario | M |
| S9 | Un anónimo puede agotar o reiniciar la cuota de conserje de otro usuario | `increment_concierge_quota` otorgada a `anon` (`0018:15`) | S |
| S10 | Open redirect en `?next=` del login | `actions/auth.ts:15` redirige sin validar | S |
| S11 | `/api/track` acepta cualquier cosa: sin validación, sin tope de tamaño (3 MB aceptados), responde `ok` aunque el insert falle | Sin Zod ni rate limit; inflar métricas B2B es trivial | M |
| S12 | `/api/search` y `/api/concierge` devuelven 500 con errores crudos de Postgres ante parámetros inválidos | Sin validación de tipos | S |
| S13 | Sin cabeceras de seguridad HTTP; `X-Powered-By` expuesto | `next.config.ts` no define `headers()` | S |
| S14 | Registro abierto con autoconfirmación de email y sin protección de contraseñas filtradas | Configuración de Supabase Auth | S |

Vistos solo en código (no ejecutados): `suggestReviewReply` no comprueba que la reseña sea del
lugar validado; `uploadPlacePhoto` sin límite de frecuencia y confiando en el tipo que declara
el cliente; `updateListing` guarda web/instagram/whatsapp sin validar; `reverseGeocodeZone` es
invocable sin sesión; `/api/place-photo` solo exige el prefijo `places/` (posible proxy abierto
cuando Google vuelva a responder).

### 3.2 Funcionalidad rota

| # | Problema | Causa | Esf. |
|---|---|---|---|
| F1 | **Ninguna foto de Google se muestra** (8.551 de 10.186 fotos); se ve el isotipo gigante recortado | Facturación desactivada en el proyecto de Google Cloud. Agravantes: el proxy degrada en silencio y redirige a un SVG válido, así que no salta el placeholder diseñado | S + acción de cuenta |
| F2 | **El admin no puede guardar ni crear fichas**: `type "geography" does not exist` | `admin_save_place` tiene `search_path = public` y PostGIS está en `extensions`; además inserta siempre con `city_id = 1` | S |
| F3 | **En el feed móvil "Compartir" y "Paso" no reciben toques** (40 de 40 cards) | El bloque de info tapa la columna de acciones (`feed-mobile.tsx:79,107`, mismo z-index) | S |
| F4 | La ficha pública muestra fotos no aprobadas (de usuarios y las Mapillary pendientes) | `places/[slug]/page.tsx` lee con service-role y no filtra por `approved` | S |
| F5 | El feed se corta en 40 lugares: no hay paginación | `use-feed.ts:131` siempre pide `limit 40, offset 0` | M |
| F6 | `/places` y el sitemap se truncan a 1.000 lugares; `/places` pesa 5 MB | Tope de filas de la API sin paginar | M |
| F7 | Tras cerrar sesión la interfaz sigue mostrando al usuario hasta recargar | El store de `useAuth` no se entera del signOut hecho en servidor | S |
| F8 | El filtro de groserías rechaza reseñas normales ("económico", "conocí", "computador") | `profanity.ts` busca subcadenas sobre texto sin espacios | S |
| F9 | Los guardados anónimos no se migran si el login aterriza en `/saved` | La migración solo vive en `useFavorites`, que `/saved` no monta | S |
| F10 | "Mis gustos" abre el onboarding vacío y guardar sobreescribe lo anterior (incluido el género) | `onboarding/page.tsx` nunca lee lo guardado | S |
| F11 | Horarios OSM con reglas separadas por coma se muestran y evalúan mal | `hours.ts` solo separa por `;` | S |
| F12 | Buscador: chip "Eventos" siempre vacío; el precio es un tope que incluye lugares sin precio; solo busca por nombre y es sensible a tildes ("cerveza" y "hamburguesa" dan 0) | `search/page.tsx:26-32` y RPC `search_places` | M |
| F13 | Admin · Gastos IA: el rango "Todo" muestra 30 días; el CSV se trunca a 1.000 filas (omite el 57% del gasto) | `ai-costs/page.tsx:30` y `export/route.ts` | S |
| F14 | Admin · Fotos: muestra 100 de 1.613 pendientes, sin paginación ni acción masiva | `admin/photos/page.tsx:15` | M |
| F15 | La ficha se desborda en móvil y tablet con URLs largas en "Web" | Falta `min-w-0` en `places/[slug]/page.tsx:94` | S |
| F16 | El rate limit de reseñas también bloquea editar una reseña propia | `actions/reviews.ts:29-35` | S |
| F17 | Recuperar contraseña y confirmar email probablemente no completan la sesión (no verificado en vivo) | No existe ruta `/auth/callback` | S |

Menores: cabecera del feed móvil partida en 2–3 líneas a 390–414 px (hora en formato 12 h);
panel de notificaciones tapado por los chips en móvil; pastilla "Destacado" en un lugar no
promocionado en desktop; 404 genérico en inglés y fichas inexistentes con status 200 (verificar
en producción); `og:image` con parámetro `w` duplicado; columna "Dueño" que nunca muestra el
nombre; paginación fuera de rango que muestra "0 lugares"; tabla de usuarios cortada; errores
de autenticación en inglés.

### 3.3 Cosas que funcionan pero están incompletas

- El feed no muestra "abierto ahora" en ninguna card; la ficha tampoco. Solo el buscador.
- Tablet y desktop nunca intercalan eventos; desktop solo permite guardar.
- La barrera de cobertura solo existe en el feed: desde Madrid el feed dice "aún no llegamos"
  pero el buscador y el conserje sí responden.
- `/events` y `/places` no filtran por ciudad pese al texto "cerca de ti".
- Zona horaria fija `America/Santiago` en "abierto ahora" y recordatorios, con 13 ciudades en
  España. `cities.timezone` tiene por defecto `America/Havana`.
- Teléfono, email y WhatsApp no son clicables; la métrica `call` nunca se emite.
- El perfil es de solo lectura; no hay "mis reseñas" ni eliminar cuenta.
- El reclamo: formulario sin validación; el solicitante no ve que tiene una solicitud pendiente.
- La landing enumera las 28 ciudades cuatro veces; el texto se pensó para una sola.
- El boost: sospecha por código de que "Destacado" nunca se ve en el feed (la RLS de `boosts`
  solo deja leer a miembros del negocio); sin tope 1/8 ni comprobación de boost ya activo.

### 3.4 Panel de negocio

Ronda dedicada: se aprobó un reclamo de prueba, se recorrió el panel completo y se des-reclamó.
Resultado: 17 pasan, 5 fallan, 4 avisos, 2 sin probar.

**Funciona:** aprobar reclamo, listar el lugar, editar ficha y verla reflejada, estadísticas,
crear evento y verlo en panel/cartelera/ficha, RSVP, generador de promo, respuesta sugerida a
reseña, informe semanal (queda guardado), activar y terminar boost, validación de tipo en la
subida de menú, y la autorización (un dueño no entra al panel de un lugar ajeno).

| # | Problema | Causa | Esf. |
|---|---|---|---|
| P1 | **Un evento que recibió un RSVP no se puede eliminar** (error crudo de clave foránea) | `interactions.event_id` sin `on delete` (`0002_schema.sql:158`); `actions/events.ts:83` borra directo | S |
| P2 | **La hora del evento depende de la zona del servidor**: se introduce 20:00 y el panel muestra 21:00; en producción (UTC) el desfase sería de 3–4 h. Provoca además un error de hidratación en cada carga del panel | `actions/events.ts:33` hace `new Date()` sobre un `datetime-local` sin zona; los formateadores no fijan `timeZone` | S |
| P3 | **El boost solo lo ve el propio dueño**: para anónimos y otros usuarios el lugar ni sube ni lleva "Destacado" | La policy de `boosts` limita la lectura a miembros y `get_feed` corre con la sesión del usuario | S |
| P4 | El servidor no valida la ficha: guarda URLs inválidas, `javascript:`, teléfono con letras; recorta etiquetas a 8 en silencio | `actions/business.ts:92-102` solo hace `trim` | M |
| P5 | Los cambios del dueño tardan hasta 1 h en la ficha pública (por código; no reproducible en desarrollo) | La ficha usa `revalidate = 3600` y ninguna acción la revalida | S |
| P6 | Des-reclamar deja residuos: negocio huérfano si tiene boosts, informes o eventos; `places.source` queda en `owner`; los eventos los hereda el siguiente dueño | `admin-claims.ts:85` no comprueba errores ni limpia dependientes | M |
| P7 | La cola de fotos no llega a las fotos recientes de usuarios: muestra las 100 más antiguas, todas Mapillary | `admin/photos/page.tsx:14-15` | M |
| P8 | El formulario de evento pierde fechas e imagen tras un error del servidor | `<form action>` reinicia campos no controlados (`EventManager.tsx:118`) | S |

Otros: no hay control para que el dueño suba fotos propias; la regla "un evento por lugar y
fecha" solo aplica al timestamp exacto; el botón dice "Me interesa" pero guarda "asistiré"; las
estadísticas cuentan las visitas del propio dueño; el dueño puede reseñar su propio lugar.

---

## 4. Brechas consolidadas

Fuente: **L** = existía en el legacy `setup-2026`, **P** = prometido en el plan propio.
Valor pensado para el producto actual (Chile, "¿dónde voy hoy?" + IA como community manager),
no para el contexto Cuba de 2019.

### 4.1 Base de producción (sin esto no se lanza)

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Blindaje de autorización: columnas protegidas, guards por página, revoke de funciones | L·P | Roto (3.1) | M |
| Rate limiting en endpoints públicos y validación con Zod en server actions | L·P | Solo reseñas | M |
| Callback de auth + emails de autenticación con SMTP y plantillas propias | L·P | Ausente | S |
| Migraciones reproducibles: versionar RPC sin archivo, renumerar, regenerar tipos | P | Drift | M |
| CI con tipos, lint, build y smoke; tests unitarios (`hours`, `profanity`) y e2e | L·P | Ausente | M |
| Monitoreo de errores y analítica de producto (medir D30 y la métrica norte) | L·P | Diferido | M |
| Aceptación de términos en el registro; eliminación de cuenta y datos (requisito de tiendas) | L·P | Ausente | S |
| Entornos separados (staging) y variables documentadas | L·P | Ausente | M |

### 4.2 Calidad de datos

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Reactivar fotos de Google y dejar de degradar en silencio | — | Roto (F1) | S |
| Enriquecimiento de la cola larga (70% sin descripción ni embedding), on-demand al primer view | P | Cada zona enriquece máx. 60 lugares | M |
| Cobertura de horarios y "abierto ahora" en cards y ficha, con zona horaria por ciudad | P | 19% con horario | M |
| Backfill general del estado de negocio (cerrados) | P | 0,4% | S |
| Anti-duplicados al importar (distancia + similitud de nombre) | L | Parcial | S |
| Decidir qué hacer con las 1.613 fotos Mapillary pendientes | — | Bloqueadas | S |
| Desactivar zonas vacías o sin enriquecer | P | 2 zonas activas sin contenido | S |

### 4.3 Panel del dueño (el core B2B)

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Edición completa de ficha: nombre, horario, dirección, categoría, portada/logo, fotos propias | L·P | Solo vibe, descripción, contacto, precio, tags | M |
| Publicar la respuesta del dueño a una reseña, con sello de dueño | L·P | La IA sugiere; solo se copia al portapapeles | S |
| Proponer un lugar nuevo que no está en el catálogo | L | Ausente | M |
| Aviso al solicitante cuando su reclamo se aprueba o rechaza, con motivo; "mis solicitudes" | L | Ausente | S |
| Aviso al equipo cuando entra un reclamo | L | Ausente | S |
| Un negocio con varios lugares | L | Se crea un negocio por reclamo | S |
| Editor del tono de marca (`brand_voice`) | — | La IA lo lee, nadie puede escribirlo | S |
| Editar y cancelar eventos avisando a los inscritos | L | Solo crear y eliminar | S |
| Dar de baja el lugar / pedir cambios a la administración | L | Ausente | S |

### 4.4 Analítica e informes para el dueño (lo que más aportó el legacy nuevo)

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Estadísticas con serie temporal (hora, día, mes) y gráficos | L·P | Contadores a 7 y 30 días | M |
| Métricas que faltan: llamadas/WhatsApp, RSVP, reseñas y fotos por periodo | L·P | No se miden | S |
| Informe semanal programado y enviado por email (hoy es un botón manual) | L·P | Manual | M |
| Resumen periódico de números para todos los dueños, sin IA | L | Ausente | S |
| Alerta al dueño ante reseña crítica | L | Ausente | S |
| Notificaciones al dueño por actividad en su lugar | L | Solo recordatorio de evento al usuario | S |
| Rendimiento de un boost (impresiones y clics) | L | Ausente | S |
| Sentimiento por reseña y resumen "qué dice la gente", con caché | L | Ausente | M |
| Privacidad de la analítica: anonimato y umbral mínimo antes de mostrar demografía | L | Ausente | M |
| Catálogo de informes IA temáticos | L | Un solo informe | L — diferir |
| Demografía agregada de la audiencia | L | Ausente | M — diferir |
| Análisis competitivo, clustering de clientes, detección de comunidades | L | Ausente | L–XL — diferir |

Nota: en el legacy estos módulos funcionaban con ~pocos usuarios y varias pantallas no validaban
propiedad ni suscripción. La idea vale; la implementación sobre scikit-learn y grafos no se
traslada. Con embeddings en pgvector se resuelve más barato, y solo tiene sentido cuando haya
volumen de interacciones.

### 4.5 Monetización

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Pasarela de pago: checkout, webhook, sincronizar `businesses.plan` | L·P | Diferido por decisión de equipo | L |
| Gates y cuotas por plan con verificación en servidor | L·P | Ausente | M |
| Boost: de pago, tope 1 de cada 8 cards, etiqueta "Patrocinado", visible de verdad en el feed | L·P | Gratis, ilimitado, posiblemente invisible | M |
| Ciclo de vida de suscripción: estados, gracia, renovación, emails | L | Ausente | M — con pagos |

El legacy tenía el motor de suscripciones (23 planes, estados, periodo de gracia, autorenovación)
pero **`PaymentService.bill()` era un stub**: "suscribirse" activaba el plan gratis. Los precios
eran placeholders en moneda cubana. Sirve como referencia de reglas, no de integración.

### 4.6 Lado usuario

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Feed con scroll infinito y cambio manual de ciudad | L·P | 40 fijos | M |
| Perfil de gusto que aprende del comportamiento (refresco desde `interactions`) | P | Se escribe una vez en el onboarding | L |
| Ranking según diseño: pesos en `feed_config`, hora/día, abierto, novedad | P | Pesos fijos en SQL | L |
| Página de detalle de evento compartible, con imagen propia | L | Ausente | M |
| Cartelera Hoy / Esta semana, por ciudad; "me interesa" separado de "asistiré" | L·P | Lista única sin filtro | S |
| Contacto accionable en la ficha (llamar, WhatsApp, email) con métrica | L·P | Texto plano | S |
| Lugares relacionados en la ficha y "populares" por ciudad | L | Ausente | S |
| Perfil editable, "mi actividad" (mis reseñas, mis eventos) | L·P | Solo lectura | M |
| Notificaciones in-app: más tipos, enlace de destino, historial | L | Un solo tipo | M |
| Avisar a quienes guardaron un lugar cuando publica evento o promo | L | Ausente | M |
| Feedback de usuarios y "sugerir corrección" de un lugar, con bandeja admin | L | Ausente | M |
| Búsqueda más allá del nombre, filtros reales, estado en la URL | L·P | Solo nombre | M |
| Listados por ciudad y categoría (SEO), sitemap por ciudad | L·P | `/places` sin paginar | M |
| Login con Google | L·P | Diferido | S |
| Conserje: resultado compartible con imagen, cuota visible | P | Parcial | M |
| Páginas institucionales: quiénes somos, ayuda, contacto, 404 propio | L | Parcial | S |
| Amenities y servicios como dato estructurado | L | Solo tags libres | M |

### 4.7 Admin y operación

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Auditoría de cambios (`audit_log` existe y nadie escribe) | L·P | Ausente | S |
| Motivo obligatorio al rechazar un reclamo e historial | L | Parcial | S |
| Moderación IA de reseñas, fotos y eventos con cola | P | Todo se auto-aprueba salvo fotos | M |
| Gestión de negocios y miembros; suspender y eliminar usuarios | L | Parcial | M |
| Tareas programadas: informes, vencimientos, poda de telemetría | L | 2 crons | M |
| Infraestructura de email: remitente, vista previa, baja, registro de envíos | L·P | Diferido | M |
| Control de coste IA: presupuesto con corte, prompts versionados | P | Solo se registra el gasto | M |
| Ejecutar la carga de zonas fuera del equipo local | — | Solo en local con las llaves del desarrollador | M |

### 4.8 Móvil

| Brecha | Fuente | Estado hoy | Esf. |
|---|---|---|---|
| Completar el checklist del doc 13: dominio, deep links, plugins nativos, builds, tiendas | P | Shell Capacitor configurado | L |
| Push nativo: recordatorio de evento y re-engagement | P | Diferido (se usa Realtime) | L |

### 4.9 Se descarta

Mapas y rutas offline, APK nativa, recomendador kNN/SVD, atributos de perfil declarados (música,
deporte, nivel académico…), amistades entre usuarios, valoración de eventos, panel de
hiperparámetros de ML, predicción de abandono de clientes concretos, envío manual de correo
desde el admin, toda la infraestructura Docker/nginx, y el contacto dueño→usuario (requiere
consentimiento explícito y no aporta hoy).

**Secretos en el legacy:** hay credenciales en claro (`gonet/client_secret.json`, una clave
privada en `despliegue/`, contraseñas en un documento de `!!to do`). No copiar nada de eso al
repo nuevo; rotar lo que siga vivo.

---

## 5. Orden sugerido (insumo para el plan, no el plan)

1. **Ola 0 — Seguridad (1–2 días).** S1–S14. Una migración de endurecimiento (columnas de
   `profiles` y `businesses`, revoke de funciones, vista pública de perfiles), mover `proxy.ts`
   a `src/`, guard por página en `/admin`, validar `next`, límite del conserje para anónimos.
2. **Ola 1 — Que lo que hay funcione (3–5 días).** F1–F17 y los menores. Incluye reactivar la
   facturación de Google y versionar `admin_save_place`.
3. **Ola 2 — Red de seguridad (3–4 días).** Lint, CI, tests de `hours` y `profanity`, smoke e2e
   de los flujos principales, migraciones reproducibles, tipos regenerados, borrar scaffolding.
4. **Ola 3 — Datos (1–2 semanas, con gasto de IA).** Enriquecer la cola larga, horarios,
   estado de negocio, duplicados, zonas vacías, zona horaria por ciudad.
5. **Ola 4 — Panel del dueño completo (2 semanas).** 4.3 entero más las métricas y la serie
   temporal de 4.4, respuesta pública a reseñas, notificaciones al dueño.
6. **Ola 5 — Emails e informes programados (1–2 semanas).** Callback de auth, emails de
   reclamo, informe semanal automático, alertas de reseña crítica.
7. **Ola 6 — Lado usuario (2–3 semanas).** Feed paginado, detalle de evento, cartelera,
   contacto accionable, perfil editable, búsqueda, feedback.
8. **Ola 7 — Monetización (cuando el equipo dé el OK).** Pagos, gates por plan, boost de pago.
9. **Después.** Móvil y push; analítica avanzada (sentimiento, demografía, competitivo) cuando
   haya volumen.

Decisiones que el plan necesita del equipo: cuándo activar pagos; si las 13 ciudades de España
siguen activas o se concentra en Chile; qué hacer con las fotos Mapillary pendientes; y si la
verificación de reclamos sigue siendo manual.
