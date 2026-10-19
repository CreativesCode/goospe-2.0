import type { Config } from 'tailwindcss'

// Identidad visual Goospe — ver docs/08-identidad-visual.md y docs/10-rediseno-implementacion.md
const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Breakpoints del rediseño (docs/design/design_handoff_goospe_rediseno): móvil < 720,
      // tablet 720–1099, web ≥ 1100. El corte intermedio de 900 px se usa como `min-[900px]:`.
      screens: {
        md: '720px',
        lg: '1100px',
      },
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
        ink: 'rgb(var(--ink) / <alpha-value>)',            // texto verde (contraste AA en cada tema)
        deep: 'rgb(var(--deep) / <alpha-value>)',          // superficies oscuras en ambos temas
        'deep-soft': 'rgb(var(--deep-soft) / <alpha-value>)', // texto secundario sobre deep
        ph: 'rgb(var(--ph) / <alpha-value>)',              // fondo mientras carga una foto
        tint: 'var(--tint)',                               // relleno verde suave
        tint2: 'var(--tint2)',                             // relleno verde del estado activo
        'on-brand': '#0B2A1D',                             // texto sobre #2dc186 / gradiente
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'goospe-gradient': 'linear-gradient(135deg, #28af79 0%, #27f1a0 100%)',
        'goospe-paper': 'radial-gradient(120% 80% at 50% -10%, var(--paper-a) 0%, var(--paper-b) 100%)',
        // Estado sin foto en superficies oscuras grandes (mazo del feed, portada de la ficha).
        'goospe-deep': 'radial-gradient(120% 90% at 25% 15%, #2dc186 0%, #1F8A5E 45%, #0B2A1D 100%)',
      },
      boxShadow: {
        float: '0 30px 60px -20px rgba(11, 42, 29, 0.45)',
        bar: '0 12px 32px -16px rgba(28, 28, 26, 0.25)',
      },
    },
  },
  plugins: [],
}

export default config
