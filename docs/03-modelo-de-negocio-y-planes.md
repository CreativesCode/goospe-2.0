# 03 — Modelo de Negocio y Planes de Suscripción

> Proyecto: **Goospe 2.0** (nombre de trabajo) — Motor de decisión "¿dónde voy hoy?" con feed personalizado de lugares + eventos + capa B2B para dueños de negocio.
> Fecha: Junio 2026

---

## 1. Tesis de negocio

El usuario no quiere un directorio ni leer 40 reseñas. Quiere que alguien que lo conoce le diga **dónde ir ahora, según quién es, con quién está y cuánto quiere gastar**. Los negocios no quieren "un perfil más", quieren **clientes en la puerta hoy** y saber qué piensa la gente de ellos sin contratar una agencia.

El modelo es un **marketplace de atención de dos lados**:

- **Lado B (paga):** dueños de negocios locales (restaurantes, bares, cafeterías, nightlife, hostales) pagan suscripción mensual por visibilidad, herramientas de gestión ligera y analítica con IA.
- **Lado C (gratis, con techo):** usuarios consumen el feed y el conserje IA gratis con límites; un plan opcional Premium elimina límites y añade funciones sociales.

La IA no es un adorno: es el producto. Pero el coste de IA por usuario debe mantenerse **por debajo de $0.30/mes por usuario activo** y **por debajo del 10% del precio de cada plan B2B** (ver §5).

---

## 2. Por qué ahora sí (y antes no)

| Problema en 2019-2022 (Goospe v1) | Situación en 2026 |
|---|---|
| Cold start de datos: cargar lugares era manual (info places.txt, ETL artesanal desde OSM) | LLMs enriquecen automáticamente fichas desde OSM + webs + redes sociales por ~$0.0025/lugar |
| Personalización = formularios de gustos (música, comida, deporte) que nadie llenaba | Aprendizaje implícito por comportamiento + embeddings; el perfil se construye solo |
| Los dueños no sabían gestionar un perfil digital | Tras años de Google Business / Instagram, ya es hábito; la IA además les redacta todo |
| Equipo dividido, backend Django + Android nativo = dos mundos | Un solo stack TypeScript (Next.js + Supabase + Capacitor), un solo desarrollador puede mantenerlo |
| Sin vía de cobro clara | Stripe/PayPal para mercado fuera de Cuba; pricing regional si se opera en LATAM |

---

## 3. Estrategia de entrada: vertical + una ciudad

Siguiendo la lógica validada (competir horizontal contra Google Maps/TikTok es inviable):

- **Vertical inicial:** comida + bares + nightlife + eventos pequeños ("planes de hoy"). NO hoteles, NO turismo masivo, NO retail en el MVP.
- **Geografía inicial:** **una sola ciudad** hasta tener densidad (objetivo: ≥500 lugares con ficha rica y ≥30 negocios reclamados antes de abrir la segunda ciudad).

### Decisión de ciudad — dos escenarios

| | Escenario A: Santa Clara / Cuba | Escenario B: ciudad hispana con poder de pago (ej. Miami, Madrid, Sto. Domingo) |
|---|---|---|
| Ventaja | Datos, marca, contactos y conocimiento local ya existen (activos del proyecto v1) | Los negocios pueden pagar $15-99/mes con tarjeta; Stripe funciona |
| Desventaja | Cobro B2B casi imposible (sin pasarelas); monetización dependería de remesas/diáspora | Cold start total de relaciones; competencia local más activa |
| Rol recomendado | **Laboratorio de producto**: validar el feed, el conserje y el flujo de owners con coste de adquisición ~0 | **Mercado de monetización**: replicar el playbook validado |

**Recomendación:** lanzar el producto en el escenario A como banco de pruebas (ya hay datos y red), y en paralelo preparar el escenario B como mercado de pago en cuanto el producto demuestre retención (D30 > 20%). La arquitectura debe ser multi-ciudad desde el día 1 (ya lo era en v1 con `City`).

---

## 4. Fuentes de ingreso

