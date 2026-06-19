# 13 — Capacitor + Ionic Appflow (app nativa iOS/Android)

> Objetivo: empaquetar Goospe como app nativa instalable (App Store / Play Store) y
> compilarla en la nube con **Appflow** (`dashboard.ionicframework.com`), sin reescribir
> la app web. Fecha de redacción: **2026-06-19**.

---

## 0. TL;DR — la decisión clave

Goospe **no puede exportarse estático** (`output: 'export'`) sin una refactorización enorme,
porque depende de servidor en runtime:

- **Auth por cookies en `proxy.ts`** (middleware Next 16, `updateSession`) → redirecciones SSR.
- **Server Components** que leen cookies de sesión (panel, admin, saved, perfil).
- **API routes con secretos server-side**: `/api/concierge` (clave OpenAI), `/api/place-photo`
  (proxy de fotos Google), `/api/search`, `/api/track`.

Por eso la estrategia recomendada es **WebView a URL remota** (el shell nativo carga
`https://app.goospe.com`, que es el mismo deploy de Vercel) + **plugins nativos** de Capacitor
para lo que el navegador no da (geo con permiso nativo, cámara, push, splash, deep links).
**Appflow se usa para compilar en la nube** (imprescindible para iOS desde Windows) y firmar/
entregar a las tiendas.

| Estrategia | Refactor | SSR/API/Auth | Offline | Appflow Live Updates (OTA) | Recomendado |
|---|---|---|---|---|---|
| **A. WebView remoto** (`server.url`) | Ninguno | ✅ intactos | ❌ requiere red | ❌ no aplica (sin bundle local) | **✅ AHORA** |
| B. Export estático + cliente | Semanas | ❌ mover concierge/proxy a Edge Functions, auth a cliente | ✅ | ✅ | Futuro (si se quiere offline) |

> En la estrategia A, Appflow sirve para **Native Builds** (compilar `.ipa`/`.aab` en la nube)
> y firma. Las **Live Updates** OTA de Appflow **no aplican** porque no hay bundle web local que
> actualizar (el contenido vive en Vercel y se actualiza con cada deploy). Esto es perfecto:
> publicas web → el WebView ya muestra la versión nueva sin pasar por la tienda.

Esto coincide con lo que ya anticipaba `docs/04-arquitectura-tecnica.md`:
*"Capacitor (envuelve build estático o webview a app.goospe.com)"*.

---

## 1. Prerrequisitos

- [ ] **Dominio de producción servido**: `https://app.goospe.com` (o el dominio Vercel actual)
      con HTTPS válido. El WebView **exige HTTPS** (sin `cleartext` en producción).
- [ ] **Cuenta Appflow** en `dashboard.ionicframework.com` (plan que incluya Native Builds).
- [ ] **Cuenta Apple Developer** ($99/año) — obligatoria para iOS/App Store.
- [ ] **Cuenta Google Play Console** ($25 único) — para Android/Play Store.
- [ ] **Android Studio** (opcional, para probar Android localmente en Windows).
      iOS **no se puede compilar en Windows** → ahí entra Appflow.
- [ ] Node 20+, repo limpio en git (Appflow conecta por GitHub/GitLab/Bitbucket).

---

## 2. Identidad de la app (decidir antes de empezar)

| Campo | Valor propuesto |
|---|---|
| `appId` (bundle id) | `com.goospe.app` |
| `appName` | `Goospe` |
| URL remota prod | `https://app.goospe.com` |
| Esquema deep link | `goospe://` + Universal/App Links sobre `https://goospe.com` |

> El `appId` es **inmutable** una vez publicado en las tiendas. Confirmarlo con el equipo antes de
> la primera build.

---

## 3. Instalación de Capacitor 8 (en la raíz del repo)

> **Estado: ✅ HECHO (2026-06-19).** Instalado Capacitor **8.4.1** (core, cli, android, ios) +
> plugins geolocation, splash-screen, status-bar, app, browser, camera y `@capacitor/assets`.
> Plataformas `android/` e `ios/` añadidas y sincronizadas. iOS usa **Swift Package Manager**
> (no CocoaPods), así que el proyecto se genera sin problemas en Windows; la compilación se hace
> en Appflow.
>
> Comandos de referencia (ya ejecutados):

```bash
# Core + CLI
npm install @capacitor/core
npm install -D @capacitor/cli

# Inicializa (genera capacitor.config.ts)
npx cap init "Goospe" "com.goospe.app" --web-dir=mobile/www

# Plataformas nativas
npm install @capacitor/ios @capacitor/android
npx cap add android
npx cap add ios          # genera el proyecto; compilarlo necesita macOS o Appflow

# Plugins que usa Goospe
npm install @capacitor/geolocation        # /api geo con permiso nativo (lib/geo.ts)
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/app
npm install @capacitor/browser             # abrir enlaces externos / OAuth fuera del WebView
npm install @capacitor/camera              # subir foto de lugar (features/photos)
# Fase 2 (push): npm install @capacitor/push-notifications
```

