import { expect, test } from '@playwright/test'

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
