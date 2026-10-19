---
name: pruebas-y-despliegue
description: Cómo probar y desplegar sin pisar al usuario ni gastar
type: reference
---

- Despliegue: push a `main` en github.com/CreativesCode/goospe-2.0 → Vercel → https://goospe.vercel.app
- Antes de subir: `npm run typecheck`, `npm test`, `npm run build`. Si corrió un dev server,
  borrar `.next/dev/types` antes del build.
- El usuario usa el puerto 3000 con su propio servidor: las pruebas van en otro puerto (3211).
- Cuentas de prueba: una de usuario normal (demo) y una de admin; las credenciales no se
  guardan en el repo.
- No lanzar cargas de zona desde pruebas (`/admin/loader`) y limitar llamadas de IA de pago.
- `proxy.ts` debe vivir en `src/` (Next 16 con carpeta `src`).
- En pruebas, nunca aprobar una propuesta de lugar: publica un lugar real.
- Al sustituir texto con regex desde un heredoc de shell, las barras invertidas se pierden: usar la herramienta de edición.
- Un `loading.tsx` en la raíz convierte los `notFound()` en respuestas 200 (404 falsos): los loaders van por sección, nunca en `src/app/`.
- Solo 200 fichas de lugar se generan en el build; el resto on-demand. Con las ~3.700 el build pasaba de 6 minutos y daba timeouts.
- En Zod 4, `z.unknown().transform()` dentro de `z.object` vuelve la clave obligatoria: poner `.optional()` antes.
- En pruebas, nunca enviar el formulario de eliminar cuenta con datos válidos.
- El puerto 3000 no siempre es Goospe: el 2026-10-13 lo ocupaba Docker de otro proyecto (todo redirigía a `/api/login?redirectUrl=`). Comprobar con `curl` antes de dar algo por roto.
- `tsc` y `eslint` no detectan pasar un componente (p. ej. un icono de Lucide) desde un server component a uno con `'use client'`: falla al renderizar ("Functions cannot be passed directly to Client Components"). Las filas o tarjetas que reciben `icon` van en módulos de servidor, o el cliente importa su propia tabla de iconos. Toda pantalla nueva se abre una vez en el navegador.
- Contenedor con scroll-snap cuya lista se reemplaza (tanda SSR → lista real): el navegador re-ajusta el snap siguiendo a la tarjeta que estaba en pantalla y el mazo aparece en otra posición. Se evita remontando el contenedor (`key`) al cambiar de lista; `overflow-anchor: none` no basta.
- Playwright MCP solo guarda capturas dentro del repo: usar `.playwright-mcp/` (ignorado por git).
