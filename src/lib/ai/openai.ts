// Capa AI server-only para la app (conserje). NO importar en componentes cliente.
// Reusa OpenAI: embeddings text-embedding-3-large@1024 (igual que el ETL) + gpt-4o para elegir.

import { unstable_cache } from 'next/cache'

const KEY = process.env.OPENAI_API_KEY
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o'
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-large'

async function openai(path: string, body: unknown) {
  if (!KEY) throw new Error('Falta OPENAI_API_KEY')
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function embedRaw(text: string): Promise<number[]> {
  const data = await openai('embeddings', { model: EMBED_MODEL, input: text, dimensions: 1024 })
  return data.data[0].embedding as number[]
}

// Los embeddings son deterministas para (texto, modelo) → los cacheamos en el Data Cache de
// Next (persistente, compartido entre requests/instancias). Ahorra llamadas/costo a OpenAI en
// consultas repetidas y en los ejemplos fijos del conserje. La clave incluye el texto normalizado.
const embedCached = unstable_cache(embedRaw, ['concierge-embed-v1'], { revalidate: false })

export async function embedQuery(text: string): Promise<number[]> {
  return embedCached(text.trim().replace(/\s+/g, ' '))
}

export type Usage = { input_tokens: number; output_tokens: number }
const usageOf = (data: { usage?: { prompt_tokens?: number; completion_tokens?: number } }): Usage => ({
  input_tokens: data.usage?.prompt_tokens ?? 0,
  output_tokens: data.usage?.completion_tokens ?? 0,
})

// Texto libre (promos, respuestas a reseñas, informes).
export async function complete(
  system: string, user: string, opts: { temperature?: number; maxTokens?: number } = {}
): Promise<{ text: string; usage: Usage }> {
  const data = await openai('chat/completions', {
    model: TEXT_MODEL,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 700,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })
  return { text: data.choices[0].message.content ?? '', usage: usageOf(data) }
}

// Salida estructurada (json_schema).
export async function completeJson(
  system: string, user: string, schema: object
): Promise<{ data: unknown; usage: Usage }> {
  const data = await openai('chat/completions', {
    model: TEXT_MODEL, temperature: 0.4,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: schema },
  })
  return { data: JSON.parse(data.choices[0].message.content), usage: usageOf(data) }
}

// Visión: extrae estructura de una imagen (ej. carta/menú). gpt-4o soporta imágenes.
export async function visionJson(
  imageUrl: string, system: string, prompt: string, schema: object
): Promise<{ data: unknown; usage: Usage }> {
  const data = await openai('chat/completions', {
    model: TEXT_MODEL, temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ] },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
  })
  return { data: JSON.parse(data.choices[0].message.content), usage: usageOf(data) }
}

export type Candidate = {
  id: string
  name: string
  vibe_line: string | null
  description: string | null
  tags: string[] | null
  price_level: number | null
  distance_m: number
  category_name: string | null
}

const SYSTEM = `Eres el conserje de Goospe: decides rápido a dónde ir, en la zona del usuario.
El usuario describe qué quiere (ambiente, ocasión, con quién va, presupuesto).
De la lista de candidatos (ya filtrados por cercanía y afinidad), elige EXACTAMENTE 3, los mejores para su pedido.
Para cada uno da una razón de UNA línea, concreta y honesta, citando señales reales del candidato
(vibe, precio, distancia, categoría, tags). NO inventes datos (horarios, platos, precios exactos).
Habla en español chileno cercano. Devuelve los id tal cual te los doy.`

const PICK_SCHEMA = {
  name: 'concierge_picks',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      picks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, reason: { type: 'string' } },
          required: ['id', 'reason'],
        },
      },
    },
    required: ['picks'],
  },
}

// Variante en streaming: emite cada pick {id, reason} en cuanto el modelo completa su línea
// (NDJSON), para render incremental en el conserje. Devuelve el usage al final.
export async function pickPlacesStream(
  query: string,
  candidates: Candidate[],
  onPick: (pick: { id: string; reason: string }) => void
): Promise<Usage> {
  if (!KEY) throw new Error('Falta OPENAI_API_KEY')
  const compact = candidates.map((c) => ({
    id: c.id, nombre: c.name, vibe: c.vibe_line, categoria: c.category_name,
    precio: c.price_level, distancia_m: Math.round(c.distance_m), tags: c.tags,
  }))
  const system = `${SYSTEM}
FORMATO DE SALIDA: exactamente 3 líneas. Cada línea es un objeto JSON {"id":"...","reason":"..."}.
Una sola línea por pick, sin comas finales, sin markdown, sin texto fuera de los objetos.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: TEXT_MODEL, temperature: 0.5, stream: true, stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Pedido del usuario: "${query}"\n\nCandidatos:\n${JSON.stringify(compact)}` },
      ],
    }),
  })
  if (!res.ok || !res.body) throw new Error(`OpenAI stream ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let sse = ''   // buffer de líneas SSE
  let text = ''  // contenido acumulado del modelo
  let emitted = 0
  let usage: Usage = { input_tokens: 0, output_tokens: 0 }

  const flushLines = () => {
    let nl: number
    while ((nl = text.indexOf('\n')) >= 0) {
      const line = text.slice(0, nl).trim()
      text = text.slice(nl + 1)
      if (!line || emitted >= 3) continue
      try { const p = JSON.parse(line); if (p?.id && p?.reason) { onPick({ id: p.id, reason: p.reason }); emitted++ } } catch { /* línea incompleta/no-json */ }
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    sse += dec.decode(value, { stream: true })
    let idx: number
    while ((idx = sse.indexOf('\n')) >= 0) {
      const raw = sse.slice(0, idx).trim()
      sse = sse.slice(idx + 1)
      if (!raw.startsWith('data:')) continue
      const data = raw.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) { text += delta; flushLines() }
        if (json.usage) usage = { input_tokens: json.usage.prompt_tokens ?? 0, output_tokens: json.usage.completion_tokens ?? 0 }
      } catch { /* chunk parcial */ }
    }
  }
  // por si el último pick no terminó en salto de línea
  text += '\n'; flushLines()
  return usage
}

export async function pickPlaces(
  query: string,
  candidates: Candidate[]
): Promise<{ picks: { id: string; reason: string }[]; usage: Usage }> {
  const compact = candidates.map((c) => ({
    id: c.id,
    nombre: c.name,
    vibe: c.vibe_line,
    categoria: c.category_name,
    precio: c.price_level,
    distancia_m: Math.round(c.distance_m),
    tags: c.tags,
  }))
  const data = await openai('chat/completions', {
    model: TEXT_MODEL,
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Pedido del usuario: "${query}"\n\nCandidatos:\n${JSON.stringify(compact)}` },
    ],
    response_format: { type: 'json_schema', json_schema: PICK_SCHEMA },
  })
  const out = JSON.parse(data.choices[0].message.content) as { picks: { id: string; reason: string }[] }
  const u = data.usage ?? {}
  return {
    picks: (out.picks ?? []).slice(0, 3),
    usage: { input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0 },
  }
}
