import type { Config } from 'tailwindcss'

// Identidad visual Goospe — ver docs/08-identidad-visual.md y docs/10-rediseno-implementacion.md
const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        goospe: {
          green: '#2dc186',        // verde primario (anillo del isotipo, tagline "sugiere")
          'green-light': '#27f1a0', // mint brillante (fin del gradiente)
          'green-dark': '#28af79',  // verde profundo (inicio del gradiente)
          gray: '#636363',          // gris del wordmark
        },
        // Tokens semánticos de superficie (claro/oscuro). Mapean a CSS vars en globals.css.
        surface: 'rgb(var(--surface) / <alpha-value>)',   // fondo de pantalla
        card: 'rgb(var(--card) / <alpha-value>)',          // tarjetas
        line: 'rgb(var(--line) / <alpha-value>)',          // bordes/divisores
        fg: 'rgb(var(--fg) / <alpha-value>)',              // texto principal
        'fg-soft': 'rgb(var(--fg-soft) / <alpha-value>)',  // texto secundario
        muted: 'rgb(var(--muted) / <alpha-value>)',        // labels/uppercase
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'goospe-gradient': 'linear-gradient(135deg, #28af79 0%, #27f1a0 100%)',
        'goospe-paper': 'radial-gradient(120% 80% at 50% -10%, #EFEBE2 0%, #E5E1D8 55%, #DED9CE 100%)',
      },
    },
  },
  plugins: [],
}

export default config
