/**
 * Datos estructurados (schema.org) como <script type="application/ld+json">.
 * `<` se escapa para que un texto de usuario ("</script>") no pueda cerrar la etiqueta.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
