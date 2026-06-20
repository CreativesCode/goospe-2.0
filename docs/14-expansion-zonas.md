# 14 · Expansión de zonas — roadmap para cargar poco a poco

> Estado al 2026-06-20: **3 zonas activas** — Puerto Varas (165), Frutillar (44), Llanquihue (15).
> Total ~224 lugares enriquecidos en la cuenca del lago Llanquihue.

El cargador ya soporta **los 249 países** (selector País → Región → Ciudad en `/admin/loader`, o el
skill `/load-zone`). Esta lista prioriza la **expansión natural del piloto** (región de Los Lagos y
el sur turístico), de lo más cercano a lo más lejano. Cárgalas de a una y revisa el resultado.

Cada carga es barata (ciudad chica ~30-60 lugares, **<$0.50** en OpenAI + Google Places) e
**idempotente** (re-correr no re-paga). Gracias a la autocorrección de solape (`assign_nearest_city`),
el orden de carga ya no importa: cada zona nueva "jala" los lugares vecinos que le pertenecen.

---

## Anillo 1 — Cuenca del Llanquihue (inmediato, alto valor turístico)

| Ciudad | Región | Comando | Notas |
|--------|--------|---------|-------|
| **Puerto Montt** | Los Lagos | `node etl/load-zone.mjs --country CL --region "Los Lagos" --city "Puerto Montt"` | Capital regional, la más grande cerca. Mucho volumen. |
| **Puerto Octay** | Los Lagos | `… --city "Puerto Octay"` | Pueblo patrimonial junto al lago, turístico. |
| **Ensenada** | Los Lagos | `… --city "Ensenada"` | Camino a Petrohué/Volcán Osorno, cabañas y restoranes. |
| **Nueva Braunau** | Los Lagos | `… --city "Nueva Braunau"` | Colonia alemana pegada a Puerto Varas. Chica. |

## Anillo 2 — Resto de Los Lagos (continente)

| Ciudad | Región | Comando | Notas |
|--------|--------|---------|-------|
| **Osorno** | Los Lagos | `… --city "Osorno"` | Ciudad grande al norte de la región. |
| **Fresia** | Los Lagos | `… --city "Fresia"` | Agrícola, chica. |
| **Los Muermos** | Los Lagos | `… --city "Los Muermos"` | Chica. |
| **Maullín** | Los Lagos | `… --city "Maullín"` | Costera, desembocadura del río. |
| **Calbuco** | Los Lagos | `… --city "Calbuco"` | Costera, gastronomía de mar. |
| **Purranque** | Los Lagos | `… --city "Purranque"` | Chica. |
| **Río Negro** | Los Lagos | `… --city "Río Negro"` | Chica. |

## Anillo 3 — Chiloé (Los Lagos, isla — turismo fuerte)

| Ciudad | Región | Comando | Notas |
|--------|--------|---------|-------|
| **Ancud** | Los Lagos | `… --city "Ancud"` | Entrada norte de Chiloé. |
| **Castro** | Los Lagos | `… --city "Castro"` | Capital de Chiloé, palafitos, alta demanda turística. |
| **Dalcahue** | Los Lagos | `… --city "Dalcahue"` | Feria y cocinerías, muy turístico. |
| **Quellón** | Los Lagos | `… --city "Quellón"` | Sur de la isla. |

## Anillo 4 — Sur turístico extendido (otras regiones)

| Ciudad | Región | Comando | Notas |
|--------|--------|---------|-------|
| **Valdivia** | Los Ríos | `node etl/load-zone.mjs --country CL --region "Los Ríos" --city "Valdivia"` | Ciudad universitaria, cervecera, mucho volumen. |
| **Pucón** | Araucanía | `node etl/load-zone.mjs --country CL --region "Araucanía" --city "Pucón"` | Destino turístico top (lago Villarrica). |
| **Villarrica** | Araucanía | `… --region "Araucanía" --city "Villarrica"` | Junto a Pucón. |
| **Frutillar Alto** | Los Lagos | (cubierto por Frutillar) | Ya incluido en la zona Frutillar. |

> ⚠️ **Región exacta importa**: el selector usa el nombre oficial ISO 3166-2. Para Araucanía el
> catálogo la lista como `Araucanía` (sin "La"). Si Nominatim no encuentra la ciudad al índice 0,
> el CLI imprime los candidatos — re-corre con `--index N` el correcto.

---

## Cómo cargar (recordatorio)

- **Vista admin** (recomendado, con barra de progreso en vivo): `/admin/loader` en `localhost`.
- **Agente / terminal**: el comando de la tabla. Imprime los candidatos de Nominatim; elige con `--index`.
- Tras cargar, la zona queda **activa** y aparece en el feed de quien esté en su radio. Revisa en
  `/admin/places` (filtro **por zona**) que los lugares y fotos quedaron bien.

## Pendientes de calidad (aplican a todas las zonas)

- **Horarios y contacto**: OSM casi nunca los trae; la IA **no los inventa**. Para llenarlos haría
  falta ampliar el `FieldMask` de Google Places (`regularOpeningHours`, `nationalPhoneNumber`,
  `websiteUri`) en `photosGoogle`. Sin horarios, el "abierto ahora" no funciona aunque la timezone
  ya sea correcta.
- **Cola larga (tail)**: cada zona enriquece hasta `ZONE_ANCHOR_LIMIT` (60) como `full`; el resto
  queda `tail` sin descripción IA hasta implementar el enriquecimiento on-demand al primer view.
