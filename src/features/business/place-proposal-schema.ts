import { z } from 'zod'
import { optPhone, optText, website } from '@/features/business/listing-schema'
import { clean } from '@/features/business/owner-schemas'

// "Proponer un lugar nuevo": lo que escribe el solicitante y lo que confirma el admin al
// aprobar. Fuera de los archivos 'use server' porque esos solo pueden exportar funciones async.

export const PROPOSAL_NAME_MAX = 120
export const PROPOSAL_ADDRESS_MAX = 200
export const PROPOSAL_CITY_MAX = 80
export const PROPOSAL_REFERENCE_MAX = 500
/** Propuestas pendientes a la vez por persona. */
export const MAX_PENDING_PROPOSALS = 5

// Id de un <select>: entero positivo; vacío u "otra" -> null.
const optionalId = z.preprocess((v) => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}, z.number().nullable())

const requiredId = (message: string) =>
  z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() ? Number(v) : typeof v === 'number' ? v : NaN
    return Number.isInteger(n) && n > 0 ? n : undefined
  }, z.number({ error: message }))

/** Formulario del solicitante. La ubicación es un enlace de mapa, "lat, lng" o una descripción. */
export const placeProposalSchema = z.object({
  name: clean(PROPOSAL_NAME_MAX, 2, 'Nombre'),
  category_id: requiredId('Elige una categoría'),
  address: clean(PROPOSAL_ADDRESS_MAX, 3, 'Dirección'),
  city_id: optionalId,
  city_name: optText(PROPOSAL_CITY_MAX, 'Ciudad'),
  reference: clean(PROPOSAL_REFERENCE_MAX, 5, 'Ubicación en el mapa'),
  phone: optPhone('Teléfono'),
  website,
  message: optText(1000, 'Nota'),
}).refine((v) => v.city_id !== null || !!v.city_name, {
  path: ['city_name'],
  message: 'Elige la ciudad o escribe su nombre si no aparece en la lista',
})

export type PlaceProposalInput = z.infer<typeof placeProposalSchema>

/**
 * Lo que confirma el admin al aprobar: el pin definitivo (obligatorio), la ciudad (vacío = la
 * más cercana al pin) y si ya revisó los posibles duplicados.
 */
export const approveProposalSchema = z.object({
  lat: z.preprocess((v) => (typeof v === 'string' && v.trim() ? Number(v.trim().replace(',', '.')) : NaN),
    z.number({ error: 'Indica la latitud del pin' }).min(-90, 'Latitud fuera de rango').max(90, 'Latitud fuera de rango')),
  lng: z.preprocess((v) => (typeof v === 'string' && v.trim() ? Number(v.trim().replace(',', '.')) : NaN),
    z.number({ error: 'Indica la longitud del pin' }).min(-180, 'Longitud fuera de rango').max(180, 'Longitud fuera de rango')),
  city_id: optionalId,
  confirm_duplicate: z.preprocess((v) => v === 'on' || v === '1' || v === 'true', z.boolean()),
})
