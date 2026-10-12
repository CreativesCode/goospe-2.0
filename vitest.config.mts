import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests unitarios de lógica pura (sin DOM ni red). Los e2e irán aparte con Playwright.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' lanza fuera de un bundle de servidor de Next: en tests es un módulo vacío.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
