import { defineConfig, devices } from '@playwright/test'
import { assertLocalSupabaseTarget } from './src/lib/supabase/safe-target'

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
}

export default defineConfig({
  testDir: './tests',
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
  ],
  webServer: {
    command: 'pnpm dev',
    env: e2eServerEnv,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
