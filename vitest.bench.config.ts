// Config for `npm run bench:analyst` only (scripts/bench-analyst.run.ts). Unlike vitest.config.ts it does NOT install
// the hermetic setup that makes any unmocked fetch throw, because the benchmark calls the real model and live data on
// purpose. `npm test` never includes it.
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['scripts/bench-analyst.run.ts'],
    environment: 'node',
    testTimeout: 30 * 60_000,
  },
})
