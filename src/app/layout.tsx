import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

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
  title: 'Goospe — ¿dónde voy hoy?',
  description: 'Goospe sugiere dónde ir: lugares y eventos cerca de ti, decididos en 30 segundos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={roboto.variable}>
      <body>{children}</body>
    </html>
  )
}
