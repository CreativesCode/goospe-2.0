# Proyecto Nuevo 2026 — Motor de Decisión "¿Dónde voy hoy?"

> Junio 2026. Paquete de documentación para arrancar un **proyecto completamente nuevo, desde cero**, basado en la idea reconducida: no un directorio de lugares, sino un **motor de decisión** — feed personalizado tipo TikTok de lugares + eventos + conserje IA + capa B2B ligera para dueños de negocio.
> Stack: **Next.js + Supabase + Capacitor (Android primero)**.
>
> ⚠️ **Nada del proyecto antiguo (Goospe/Gonet 2018–2023) se migra ni se reutiliza como código.** El legacy se analizó únicamente como **cantera de ideas validadas y lecciones aprendidas** (doc 01). Repo nuevo, código nuevo, datos nuevos, credenciales nuevas. **La marca sí se conserva: nombre Goospe + identidad visual original** (logo, paleta, tipografía — doc 08); es lo único que se hereda tal cual.

## Índice

| Doc | Contenido | Léelo si… |
|---|---|---|
| [01-analisis-legacy.md](01-analisis-legacy.md) | Qué se construyó en el proyecto antiguo, qué ideas quedaron validadas, qué errores no repetir. **Solo inspiración — no se hereda código** | quieres saber qué ideas ya se probaron |
| [02-vision-y-estrategia.md](02-vision-y-estrategia.md) | La idea nueva: motor de decisión, los 4 pilares de producto, personalización por comportamiento, diferenciación y plan de lanzamiento | vas a tomar decisiones de producto |
| [03-modelo-de-negocio-y-planes.md](03-modelo-de-negocio-y-planes.md) | Modelo de dos lados, **planes B2B (Presencia $0 / Impulso $19 / Pro $49 / Élite $99) con costes de IA calculados por feature**, unit economics a 12 meses, KPIs | hablas con socios o inversores |
| [04-arquitectura-tecnica.md](04-arquitectura-tecnica.md) | Monorepo desde cero, Supabase (PostGIS+pgvector), cómo se calcula el feed sin LLM por scroll, capa de IA con tiers de modelo, ETL, RLS, CI/CD, coste de infra | vas a escribir código |
| [05-modelo-de-datos.md](05-modelo-de-datos.md) | SQL completo del esquema nuevo, triggers, políticas RLS, y tabla de qué conceptos se inspiran en el dominio ya validado | vas a crear la base de datos |
| [06-plan-de-implementacion.md](06-plan-de-implementacion.md) | 14 semanas en 6 fases con checklists y criterios de salida; backlog post-lanzamiento; riesgos de ejecución | vas a planificar el trabajo |
| [07-gpt-conversation.md](07-gpt-conversation.md) | Evaluación externa (segunda opinión): factibilidad 7.5/10, ranking de mercados (Chile #1, Uruguay laboratorio, España después), pricing regional, recorte de MVP y una fase de validación de 4 semanas antes de construir | quieres una crítica externa antes de invertir tiempo/dinero |
| [08-identidad-visual.md](08-identidad-visual.md) | Marca Goospe (heredada): nombre, logo del eslabón, paleta (verde `#2dc186` + gris + gradiente), tipografía Roboto, variantes de logo y nota del splash animado. Ya integrada en `public/brand/` + Tailwind | vas a construir UI |

## Resumen en 10 líneas

1. La idea base (descubrimiento personalizado de lugares + eventos + capa B2B) ya la tuvimos en 2019 y el mercado la confirmó; hoy se reconstruye **desde cero** con el encuadre correcto: no es un mapa, es un **sistema de decisión + feed personalizado**.
2. En 2026 los tres bloqueos históricos desaparecieron: los LLMs enriquecen datos solos (cold start resuelto), los usuarios ya consumen discovery en formato feed, y un stack TS único lo mantiene una persona.
3. No competimos con Google Maps/TikTok/Yelp en horizontal: construimos la capa de **decisión + acción local** que falta entre los tres.
4. Estrategia: **vertical** (comida/bares/nightlife/eventos pequeños) × **una ciudad** hasta tener densidad.
5. La app nace llena: ETL desde OpenStreetMap + enriquecimiento IA (~$25 los 10.000 lugares) — idea ya probada en el proyecto antiguo, reescrita de cero.
6. Monetización: suscripciones B2B con la IA como community manager del negocio ($19/$49/$99) + boosts puntuales; coste de IA <10% del MRR por diseño.
7. Coste IA por usuario activo ≈ $0.09/mes (Haiku batch + Sonnet con caché); el riesgo no es el margen, es la densidad y el churn B2B.
8. El esquema de datos es nuevo (Postgres + PostGIS + pgvector), tomando del dominio antiguo solo los conceptos que demostraron funcionar (agregados por trigger, taxonomía propia, evento único por lugar/fecha).
9. 14 semanas a lanzamiento: fundaciones → datos → feed → conserje/eventos → panel B2B → pulido. Cada fase con criterio de salida.
10. Métrica norte: % de sesiones que terminan en una decisión (guardar / cómo llego / RSVP).

## Próximos pasos inmediatos

1. ~~Decidir la ciudad piloto~~ ✅ **Decidida: Puerto Varas (Los Lagos, Chile)** — mercado de pago en formato ciudad mediana/turística (doc 07). Sembrada y activa en `cities`.
2. ~~Elegir nombre y dominio~~ ✅ **Nombre: Goospe** (se conserva la marca original — nombre, logo, paleta y tipografía; ver doc 08). Identidad ya integrada en la app. Dominio sugerido: goospe.com (doc 06).
3. ~~Crear el repo nuevo y ejecutar la Fase 0~~ — repo creado; BD de Fase 0 aplicada (esquema doc 05 + RLS + triggers + seed). Migraciones en `supabase/migrations/`.
4. **Siguiente:** correr el ETL de prueba sobre Puerto Varas para medir cuántos lugares reales salen de OSM (valida la Fase 1 antes de escribir UI).
