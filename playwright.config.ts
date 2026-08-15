import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { assertLocalSupabaseTarget } from './src/lib/supabase/safe-target'

if (existsSync('.env.test.local')) loadEnvFile('.env.test.local')

function requireE2eEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Refusing Playwright: ${name} is missing.`)
  return value
}

const e2eServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: assertLocalSupabaseTarget(
    process.env.PULSE_E2E_SUPABASE_URL,
    'Playwright',
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireE2eEnv('PULSE_E2E_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireE2eEnv('PULSE_E2E_SUPABASE_SERVICE_ROLE_KEY'),
  PULSE_USER_ID: requireE2eEnv('PULSE_E2E_USER_ID'),
  HEALTH_EXPORT_AUTH_TOKEN:
    process.env.PULSE_E2E_HEALTH_TOKEN ?? 'pulse-local-e2e-health-token',
}

requireE2eEnv('TEST_USER_EMAIL')
requireE2eEnv('TEST_USER_PASSWORD')

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-webkit',
      use: devices['iPhone 14'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    env: e2eServerEnv,
    url: 'http://localhost:3000',
    // Never attach to a manually started app: it may have loaded `.env.local`
    // and point at production instead of the validated test target above.
    reuseExistingServer: false,
    timeout: 30000,
  },
})
