# Plantillas de email de Supabase Auth

HTML de marca para los cuatro correos que envía Supabase Auth. **No están aplicadas**: son
archivos listos para pegar. El resto de los emails (reclamos, informe semanal, alertas) no pasan
por aquí: los envía la app con Resend (`src/lib/email/`, `src/emails/`).

| Archivo | Plantilla en el panel | Asunto sugerido | Enlace |
|---|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirma tu correo en Goospe | `type=email` → `/onboarding` |
| `reset-password.html` | Reset password | Restablece tu contraseña de Goospe | `type=recovery` → `/update-password` |
| `magic-link.html` | Magic link | Tu enlace para entrar a Goospe | `type=email` → `/feed` |
| `change-email.html` | Change email address | Confirma tu nuevo correo en Goospe | `type=email_change` → `/profile` |

## Cómo enlazan

Todas apuntan a `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…&next=…`.
`src/app/auth/callback/route.ts` ya maneja ese formato (`verifyOtp` con `token_hash` + `type`) y
redirige a `next` (solo rutas internas). **No hay que cambiar código.**

Se usa `token_hash` y no `{{ .ConfirmationURL }}` a propósito: el enlace funciona aunque se abra
en otro navegador o dispositivo (el flujo PKCE de `ConfirmationURL` exige el mismo navegador que
inició el registro, y fallaba al abrir el correo en el teléfono).

`next` va fijo en cada plantilla. No se usa `{{ .RedirectTo }}` porque es una URL absoluta y el
callback solo acepta rutas internas.

## Qué configurar en el panel de Supabase

1. **Authentication → URL Configuration**
   - *Site URL*: `https://goospe.vercel.app` (sin barra final). Es el `{{ .SiteURL }}` de las
     plantillas: si queda en `localhost`, los enlaces de producción apuntan a localhost.
   - *Redirect URLs*: `https://goospe.vercel.app/auth/callback` (y `http://localhost:3000/auth/callback`
     para desarrollo). Lo siguen usando `signUp` y `resetPasswordForEmail` como `redirectTo`.
2. **Authentication → Emails → SMTP Settings** (sin esto Supabase envía desde su remitente
   compartido, con tope de pocos correos por hora y sin tu marca)
   - Host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key de Resend.
   - *Sender email*: una dirección del dominio verificado en Resend (la misma de `EMAIL_FROM`).
   - *Sender name*: `Goospe`.
3. **Authentication → Emails → Templates**: en cada una, pegar el HTML del archivo y el asunto
   de la tabla.
4. **Authentication → Rate Limits**: con SMTP propio, subir "emails per hour" según el plan de Resend.
5. Confirmar que **Confirm email** está activado en *Sign In / Providers → Email* (pendiente S14
   del doc 15).

## Probar

Registrar una cuenta nueva, pedir "olvidé mi contraseña" y cambiar el correo desde una cuenta de
prueba. En cada caso el enlace debe dejar la sesión iniciada en la ruta de la tabla.

Si un cliente de correo corporativo "gasta" el enlace al previsualizarlo (escáneres de seguridad
que abren los enlaces), la persona verá "el enlace expiró": puede pedir otro. Si pasa seguido, la
alternativa es mostrar el código de 6 dígitos (`{{ .Token }}`) y un formulario para escribirlo.
