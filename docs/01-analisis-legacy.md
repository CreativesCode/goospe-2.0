# 01 — Análisis del Proyecto Legacy (Goospe / Gonet, 2018–2023)

> Resumen ejecutivo de todo lo que existe en `C:\Local-Disc-D\Project\Goospe\`. **Propósito: extraer ideas validadas y lecciones — el proyecto nuevo se construye 100% desde cero** (repo nuevo, código nuevo, marca nueva). "Rescatar" en este documento significa siempre rescatar el *concepto*, nunca el código.

---

## 1. Qué era Goospe

Plataforma de **descubrimiento de lugares + eventos en Cuba** (piloto: Santa Clara) con tres piezas:

| Pieza | Stack | Tamaño | Último cambio |
|---|---|---|---|
| Backend + web (`source/Goospe/gonet`) | Django 3.0.6 + DRF + PostgreSQL 11 + Docker + Nginx, frontend MPA con Gulp/Bootstrap/jQuery | ~10k LOC Python, 40+ endpoints, 30+ modelos | Feb 2023 |
| App Android (`source/gonet_apk`) | Java 7 nativo, SDK 26, Mapsforge VTM (mapas offline) + GraphHopper (rutas offline), OrmLite/SQLite, SyncAdapter | ~44k LOC, 47 tablas locales, 873 commits | Ene 2021 |
| Cargador de lugares (`source/place-uploader`) | Python ETL: OSM/GraphHopper JSON → limpieza → geocoding (OSM reverse + GeoNames) → upload a API | 3 comandos (clean/fill/upload) | Feb 2023 |

Infraestructura: AWS EC2 (us-east-2), Docker Compose, dominio goospe.com, Amazon SES, S3.

La visión de negocio documentada (Cuestionario.docx, presentación) ya era la actual: **plataforma publicitaria de dos lados — usuarios reciben sugerencias personalizadas por IA, negocios pagan por visibilidad y analítica (imagen pública, evaluaciones, clientes potenciales, comparativa con el entorno)**. La idea estaba adelantada a la tecnología disponible.

---

## 2. Funcionalidades que llegaron a existir

### Lado usuario
- **Sugerencias personalizadas**: motor kNN propio (`main/machine_learning/suggestion_strategy.py`) que comparaba vectores de atributos de usuario (música, comida, deporte, cultura, nivel académico, empleo, relación, gamer) y promediaba los rankings de los k usuarios más parecidos → `Suggestion.expected_rank`. Fallback "fast suggestions": top de la ciudad por ranking × votantes. Recálculo por cron.
- **Rankings 1–5 estrellas** con regla de "un voto por lugar cada 30 días" (el nuevo borra el anterior) y actualización atómica de agregados (`PlaceStatistics`: distribución de votos 1–5, promedio ponderado, trending de últimos 30 días).
- **Comentarios** (500 chars, moderables con `is_blocked`), **favoritos**, **compartir** a redes.
- **Eventos** con participación/RSVP (`Participation.confirmed_presence`), aprobación del dueño (`owner_approved`), un evento por lugar por fecha.
- **Búsqueda avanzada multidimensional**: texto fuzzy (TrigramSimilarity de Postgres), categorías jerárquicas, amenidades (AND), ubicación país→región→ciudad, mínimos de ranking/votantes/favoritos.
- **Mapas 100% offline en Android**: tiles vectoriales Mapsforge + enrutamiento GraphHopper (auto/bici/a pie), búsqueda radial y por bounding box, descarga de mapas desde el server (`apk_map/`).
- **Sincronización offline-first** en Android: SyncAdapter nativo + cola de comandos (`Command`) con resolución de conflictos por `lastModified`.
- **Delivery**: `HomeDelivery` (zona + coste de envío) y `TakeawayFood` — embrión de la capa "pedidos".

### Lado negocio / admin
- `Place.user_owner` + `DeveloperDashboard` (panel de dueños, incompleto).
- Panel admin: moderación delegada (`ReviewAssignment`), auditoría completa (`Trace`: quién/qué/cuándo/IP/payload), gestión de contactos, emails resumen por cron, distribución de mapas APK.
- SEO: slugs, sitemaps, robots.txt.

### Datos
- **Doble taxonomía**: `OSMCategory` (cruda de OpenStreetMap) → mapeada N:1 a `GonetCategory` (taxonomía propia, jerárquica, con imagen). Si un lugar llega solo con categorías OSM, el mapeo es automático; sin categoría propia el lugar se rechaza.
- ETL probado contra datos reales de Cuba (Pinar del Río, Santa Clara) + curación manual (info places.txt, fotos/logos de ~15 negocios en `new line/`).

---

## 3. Qué quedó roto o sin terminar

| Área | Estado |
|---|---|
| Panel de dueños (CRUD de su lugar, stats) | Esqueleto sin terminar — **es exactamente el core B2B del relanzamiento** |
| Amistades (`Friendship`) | Modelo sin UI; comentado en el User |
| Chat / mensajería | Nunca existió |
| Subida de fotos de usuarios a lugares | Sin implementar (solo logo/cover por admin) |
| Ranking de eventos | Campos `ranking`/`voters` sin lógica de actualización |
| Push notifications | Solo 2 notificaciones locales (perfil incompleto, lugares sin votar); sin FCM |
| Caché | TODO explícito: "all queries should be cached!!!" |
| Pagos / monetización | Cero código |
| DynamicEntity* (Android) | Código huérfano de una feature cancelada |
| Seguridad | Credenciales hardcodeadas en build.gradle y .pem en el repo — **rotar/no reutilizar nada de esto** |

---

## 4. Veredicto: qué se rescata y qué se descarta

### ✅ Se rescata (solo como ideas/conceptos — nada de código ni marca)
1. **El diseño del dominio** — Place/Address/City, doble taxonomía OSM→propia, estadísticas agregadas + trending, Event/Participation. Conceptos probados que inspiran el esquema nuevo (ver doc 05 §4), que se escribe de cero.
2. **La receta del pipeline de datos** (place-uploader): OSM → limpiar → deduplicar → geocodificar → subir resuelve el cold start. Se escribe de cero en TypeScript con enriquecimiento LLM añadido.
3. **Las reglas de negocio aprendidas**: evento único por lugar/fecha, aprobación del owner, moderación delegada, auditoría de cambios, validación "sin categoría propia no entra".
4. **La visión B2B documentada** (Cuestionario/presentación) — confirma que el pricing B2B actual ataca una necesidad ya investigada.
5. **Conocimiento de errores** (carpeta `!!to do`): UX de comentarios con teclado, scroll perdido al navegar, direcciones sin humanizar, husos horarios en eventos — checklist de QA gratis.

### ❌ Se descarta
- Todo el código como tal: Django 3.0 (EOL), Java 7 / SDK 26 (no publicable en Play Store, mínimo hoy targetSdk 34+), Gulp/jQuery/Bootstrap 4.
- Los mapas offline custom (Mapsforge+GraphHopper): complejidad enorme; en 2026 se sustituye por MapLibre + tiles vectoriales hosteados (y modo offline ligero por caché si Cuba lo exige).
- SyncAdapter + cola de comandos: Supabase + caché local simple cubren el 95% del caso con 5% del esfuerzo.
- El kNN artesanal: se sustituye por embeddings (pgvector) + señales de comportamiento.
- Credenciales, claves SSH y secretos del repo (comprometidos por definición).

---

## 5. Lecciones de la v1 que condicionan la v2

1. **El formulario de gustos mató la personalización**: 16 tablas de atributos que el usuario debía rellenar. En v2 el perfil se infiere del comportamiento (vistos, guardados, RSVPs, horas de uso); preguntar como máximo 3 cosas en onboarding.
2. **Dos stacks = dos equipos = fricción** (la causa real de la muerte del proyecto). v2: un solo stack TS (Next.js + Supabase + Capacitor).
3. **El offline total era el 40% del esfuerzo Android** y solo importaba por el contexto cubano. v2: online-first con caché; offline real solo si el mercado lo exige y como fase tardía.
4. **Sin dueños dentro, los eventos no fluyen** (nota interna: "cuando comencemos esto no será posible, ya que no habrán dueños interactuando"). v2: el flujo de reclamar negocio entra en el MVP, no después.
5. **Los agregados se calculan al escribir, no al leer** (PlaceStatistics) — patrón correcto, se mantiene con triggers de Postgres.
