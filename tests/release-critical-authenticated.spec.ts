import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const email = process.env.TEST_USER_EMAIL
const password = process.env.TEST_USER_PASSWORD

test.describe('release-critical authenticated surfaces', () => {
  test.skip(!email || !password, 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('check-in and trends render without an auth redirect or server error', async ({ page }) => {
    await page.goto('/check-in')
    await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible()
    await expect(page).not.toHaveURL(/\/auth\/login/)

    await page.goto('/trends')
    await expect(page.getByRole('heading', { name: 'Trends' })).toBeVisible()
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })

  test('the newest workout opens through the authenticated feed contract', async ({ page }) => {
    const response = await page.request.get('/api/workouts?page=1')
    expect(response.ok()).toBe(true)
    const body = await response.json() as { workouts: Array<{ id: string; title: string }> }
    expect(body.workouts.length).toBeGreaterThan(0)

    const workout = body.workouts[0]!
    await page.goto(`/workouts/${workout.id}`)
    await expect(page.getByRole('heading', { name: workout.title })).toBeVisible()
  })
})

test('Apple Health ingest rejects missing credentials without mutating data', async ({ request }) => {
  const response = await request.post('/api/ingest/apple-health', { data: {} })
  expect(response.status()).toBe(401)
  await expect(response.json()).resolves.toMatchObject({
    error: 'Missing or invalid Authorization header',
  })
})

test('authorized Apple Health ingest records a durable local sync', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One database contract run is sufficient')

  const supabaseUrl = process.env.PULSE_E2E_SUPABASE_URL!
  const serviceRoleKey = process.env.PULSE_E2E_SUPABASE_SERVICE_ROLE_KEY!
  const userId = process.env.PULSE_E2E_USER_ID!
  const healthToken = process.env.PULSE_E2E_HEALTH_TOKEN ?? 'pulse-local-e2e-health-token'
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const syncStartedAt = new Date()

  const { data: before, error: beforeError } = await admin
    .from('user_settings')
    .select('last_apple_health_sync_at')
    .eq('user_id', userId)
    .single()
  expect(beforeError).toBeNull()

  try {
    const response = await request.post('/api/ingest/apple-health', {
      headers: { Authorization: `Bearer ${healthToken}` },
      data: { data: { metrics: [], workouts: [] } },
    })
    expect(response.ok()).toBe(true)
    await expect(response.json()).resolves.toMatchObject({
      processed: {
        runs: 0,
        walks: 0,
        padel: 0,
        activity: 0,
        activities: 0,
        sleep: 0,
        bodyWeight: 0,
        bodyComposition: 0,
        gymCorrelations: 0,
      },
      errors: [],
    })

    const { data: after, error: afterError } = await admin
      .from('user_settings')
      .select('last_apple_health_sync_at')
      .eq('user_id', userId)
      .single()
    expect(afterError).toBeNull()
    expect(new Date(after!.last_apple_health_sync_at!).getTime()).toBeGreaterThanOrEqual(
      syncStartedAt.getTime(),
    )
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250))
    await admin
      .from('user_settings')
      .update({ last_apple_health_sync_at: before!.last_apple_health_sync_at })
      .eq('user_id', userId)
    await admin
      .from('sync_runs')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'apple_health')
      .gte('started_at', syncStartedAt.toISOString())
  }
})
