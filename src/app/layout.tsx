import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider, themeInitScript } from '@/shared/components/theme-provider'

// Tipografía de marca: Roboto (Light 300 / Regular 400 / Medium 500).
// Auto-alojada desde los .ttf originales en src/app/fonts/ (sin dependencia de Google Fonts).
const roboto = localFont({
  src: [
    { path: './fonts/Roboto-Light.ttf', weight: '300', style: 'normal' },
    { path: './fonts/Roboto-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Roboto-Medium.ttf', weight: '500', style: 'normal' },
  ],
  variable: '--font-roboto',
  display: 'swap',
})

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
      </body>
    </html>
  )
}
