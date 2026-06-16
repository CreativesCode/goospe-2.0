import type { Config } from 'tailwindcss'

// Identidad visual Goospe — ver docs/08-identidad-visual.md
const config: Config = {
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
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'goospe-gradient': 'linear-gradient(135deg, #28af79 0%, #27f1a0 100%)',
      },
    },
  },
  plugins: [],
}

export default config
