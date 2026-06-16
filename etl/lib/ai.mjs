// Capa AI swappable para el ETL. Hoy: OpenAI. Mañana: Anthropic (texto) + Voyage (embeddings),
// implementando el mismo interfaz { enrichText, embed }. El resto del ETL no cambia.
//
// Configurable por env:
//   AI_PROVIDER        openai            (único soportado por ahora)
//   OPENAI_TEXT_MODEL  gpt-4o            (calidad de copy)
//   OPENAI_EMBED_MODEL text-embedding-3-large
//   EMBED_DIMS         1024              (debe coincidir con vector(1024) del esquema)

const RATES = {
  // USD por 1M tokens [input, output]
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4.1': [2, 8],
  'gpt-4.1-mini': [0.4, 1.6],
  // embeddings: [por 1M tokens]
  'text-embedding-3-large': [0.13],
  'text-embedding-3-small': [0.02],
}

export function costUSD(model, inTok = 0, outTok = 0) {
  const r = RATES[model]
  if (!r) return 0
  return (inTok / 1e6) * r[0] + (outTok / 1e6) * (r[1] ?? 0)
}

const ENRICH_SCHEMA = {
  name: 'place_enrichment',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      description: { type: 'string', description: '1-2 frases, español, atractivas, SIN inventar datos específicos' },
      vibe_line: { type: 'string', description: 'Una línea corta (<60 chars) para la card del feed' },
      tags: { type: 'array', items: { type: 'string' }, description: '3-6 tags de ambiente/ocasión en minúscula' },
      price_level: { type: ['integer', 'null'], description: '1 (barato) a 4 (caro), o null si no se puede estimar' },
    },
    required: ['description', 'vibe_line', 'tags', 'price_level'],
  },
}

const SYSTEM = `Eres el editor de contenido de Goospe, una app chilena que sugiere dónde salir a comer, tomar café o beber.
Escribes fichas breves y atractivas para lugares de Puerto Varas (Región de Los Lagos, Chile), en español rioplatense-neutro chileno.
REGLAS DURAS:
- NO inventes datos factuales: nada de horarios, teléfonos, precios exactos, platos del menú, premios, años de fundación ni reseñas.
- Escribe sobre el TIPO de lugar y su ambiente probable según su categoría y nombre. Si no sabes algo, no lo afirmes.
- Tono cercano y juvenil, sin clichés de marketing vacío ("el mejor", "único", "imperdible").
- price_level: estima con cautela por el tipo de local; si no hay señal, devuelve null.
- vibe_line: una sola línea evocadora para una card (ej: "Café tranquilo con vista al lago").
- tags: ambiente/ocasión (ej: "casual", "para grupos", "romántico", "al aire libre"), en minúscula, sin '#'.`

export function createAI(env) {
  const key = env.OPENAI_API_KEY
  if (!key) throw new Error('Falta OPENAI_API_KEY en .env.local')
  const provider = env.AI_PROVIDER || 'openai'
  if (provider !== 'openai') throw new Error(`AI_PROVIDER '${provider}' no soportado todavía (solo openai)`)

  const textModel = env.OPENAI_TEXT_MODEL || 'gpt-4o'
  const embedModel = env.OPENAI_EMBED_MODEL || 'text-embedding-3-large'
  const embedDims = Number(env.EMBED_DIMS || 1024)

  async function openai(path, body) {
    const res = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return res.json()
  }

  // place: { name, category, city, address, tags }
  async function enrichText(place) {
    const ctx = [
      `Nombre: ${place.name}`,
      `Categoría: ${place.category}`,
      place.city ? `Ciudad: ${place.city}` : null,
      place.address ? `Dirección: ${place.address}` : null,
      place.tags?.length ? `Señales OSM: ${place.tags.join(', ')}` : null,
    ].filter(Boolean).join('\n')

    const data = await openai('chat/completions', {
      model: textModel,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Genera la ficha para este lugar:\n${ctx}` },
      ],
      response_format: { type: 'json_schema', json_schema: ENRICH_SCHEMA },
    })
    const out = JSON.parse(data.choices[0].message.content)
    return {
      ...out,
      model: textModel,
      usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
    }
  }

  async function embed(text) {
    const data = await openai('embeddings', {
      model: embedModel,
      input: text,
      dimensions: embedDims,
    })
    return {
      vector: data.data[0].embedding,
      model: embedModel,
      usage: { tokens: data.usage?.total_tokens ?? 0 },
    }
  }

  return { enrichText, embed, textModel, embedModel, embedDims }
}
