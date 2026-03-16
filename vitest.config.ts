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
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        // Start with achievable thresholds, increase over time
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
      include: [
        'lib/**/*.ts',
        'app/api/**/*.ts',
      ],
      exclude: [
        'lib/db/schema*.sql',
        'lib/db/init.ts',
        'lib/db/connection.ts',
        'lib/db/seed*.ts',
        'lib/db/benchmark.ts',
        'lib/db/backup*.ts',
        'lib/db/batch.ts',
        'lib/db/monitor.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        'tests/**',
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
