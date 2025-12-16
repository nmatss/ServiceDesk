import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'servicedesk-unit',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.{js,ts}',
        '**/types/**',
        '**/*.d.ts',
      ],
    },
    include: ['**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}', '**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: [
      'node_modules/**',
      '.next/**',
      'playwright-report/**',
      'tests/**/*.spec.ts', // Exclude Playwright E2E tests
      'tests/setup.ts', // Exclude test setup file
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