1. **Suscripciones B2B (núcleo, ~80% del ingreso esperado)** — planes del §6.
2. **Destacados y promociones puntuales (boosts)** — un negocio paga por aparecer destacado en el feed X días o por promocionar un evento. Compra puntual, sin suscripción ($5–20 por campaña). Es la puerta de entrada al plan de pago.
3. **Usuario Premium (opcional, fase 2)** — $2.99/mes: conserje IA ilimitado, listas colaborativas, sin destacados patrocinados.
4. **Fase futura:** comisión por reservas/RSVP con prepago, paquetes para cadenas multi-local, API de datos agregados.

**Regla de oro anti-muerte del marketplace:** el contenido patrocinado nunca supera 1 de cada 8 cards del feed, y siempre va marcado. Si el feed deja de ser confiable, ambos lados se van.

---

## 5. Costes de IA — cálculo detallado

Precios API Claude (junio 2026, por millón de tokens):

| Modelo | Input | Output | Batch (-50%) | Cache read (~0.1×) |
|---|---|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 | $0.50 / $2.50 | $0.10 |
| Sonnet 4.6 | $3.00 | $15.00 | $1.50 / $7.50 | $0.30 |
| Opus 4.8 | $5.00 | $25.00 | $2.50 / $12.50 | $0.50 |

**Principio de diseño:** lo barato y masivo va a Haiku 4.5 en batch; lo visible y de valor (conserje, informes B2B) va a Sonnet 4.6 con prompt caching; Opus 4.8 solo para tareas puntuales de máxima calidad (ej. generar el playbook de una campaña). El ranking del feed NO usa LLM por scroll: usa embeddings (pgvector) + heurísticas; el LLM solo refresca el perfil de gusto.

### 5.1 Coste por feature

| Feature | Modelo / modo | Tokens aprox. (in/out) | Coste unitario | Frecuencia | Coste mensual |
|---|---|---|---|---|---|
| Enriquecer ficha de lugar (descripción, tags, vibe, precio estimado) | Haiku batch | 2,000 / 600 | **$0.0025/lugar** | 1 vez + refresh trimestral | 10,000 lugares ≈ $25 one-off; refresh ≈ $8/mes |
| Clasificar/moderar reseña o foto | Haiku batch | 500 / 100 | **$0.0005/ítem** | por UGC | 10,000 ítems/mes ≈ $5 |
| Perfil de gusto del usuario (resumen + embedding) | Haiku | 3,000 / 400 | **$0.005/refresh** | semanal por usuario activo | $0.02/usuario/mes |
| Conserje "¿dónde voy hoy?" (chat con contexto de ciudad) | Sonnet + cache (≈80% hit) | 4,000 / 300 | **~$0.008/consulta** | media 8 consultas/mes (free, con límite) | $0.06/usuario/mes |
| Informe semanal del negocio (sentimiento, tendencias, comparativa) | Sonnet | 8,000 / 1,000 | **$0.04/informe** | semanal | $0.16/negocio/mes |
| Respuesta sugerida a reseña | Haiku | 1,200 / 250 | **$0.0025/reseña** | ~30 reseñas/mes | $0.08/negocio/mes |
| Generador de promo/evento (texto + variantes para redes) | Sonnet | 2,500 / 800 | **$0.02/pieza** | 4–20 piezas/mes según plan | $0.08–0.40/negocio/mes |
| Análisis competitivo mensual (plan alto) | Opus 4.8 | 20,000 / 3,000 | **$0.175/informe** | mensual | $0.18/negocio/mes |
| Embeddings (Voyage/OpenAI, ~$0.1/M tokens) | — | — | — | — | <$5/mes total |

### 5.2 Coste agregado por actor

| Actor | Composición | Coste IA / mes |
|---|---|---|
| Usuario free activo | perfil semanal + 8 consultas conserje + parte proporcional de moderación | **~$0.09** |
| Usuario premium | perfil + 40 consultas conserje | **~$0.34** (precio $2.99 → margen 88%) |
| Negocio plan Impulso | informe semanal Haiku-only + 10 respuestas + 4 promos | **~$0.25** |
| Negocio plan Pro | informe semanal Sonnet + respuestas ilimitadas (~30) + 12 promos | **~$0.55** |
| Negocio plan Élite | todo lo anterior + análisis competitivo Opus + 20 promos + prioridad | **~$1.10** |

