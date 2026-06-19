/**
 * Genera los assets fuente para `@capacitor/assets` desde el isotipo de marca.
 * Salida en `assets/`: icon-only, icon-foreground, icon-background, splash, splash-dark.
 * Paleta (docs/08): verde #2dc186, gradiente #28af79 → #27f1a0.
 *
 * Uso:  node scripts/gen-app-assets.cjs   →   luego  npx capacitor-assets generate
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SVG = fs.readFileSync(path.join(ROOT, 'public/brand/isotipo-white.svg'))
const OUT = path.join(ROOT, 'assets')
fs.mkdirSync(OUT, { recursive: true })

const GREEN = { r: 0x2d, g: 0xc1, b: 0x86, alpha: 1 }
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const DARK = { r: 0x0e, g: 0x1f, b: 0x18, alpha: 1 } // verde casi-negro para splash dark

// Rasteriza el isotipo blanco a un PNG transparente del ancho pedido.
async function mark(width) {
  return sharp(SVG, { density: 600 })
    .resize({ width: Math.round(width) })
    .png()
    .toBuffer()
}

// Lienzo cuadrado de color con el isotipo centrado.
async function squareWithMark(size, bg, markFraction) {
  const m = await mark(size * markFraction)
  const meta = await sharp(m).metadata()
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([
      {
        input: m,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .png()
    .toBuffer()
}

// Fondo con gradiente de marca (135°) del tamaño pedido.
function gradient(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#28af79"/><stop offset="1" stop-color="#27f1a0"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function splash(size, bg, dark) {
  const m = await mark(size * 0.32)
  const meta = await sharp(m).metadata()
  const base = dark
    ? sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    : sharp(await gradient(size))
  return base
    .composite([
      {
        input: m,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .png()
    .toBuffer()
}

;(async () => {
  // Fondo adaptativo: verde sólido de marca.
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: GREEN } })
    .png()
    .toFile(path.join(OUT, 'icon-background.png'))

  // Primer plano adaptativo: isotipo blanco dentro de la safe zone (60%).
  fs.writeFileSync(path.join(OUT, 'icon-foreground.png'), await squareWithMark(1024, TRANSPARENT, 0.6))

  // Ícono completo (iOS / legacy): verde + isotipo blanco.
  fs.writeFileSync(path.join(OUT, 'icon-only.png'), await squareWithMark(1024, GREEN, 0.64))

  // Splash claro (gradiente) y oscuro.
  fs.writeFileSync(path.join(OUT, 'splash.png'), await splash(2732, null, false))
  fs.writeFileSync(path.join(OUT, 'splash-dark.png'), await splash(2732, DARK, true))

  console.log('✓ assets generados en /assets')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
