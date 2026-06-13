# 02 — Visión de Producto y Estrategia

---

## 1. Reposicionamiento

**De:** "directorio de lugares con reviews y mapa" (Goospe v1)
**A:** **motor de decisión "¿dónde voy hoy?"** — un feed personalizado tipo TikTok de lugares y planes cercanos, con un conserje IA que decide contigo, y una capa de gestión ligera para los negocios que financia todo.

### Frase de producto
> "Abre la app, dinos con quién estás y cuánto quieres gastar. Nosotros te decimos dónde ir — y al negocio le decimos cómo llenarte el local."

### Lo que NO somos
- No somos un mapa (Google Maps gana siempre en "cómo llego").
- No somos un sitio de reviews largos (Yelp/TripAdvisor).
- No somos una red social de contenido (TikTok/Instagram).
- Somos la capa de **decisión + acción local** que falta entre esos tres.

---

## 2. Usuario objetivo (lado C)

**Persona primaria:** 18–35 años, urbano, sale 1–3 veces por semana, decide a última hora, decide en grupo, fatiga de scrollear Instagram para encontrar "un sitio".

**Job to be done:** "Es jueves 7pm, somos 3, queremos algo chill y barato cerca — decídeme en 30 segundos."

**Momentos de uso:**
1. **Ahora mismo** (geolocalizado, abierto-ahora, a X minutos).
2. **Planificando el finde** (eventos, reservas informales, listas con amigos — fase 2).
3. **Descubrimiento pasivo** (scroll del feed sin intención, como TikTok — genera el grafo de gustos).

## 3. Cliente objetivo (lado B)

Restaurantes, cafeterías, bares, discotecas, organizadores de eventos pequeños. Dolor: dependen de Instagram (alcance aleatorio, sin datos), Google Business (estático), boca a boca. No tienen community manager. **La IA es su community manager por $19–99/mes.**

---

## 4. Producto — los 4 pilares

### Pilar 1 — Feed de lugares (el "TikTok de salir")
- Scroll vertical de cards a pantalla completa: foto/video, nombre, vibe en 1 línea (generada por IA), precio ($–$$$), distancia/tiempo, "abierto ahora", social proof ("a 12 personas como tú les encantó").
- Acciones por card: guardar ❤️, "cómo llego", "ver más", compartir, "no me interesa" (señal negativa, oro para el ranking).
- Ranking = `score(usuario, lugar, contexto)` con embeddings + heurísticas (hora, día, distancia, abierto, novedad, boost pagado limitado a 1/8 cards). **Sin LLM en el scroll** (coste y latencia).
- Funciona **sin registro** (perfil anónimo por dispositivo); registro al primer guardado.

### Pilar 2 — Conserje ("Decide por mí")
- Chat/botón: entrada libre ("algo romántico y barato cerca del centro") o 3 chips (¿con quién? ¿presupuesto? ¿vibe?).
- Devuelve 3 opciones con el porqué de cada una y acciones directas. Modelo: Sonnet 4.6 con contexto de ciudad cacheado + candidatos pre-filtrados por pgvector (el LLM elige y explica, no busca).
- Límite free: 8–10 consultas/mes → upsell Premium.

### Pilar 3 — Eventos / "Qué hay hoy"
- Pestaña "Hoy/Esta semana" con eventos cercanos; RSVP de un toque ("voy" / "me interesa") + contador social.
- Los eventos los crean los negocios (gratis 1 activo, más en planes de pago) y entran también como cards del feed.
- Herencia v1: evento único por lugar/fecha, aprobación del owner, recordatorio push el día del evento.

### Pilar 4 — Panel del negocio (B2B, financia todo)
- Reclamar ficha en <5 min desde el móvil (verificación por teléfono/foto del local).
- Editar info, menú (foto → IA lo estructura), horarios, fotos.
- **Informe semanal IA** ("tu semana en 5 líneas") — el gancho de retención.
- Crear eventos y promos con IA ("escríbeme la promo del jueves").
- Estadísticas de visitas/guardados/clics; planes según doc 03.

---

## 5. Personalización: cómo se construye el perfil de gusto

1. **Onboarding mínimo** (≤3 preguntas): qué te gusta hacer (chips), presupuesto típico, zona.
2. **Señales implícitas** (tabla `interactions`): card vista >3s, guardado, descartado, "cómo llego", RSVP, hora/día de uso, consultas al conserje.
3. **Perfil = embedding + resumen textual** ("le tira a plan tranquilo entre semana, nightlife los sábados, presupuesto medio, evita turísticos") refrescado semanalmente por Haiku.
4. Cada lugar tiene su embedding (descripción enriquecida + tags + reviews) → el ranking del feed es similitud + contexto + reglas.

Ventaja sobre v1: cero formularios de 16 atributos; el perfil se construye solo.

---

## 6. Diferenciación defendible

| Competidor | Su fuerza | Nuestro ángulo |
|---|---|---|
| Google Maps | Datos universales, navegación | Ellos responden "qué hay"; nosotros "a dónde VOY yo, hoy". Sin feed, sin contexto social local, B2B impersonal |
| TikTok/IG | Descubrimiento aspiracional | No accionable: sin "abierto ahora", sin distancia, sin RSVP; el local pequeño no sabe usarlos |
| Yelp/TripAdvisor | Volumen de reviews | Modelo review-céntrico envejecido, irrelevantes en LATAM/España a nivel local |
| Fever/Eventbrite | Eventos grandes ticketados | Ignoran el plan pequeño y gratuito (el 90% de las salidas) |

**Foso real:** densidad local (datos + negocios reclamados + relación comercial directa) ciudad a ciudad. Es ganable porque nadie grande lo trabaja calle a calle.

---

## 7. Estrategia de lanzamiento

(Ver decisión A/B de ciudad en doc 03 §3.)

**Secuencia:**
1. **T-8 semanas:** ETL llena 100% de fichas de la ciudad vía OSM + enriquecimiento IA. La app nace "llena".
2. **T-4:** beta cerrada con 50 usuarios semilla (círculo cercano + micro-influencers foodies locales).
3. **T-2:** visita comercial a 30 negocios ancla: ficha ya creada y bonita → "reclámala gratis, plan fundador". El negocio reclamado publica su primer evento → contenido fresco.
4. **T0:** lanzamiento público Android + web. Gancho de adquisición: el conserje compartible (resultado "esta app me mandó aquí" → screenshot → viral local).
5. **T+12 semanas:** si retención D30 >20% y >30 negocios activos → activar cobro / segunda ciudad.

**Métrica norte:** % de sesiones que terminan en una decisión (guardar / cómo llego / RSVP).

---

## 8. Nombre y marca

**Proyecto nuevo = marca nueva.** No se arrastra el nombre Goospe/Gonet (carga la historia del proyecto anterior y el equipo anterior). Criterios para el nombre nuevo:

- Corto (≤3 sílabas), pronunciable igual en español e inglés, dominio .com o .app disponible.
- Que evoque la acción ("salir", "plan", "hoy", "vamos"), no el objeto ("mapa", "guía", "lugares").
- Verbalizable: "lo vi en X" / "pregúntale a X" — el conserje compartible necesita un nombre que se diga en voz alta.
- Validar registro de marca básico y handles de Instagram/TikTok antes de decidir.

Direcciones de ejemplo para brainstorm (no decisiones): *Vamo, Hoyo, Planea, Salgo, Dondi, Yendo*. La elección del nombre entra como tarea de la Fase 0 del plan (doc 06) y no debe bloquear el desarrollo (el repo puede arrancar con un codename).