> Con 5,000 usuarios activos y 100 negocios de pago: coste IA total ≈ **$500–600/mes**. Es ruido frente al ingreso B2B objetivo (§7). El coste dominante real será infra (Supabase Pro $25+, hosting, imágenes) y adquisición, no la IA.

### 5.3 Controles de coste obligatorios

- Límite de consultas del conserje en free tier (8–10/mes) con upsell a Premium.
- Prompt caching: el contexto de ciudad/sistema del conserje se cachea (TTL 1h en horas pico).
- Todo lo no interactivo va por **Batch API** (50% descuento): enriquecimiento, informes nocturnos, moderación.
- Presupuesto mensual de IA con alarma (corte suave a Haiku si se supera 2× lo previsto).
- **Determinista primero**: nada que ya venga estructurado de la fuente (categoría, horario, teléfono de OSM) pasa por un LLM — código, no tokens. La IA solo redacta sobre datos verificados (~70% menos tokens en el ETL y cero datos factuales inventados).
- **Enriquecimiento por niveles**: completo solo para los ~500 lugares que el feed muestra de verdad; la cola larga lleva ficha mínima y se enriquece on-demand al primer view. Se paga solo por lo que se ve.
- **Prompt congelado**: los prompts se ajustan contra una muestra de ~50 lugares y solo entonces se lanza el batch masivo — las re-ejecuciones de desarrollo son el multiplicador oculto de coste (×10–20), no el precio por token.
- **Nunca re-pagar**: todo output de IA se persiste en BD; los re-runs saltan lo ya generado salvo cambio de versión de prompt.
- Cambiar a un modelo más barato (Gemini Flash, open-source) NO es un control de MVP: el ahorro absoluto es ~$15–20 y la capa `LLM` lo deja como tarde de trabajo futura si el gasto supera ~$500/mes.

---

## 6. Planes para dueños de negocio

Precios para mercado con poder de pago (escenario B). Para el escenario A/LATAM aplicar pricing regional (~40-60% menos) o modo "fundadores: gratis 6 meses".

### 🆓 Presencia — $0/mes
*Objetivo: que reclamar el negocio sea irresistible y el directorio se llene solo.*
- Reclamar y verificar la ficha (foto, horario, teléfono, menú PDF/foto).
- Ficha enriquecida por IA (descripción, tags) — la genera la plataforma de todos modos.
- Responder reseñas manualmente.
- Estadística básica: visitas a la ficha este mes (un número, sin desglose).
- Publicar 1 evento activo a la vez (sujeto a moderación).

### 🚀 Impulso — $19/mes (anual: $15/mes)
*Para el negocio pequeño que quiere moverse sin saber de marketing.*
- Todo lo de Presencia, más:
- **Resumen semanal por IA**: qué dijo la gente de ti esta semana, en 5 líneas (Haiku).
- **Respuestas sugeridas a reseñas** (hasta 30/mes) con el tono del negocio.
- **4 promos/eventos al mes generados por IA** (texto listo para la app + Instagram/WhatsApp).
- Estadísticas: visitas, guardados en favoritos, clics a teléfono/cómo llegar, desglose semanal.
- Hasta 3 eventos activos simultáneos.
- Coste IA estimado: ~$0.25/mes → **margen bruto ~98%**.

### 📈 Pro — $49/mes (anual: $39/mes)
*Para el negocio que vive de la rotación de clientes (bares, restaurantes con competencia fuerte).*
- Todo lo de Impulso, más:
- **Informe semanal profundo (Sonnet)**: sentimiento por aspecto (comida/servicio/precio/ambiente), tendencias, alertas de reseñas críticas en <1h.
- **Audiencia**: perfil agregado y anónimo de quién interactúa con tu ficha (franjas de edad, horarios, intereses dominantes).
- Respuestas sugeridas ilimitadas + redacción de menú/carta optimizada.
- 12 promos/mes + **1 boost de feed incluido al mes** (48h destacado, valor $10).
- Hasta 10 eventos activos; RSVP con lista de asistentes esperados.
- Coste IA estimado: ~$0.55/mes → **margen bruto ~99%**.

