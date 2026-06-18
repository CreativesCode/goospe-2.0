// Dispara una escritura "fire-and-forget" SIN bloquear la respuesta, pero registrando el fallo
// en vez de tragarlo. Pensado para telemetría de costo/cuota (ai_usage, concierge_quota): si la
// escritura falla, antes se perdía en silencio (`void`); ahora queda en logs.
//
// Nota: los builders de PostgREST/supabase-js son thenables perezosos (la petición se dispara al
// llamar `.then`), así que esto además garantiza que la escritura se envíe.
export function fireAndForget<T>(p: PromiseLike<T>, label: string): void {
  Promise.resolve(p).then(
    (res) => {
      const err = (res as { error?: unknown } | null)?.error
      if (err) console.error(`[fire:${label}]`, err)
    },
    (err) => console.error(`[fire:${label}]`, err),
  )
}