### `webDir` mínimo (fallback offline)

Como el contenido vive remoto, `webDir` solo necesita una página de fallback cuando no hay red.
Crear `mobile/www/index.html`:

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Goospe</title>
<style>body{margin:0;display:grid;place-items:center;height:100vh;font-family:Roboto,system-ui;
background:#fff;color:#111}.c{text-align:center}</style></head>
<body><div class="c"><h1>Goospe</h1><p>Sin conexión. Revisa tu internet y reintenta.</p></div></body></html>
```

> Si más adelante se va a **Estrategia B**, `webDir` pasaría a ser `out/` (el `next build` con
> `output: 'export'`).

---

## 4. `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const isDev = process.env.CAP_ENV === 'dev'

const config: CapacitorConfig = {
  appId: 'com.goospe.app',
  appName: 'Goospe',
  webDir: 'mobile/www',
  server: {
    // PROD: WebView carga el deploy real (Vercel). DEV: live-reload al dev local.
    url: isDev ? 'http://192.168.1.X:3000' : 'https://app.goospe.com',
    cleartext: isDev, // HTTP solo en dev; prod siempre HTTPS
    // Dominios a los que el WebView puede navegar dentro de la app (resto abre navegador):
    allowNavigation: [
      'app.goospe.com',
      'goospe.com',
      'ywdjsyxsshaymkjkopho.supabase.co', // auth + storage Supabase
      '*.supabase.co',
    ],
  },
  ios: { contentInset: 'always' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, backgroundColor: '#ffffff', showSpinner: false },
  },
}

export default config
```

> **Importante (auth):** la sesión Supabase es por **cookie**. En WebView las cookies del origen
> `app.goospe.com` persisten, así que login email/contraseña funciona sin cambios. `allowNavigation`
> debe incluir el dominio de Supabase para que el callback de auth no se abra fuera de la app.

---

## 5. Permisos nativos (lo que la app ya usa)

### 5.1 Geolocalización (`src/lib/geo.ts` usa `navigator.geolocation`)
Funciona en WebView pero **iOS exige descripción de permiso** o crashea.

**iOS** — `ios/App/App/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Goospe usa tu ubicación para mostrarte lugares cercanos.</string>
```

**Android** — `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

> Recordatorio de memoria: `NEXT_PUBLIC_FORCE_LOCATION=1` fuerza Puerto Varas (útil para QA del
> WebView). En prod debe ir desactivado para usar la geo real del dispositivo.

### 5.2 Cámara / fotos (subida de foto de lugar — `features/photos`)
**iOS** `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Goospe usa la cámara para que subas fotos de los lugares.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Goospe accede a tus fotos para subir imágenes de lugares.</string>
```
**Android**: el `<input type="file" accept="image/*">` actual ya abre cámara/galería en WebView.
Para flujo nativo fino usar `@capacitor/camera` (opcional).

---

## 6. Deep links (compartir fichas `/places/[slug]`)

La app ya genera enlaces compartibles. Para que abran la app nativa:

- **Esquema custom**: `goospe://places/<slug>` (rápido, registrar en `Info.plist` / `AndroidManifest`).
- **Universal Links (iOS) + App Links (Android)** sobre `https://goospe.com/places/...`
  (requiere `apple-app-site-association` y `assetlinks.json` servidos en el dominio).
- Manejar la apertura con `@capacitor/app`:
```ts
import { App } from '@capacitor/app'
App.addListener('appUrlOpen', ({ url }) => {
  const slug = new URL(url).pathname // → router.push al detalle
})
```

---

## 7. Push notifications (Fase 2 — opcional)

La app ya tiene tabla `notifications` + Supabase Realtime (recordatorios de evento, campana en vivo).
Para **push nativo real** (con app cerrada):

1. `@capacitor/push-notifications` + **FCM** (Android) y **APNs** (iOS).
2. Crear proyecto Firebase → `google-services.json` (Android) y `GoogleService-Info.plist` (iOS).
3. Registrar token del dispositivo → guardarlo en tabla `devices` (ya existe en el esquema).
4. Enviar desde un job/Edge Function vía FCM HTTP v1.

> Diferido según `docs/09`: el push FCM se sustituyó por Realtime para el demo. Activar solo si el
> negocio lo pide. **No bloquea la primera build.**

---

## 8. Scripts npm (añadir a `package.json`)

```jsonc
{
  "scripts": {
    "cap:sync": "npx cap sync",
    "cap:android": "npx cap open android",
    "cap:ios": "npx cap open ios",
    "cap:dev:android": "CAP_ENV=dev npx cap run android --livereload --external",
    "cap:copy": "npx cap copy"
  }
}
```

