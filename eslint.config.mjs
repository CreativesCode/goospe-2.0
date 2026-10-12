// ESLint 9 (flat config). `next lint` ya no existe en Next 16: se corre `eslint .` directo.
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Los plugins vienen dentro de eslint-config-next: se reutilizan esas mismas instancias para
// poder ajustar sus reglas (ESLint exige el plugin en el mismo bloque que la regla).
const pluginFrom = (configs, name) => configs.find((c) => c.plugins?.[name])?.plugins[name]
const reactHooks = pluginFrom(nextVitals, 'react-hooks')
const tsEslint = pluginFrom(nextTs, '@typescript-eslint')

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'android/**',
    'ios/**',
    'mobile/www/**',
    'etl/data/**',
    'public/**',
    '.claude/**',
    'docs/design/**',
    '.playwright-mcp/**',
    'next-env.d.ts',
  ]),
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tsEslint },
    rules: {
      // Variables sin usar: error, salvo las que empiezan por "_" (descartes a propósito).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Reglas nuevas del React Compiler (eslint-plugin-react-hooks 7): marcan patrones que hoy
      // funcionan y cuyo arreglo exige refactor. Quedan como aviso hasta abordarlas una a una.
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  {
    // Scripts sueltos en CommonJS (generadores de assets y catálogos).
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
])
