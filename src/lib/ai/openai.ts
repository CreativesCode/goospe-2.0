// Capa AI server-only para la app (conserje). NO importar en componentes cliente.
// Reusa OpenAI: embeddings text-embedding-3-large@1024 (igual que el ETL) + gpt-4o para elegir.

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

export async function embedQuery(text: string): Promise<number[]> {
  const data = await openai('embeddings', { model: EMBED_MODEL, input: text, dimensions: 1024 })
  return data.data[0].embedding as number[]
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

const SYSTEM = `Eres el conserje de Goospe en Puerto Varas, Chile: decides rápido a dónde ir.
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

export type Usage = { input_tokens: number; output_tokens: number }

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
