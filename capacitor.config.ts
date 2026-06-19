import type { CapacitorConfig } from '@capacitor/cli'

// Estrategia A (WebView remoto): el shell nativo carga el deploy de Vercel.
// SSR, API routes y auth por cookies quedan intactos. Ver docs/13-capacitor-appflow.md.
const isDev = process.env.CAP_ENV === 'dev'

const config: CapacitorConfig = {
  appId: 'com.goospe.app',
  appName: 'Goospe',
  webDir: 'mobile/www', // solo fallback offline; el contenido real vive en server.url
  server: {
    // PROD: WebView carga el deploy de Vercel. DEV: live-reload al dev local (ajustar IP de tu LAN).
    url: isDev ? 'http://192.168.1.100:3000' : 'https://goospe.vercel.app',
    cleartext: isDev, // HTTP solo en dev; prod siempre HTTPS
    allowNavigation: [
      'goospe.vercel.app',
      'goospe.com',
      '*.goospe.com',
      '*.supabase.co', // auth + storage Supabase dentro del WebView
    ],
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
}

export default config
