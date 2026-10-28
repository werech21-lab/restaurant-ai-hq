import { defineConfig, devices } from '@playwright/test'

const host = '127.0.0.1'
const port = 4010

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'line',
  use: {
    baseURL: `http://${host}:${port}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/e2e-local.mjs',
    url: `http://${host}:${port}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: '' },
  },
})
