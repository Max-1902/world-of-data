import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Component tests (.tsx) opt into jsdom with a `// @vitest-environment jsdom` pragma; everything else stays on node.
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // Every test starts from a clean slate: no leaked mocks, stubbed globals, or fake timers.
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/services/**', 'src/lib/**', 'api/**'],
      exclude: ['**/*.test.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
})
