import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // Each database test file boots its own in-process Postgres and replays every migration. Several files start at once,
    // so the default 10 s hook limit fails on a busy machine.
    hookTimeout: 120_000,
    testTimeout: 60_000,
    // Every database file replays all migrations in memory. Two workers keep the run inside 8 GB machines.
    // CI and developers can still override this with --maxWorkers.
    maxWorkers: 2,
  },
})
