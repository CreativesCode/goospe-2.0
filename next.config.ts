import type { NextConfig } from 'next'

// Cabeceras de seguridad para todas las rutas. La CSP sólo lleva frame-ancestors: un default-src
// rompería los scripts inline de Next y el mapa.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
    // Tree-shaking agresivo de imports nombrados (iconos) → bundle más chico.
    optimizePackageImports: ['lucide-react'],
    // Las subidas (portada, logo, fotos, imagen de evento, carta) viajan por server actions y
    // admiten hasta 5 MB; el tope por defecto de Next es 1 MB y cortaba cualquier foto de móvil.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    // Sirve AVIF/WebP automáticamente cuando el navegador lo soporta.
    formats: ['image/avif', 'image/webp'],
    // Hosts permitidos para next/image (se adopta en §2.2 de docs/12).
    // - Supabase Storage: fotos de usuario/negocio (bucket público 'places').
    // - Las fotos de Google van por el proxy /api/place-photo (same-origin, no requiere patrón).
    // - §2.2 añadirá Mapillary/Foursquare aquí al migrar esas imágenes a next/image.
    remotePatterns: [
      { protocol: 'https', hostname: 'ywdjsyxsshaymkjkopho.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
}

export default nextConfig
