// tz-lookup no publica tipos. Firma: (lat, lng) → IANA timezone, p.ej. 'America/Santiago'.
declare module 'tz-lookup' {
  const tzlookup: (lat: number, lng: number) => string
  export default tzlookup
}