> Tras cambiar `capacitor.config.ts`, plugins o `webDir`: **siempre** `npx cap sync`.

---

## 9. Ionic Appflow — build en la nube (`dashboard.ionicframework.com`)

Esto es lo que permite **compilar iOS desde Windows** y firmar para tiendas.

1. **Crear app** en Appflow → conectar el repo de GitHub (`goospe-2.0`).
2. **Commitear** `capacitor.config.ts`, `android/`, `ios/`, `mobile/www/` y `package.json`.
   - Verificar que `android/` e `ios/` **no** estén en `.gitignore` (Appflow los necesita).
3. **Native Builds** → seleccionar plataforma:
   - **Android**: subir keystore (o que Appflow lo genere) → genera `.aab`/`.apk` firmado.
   - **iOS**: subir **certificado de distribución** + **provisioning profile** desde Apple
     Developer (Appflow tiene asistente para generarlos) → genera `.ipa` firmado.
4. **Destinos de entrega**: conectar App Store Connect / Play Console para subir builds directo,
   o descargar el binario y subirlo manualmente.
5. (Opcional) **Automations**: build automática en cada push a `main`.

> **Live Updates de Appflow**: no se usan en Estrategia A (no hay bundle web local). Las
> actualizaciones de contenido llegan solas por el deploy de Vercel. Solo se hace una nueva
> Native Build cuando cambia algo **nativo** (plugins, permisos, ícono, versión).

### Íconos y splash
```bash
npm install -D @capacitor/assets
# Colocar logo 1024x1024 y splash en resources/  (usar el isotipo Goospe de docs/08)
npx capacitor-assets generate
```

---

## 10. Checklist de "compila y funciona bien"

**Setup**
- [ ] `appId` confirmado con el equipo (`com.goospe.app`).
- [ ] `https://app.goospe.com` sirviendo con HTTPS válido.
- [ ] Capacitor 7 + plataformas añadidas; `npx cap sync` sin errores.
- [ ] `webDir` con fallback offline.

**Config/permisos**
- [ ] `server.url` = prod; `allowNavigation` incluye Supabase.
- [ ] Permisos de geo y cámara en `Info.plist` + `AndroidManifest.xml`.
- [ ] `viewport-fit=cover` + safe areas (notch) revisados en el WebView.

**Funcional (probar en dispositivo)**
- [ ] Feed carga, scroll-snap fluido en WebView.
- [ ] Login email/contraseña: sesión persiste al cerrar/reabrir la app.
- [ ] Geolocalización pide permiso nativo y centra en ubicación real.
- [ ] Subir foto de lugar abre cámara/galería.
- [ ] Conserje (SSE) responde dentro del WebView.
- [ ] Enlaces externos abren navegador, no rompen el shell.
- [ ] Botón "atrás" de Android navega y no cierra la app de golpe.

**Appflow**
- [ ] Repo conectado; `android/` e `ios/` versionados.
- [ ] Native Build Android (`.aab`) firmada ✅.
- [ ] Native Build iOS (`.ipa`) firmada ✅.
- [ ] Subida a Play Console / App Store Connect.

---

## 11. Riesgos / gotchas conocidos

- **Apple "minimal functionality"**: una app que es "solo una web" puede ser rechazada. Mitigación:
  los plugins nativos (geo, cámara, push, deep links, splash) y la experiencia full-screen la
  hacen defendible como app real. Documentar el valor nativo en la review.
- **Cookies de sesión en WebView iOS (ITP)**: validar que la sesión Supabase persiste; si hay
  problemas, considerar storage de token nativo (`@capacitor/preferences`).
- **CORS / `allowNavigation`**: si auth o storage Supabase fallan en el WebView, casi siempre es
  un dominio faltante en `allowNavigation`.
- **OAuth Google** (diferido en `docs/09`): el flujo redirect en WebView requiere
  `@capacitor/browser` + deep link de retorno. No implementar hasta que se reactive Google OAuth.
- **Versionado nativo**: subir `version`/`versionCode` (Android) y `CFBundleVersion` (iOS) en cada
  build a tienda, o Appflow/tienda rechaza el binario.

---

## 12. Orden de ejecución sugerido

1. Confirmar `appId` + dominio prod con el equipo.
2. Instalar Capacitor 7, añadir plataformas, crear `capacitor.config.ts` + `webDir`.
3. Permisos (geo, cámara) + `cap sync` + probar Android local (Android Studio).
4. Íconos/splash con `@capacitor/assets`.
5. Commit + conectar Appflow + primera Native Build Android.
6. Certificados Apple → Native Build iOS en Appflow.
7. Deep links + (opcional) push como Fase 2.
8. Entrega a tiendas.

---

*Estrategia A (WebView remoto) = mínimo riesgo, cero refactor, listo para piloto. La Estrategia B
(export estático + offline + Live Updates) queda documentada como evolución futura si el producto
lo pide.*
