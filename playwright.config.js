import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const defaultBaseUrl = 'http://127.0.0.1:4173'
const baseURL = process.env.E2E_APP_URL ?? defaultBaseUrl
const localSupabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const localSupabasePublishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? 'e2e-local-publishable-key'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.js',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 1 : 2,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        env: {
          ...process.env,
          VITE_SUPABASE_URL: localSupabaseUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: localSupabasePublishableKey,
        },
        reuseExistingServer: !isCi,
        timeout: 120_000,
        url: `${defaultBaseUrl}/login`,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
})
