# 08 — Identidad Visual (Goospe)

> La marca **se conserva del proyecto original**: nombre, logo, paleta y tipografía. Es lo único
> que se hereda tal cual (el resto es código nuevo). Assets fuente:
> `C:\Local-Disc-D\Project\Goospe\resources`. Vectores ya integrados en `public/brand/`.

## Nombre y concepto

**Goospe** — wordmark en gris donde el doble **"oo"** es un **eslabón de cadena** (dos anillos
entrelazados; el derecho en verde). Evoca conexión + lugar. Tagline: **"sugiere"** en verde, que
encaja con el producto: *Goospe sugiere dónde ir*.

## Paleta

| Token | Hex | Uso |
|---|---|---|
| Verde primario | `#2dc186` | anillo del isotipo, tagline "sugiere", acentos, CTAs |
| Mint brillante | `#27f1a0` | fin del gradiente |
| Verde profundo | `#28af79` | inicio del gradiente |
| Gris wordmark | `#636363` | texto del logo, texto base de la app |
| Gradiente marca | `linear-gradient(135deg, #28af79 → #27f1a0)` | fondos (splash, héroes, login) |

En Tailwind: `text-goospe-green`, `bg-goospe-green`, `text-goospe-gray`, `bg-goospe-gradient`,
`goospe-green-light`, `goospe-green-dark` (definidos en `tailwind.config.ts`). También como CSS
vars en `globals.css` (`--goospe-green`, etc.).

## Tipografía

**Roboto** — Light 300 / Regular 400 / Medium 500. Auto-alojada desde los `.ttf` originales en
`src/app/fonts/` vía `next/font/local` en `src/app/layout.tsx` (sin dependencia de Google Fonts;
variable `--font-roboto`, expuesta como `font-sans`).

## Logo: variantes y cuándo usar

Todas en `public/brand/` (SVG):

| Archivo | Cuándo |
|---|---|
| `logo-color.svg` | wordmark gris + anillo verde, sobre **fondo claro** (default) |
| `logo-white.svg` | wordmark blanco, sobre **fondo verde/oscuro** |
| `logo-black.svg` | monocromo negro (impresión, alto contraste) |
| `logo-color-suggest.svg` / `logo-white-suggest.svg` | versión con el tagline **"sugiere"** |
| `isotipo-color.svg` / `isotipo-white.svg` | solo el eslabón (favicon, avatar, app icon, loader) |
| `favicon.svg` | favicon (también en `src/app/icon.svg`) |

## Splash / loader (nota de diseño heredada)

Del brief original (`resources/entrando.txt`), para cuando se construya el loader inicial:
- El isotipo hace una **animación infinita de flip horizontal 180°**, con una pausa corta entre vueltas.
- Una **barra de progreso verde** arriba indica el avance de sincronización inicial, sumando un punto
  por cada bloque sincronizado (categorías, ciudades, lugares ancla…). No es exacta pero mejora la UX percibida.

> Aplicar al construir el splash de la PWA (Fase 5 / add-mobile) y la pantalla de carga del feed.

## Inventario de assets fuente (no versionados aquí)

`resources/`: PSDs editables (`logos/*.psd`), exports PNG, fondos (`images/fondo1@2x.png`,
`improved background`), mockups de pantallas legacy (login/registro/splash) e iconos auxiliares
(pins, placeholders circulares). Útiles como referencia; los SVG son la fuente de verdad para la app.