### 👑 Élite — $99/mes (anual: $79/mes)
*Para grupos, discotecas y locales ancla de la ciudad.*
- Todo lo de Pro, más:
- **Análisis competitivo mensual (Opus 4.8)**: tu posición frente a 5 competidores que tú eliges — qué hacen mejor, qué oportunidad tienes, plan de acción sugerido.
- **Asistente de marketing conversacional**: chat ilimitado "¿qué hago este fin de semana para llenar el local?" con contexto de tus datos.
- 3 boosts de feed/mes incluidos + prioridad en la sección Eventos.
- Multi-local (hasta 3 fichas) y multi-usuario (hasta 5 cuentas staff).
- Soporte prioritario por WhatsApp.
- Coste IA estimado: ~$1.10/mes (+chat, techo ~$3) → **margen bruto ~96%**.

### Add-ons (cualquier plan, incluso free)
- **Boost de feed**: $5 / 24h, $10 / 48h, $25 / semana (marcado como "Patrocinado").
- **Evento destacado**: $8 hasta la fecha del evento.
- Paquete de fotos profesional con edición IA: $15 one-off (fase 2).

---

## 7. Unit economics y escenario a 12 meses (ciudad de pago)

Supuestos conservadores: 1 ciudad, lanzamiento mes 0, ventas B2B presenciales (1 persona).

| Mes | Usuarios activos | Negocios free | Impulso ($19) | Pro ($49) | Élite ($99) | MRR | Coste IA | Infra+APIs |
|---|---|---|---|---|---|---|---|---|
| 3 | 1,500 | 60 | 8 | 2 | 0 | $250 | ~$40 | ~$80 |
| 6 | 4,000 | 150 | 25 | 8 | 2 | $1,065 | ~$120 | ~$150 |
| 9 | 8,000 | 250 | 45 | 18 | 4 | $2,133 | ~$300 | ~$250 |
| 12 | 15,000 | 400 | 70 | 30 | 8 | $3,592 | ~$600 | ~$400 |

- **Break-even operativo** (sin salarios) ≈ mes 5–6.
- LTV de un negocio Pro (churn 5%/mes → 20 meses): ~$980. CAC objetivo (visita comercial + demo): <$80. **LTV/CAC > 12** si la venta es local y directa.
- El riesgo no es el margen: es la **densidad** (¿hay suficiente para abrir la app un martes?) y el **churn B2B** si no perciben clientes nuevos. Por eso el informe semanal SIEMPRE incluye "X personas vieron tu ficha, Y la guardaron, Z pidieron cómo llegar" — valor visible cada semana.

---

## 8. KPIs que mandan

| Lado | KPI norte | Umbral de salud |
|---|---|---|
| C | Retención D30 | >20% |
| C | % de sesiones que terminan en una "decisión" (guardar, cómo llegar, RSVP) | >35% |
| C | Consultas al conserje por usuario activo | >2/mes |
| B | Negocios reclamados / total fichas de la ciudad | >15% |
| B | Churn mensual de pago | <6% |
| B | % de informes semanales abiertos | >60% |
| $ | Coste IA / MRR | <10% |

---

## 9. Riesgos principales y mitigación

1. **Cold start de oferta** → ETL automático desde OSM + enriquecimiento IA da 100% de cobertura de fichas desde el día 1 (nadie reclama una app vacía). El place-uploader v1 es el precedente directo; se reescribe sobre Supabase.
2. **Cold start de demanda** → lanzamiento por nichos sociales (universitarios, foodies locales) + el feed funciona sin registro (registro solo para guardar/comentar).
3. **Dependencia de un proveedor de IA** → capa de abstracción de LLM (un módulo `lib/ai/` con interfaz única); los prompts son el activo, no el proveedor.
4. **Google/TikTok hacen esto** → ya lo hacen "en piezas"; la defensa es densidad local + relación directa con los negocios (el informe semanal y el WhatsApp del vendedor no los replica una big tech).
5. **Cuba como mercado de cobro** → no apostar ingresos al escenario A; es laboratorio. Ingresos reales = escenario B.
