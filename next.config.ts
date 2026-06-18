import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
    // Tree-shaking agresivo de imports nombrados (iconos) → bundle más chico.
    optimizePackageImports: ['lucide-react'],
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
