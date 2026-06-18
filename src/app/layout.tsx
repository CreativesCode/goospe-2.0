import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider, themeInitScript } from '@/shared/components/theme-provider'
import { Toaster } from '@/shared/components/toast'

// Tipografía de marca: Roboto (Light 300 / Regular 400 / Medium 500).
// next/font/google descarga el subset `latin` en BUILD y lo auto-aloja en nuestro origen:
// no hay request a Google en runtime (GDPR-safe), pero a diferencia de los .ttf locales
// completos (~482 KB) solo servimos los glifos latinos en .woff2 (mucho más liviano).
const roboto = Roboto({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
})

// `viewport-fit=cover` habilita los `env(safe-area-inset-*)` en iOS (notch / barra home);
// sin esto las barras fijas y el FAB del feed quedan tapados. themeColor sigue el tema.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF9F5' },
    { media: '(prefers-color-scheme: dark)', color: '#131210' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goospe.com'),
  applicationName: 'Goospe',
  title: {
    default: 'Goospe — ¿dónde voy hoy?',
    template: '%s',
  },
  description: 'Goospe sugiere dónde ir: lugares y eventos cerca de ti, decididos en 30 segundos.',
  // La imagen OG por defecto la aporta src/app/opengraph-image.tsx (heredada por todo el sitio).
  openGraph: { siteName: 'Goospe', locale: 'es_CL', type: 'website' },
  twitter: {
    card: 'summary_large_image',
    title: 'Goospe — ¿dónde voy hoy?',
    description: 'Lugares y eventos cerca de ti en Puerto Varas, decididos en 30 segundos.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={roboto.variable} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
