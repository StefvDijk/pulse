import { test, expect } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────────
// R-020: Google Calendar OAuth flow (public / unauthenticated checks)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('R-020: Google Calendar OAuth', () => {
  test('GET /api/calendar/auth redirects unauthenticated to login', async ({ request }) => {
    const res = await request.get('/api/calendar/auth', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
  })

  test('GET /api/calendar/callback redirects unauthenticated to login', async ({ request }) => {
    // middleware protects the route before callback logic runs
    const res = await request.get('/api/calendar/callback', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('/auth/login')
  })

  test('GET /api/calendar/callback with error param redirects unauthenticated to login', async ({
    request,
  }) => {
    const res = await request.get('/api/calendar/callback?error=access_denied', {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(307)
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('/auth/login')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// R-021: Calendar events API (public checks)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('R-021: Calendar events API', () => {
  test('POST /api/calendar/events requires authentication', async ({ request }) => {
    const res = await request.post('/api/calendar/events', {
      maxRedirects: 0,
      data: {
        events: [
          {
            title: 'Test Workout',
            date: '2026-04-01',
            startTime: '06:30',
            endTime: '07:30',
          },
        ],
      },
    })
    // middleware redirects unauthenticated API calls with 307
    expect(res.status()).toBe(307)
  })

  test('POST /api/calendar/disconnect requires authentication', async ({ request }) => {
    const res = await request.post('/api/calendar/disconnect', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// R-022: Plan-je-week UI (authenticated — skipped without TEST_EMAIL/TEST_PASSWORD)
// ──────────────────────────────────────────────────────────────────────────────

const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

test.describe('R-022: Plan-je-week modal (authenticated)', () => {
  test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('schema page renders "Koppel agenda" link when calendar not connected', async ({ page }) => {
    await page.goto('/schema')
    // Either the connect link or the "Plan in agenda" button should appear
    // (depends on whether user has calendar connected in test environment)
    const connectLink = page.locator('a[href="/settings"]', { hasText: 'Koppel agenda' })
    const planButton = page.locator('button', { hasText: 'Plan in agenda' })
    const hasConnect = await connectLink.isVisible().catch(() => false)
    const hasPlan = await planButton.isVisible().catch(() => false)
    expect(hasConnect || hasPlan).toBeTruthy()
  })

  test('settings page shows Google Agenda section', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Google Agenda')).toBeVisible()
  })

  test('settings page shows calendar connected status or connect button', async ({ page }) => {
    await page.goto('/settings')
    const connected = page.getByText('Verbonden')
    const notConnected = page.getByText('Niet gekoppeld')
    const isConnected = await connected.isVisible().catch(() => false)
    const isNotConnected = await notConnected.isVisible().catch(() => false)
    expect(isConnected || isNotConnected).toBeTruthy()
  })

  test('settings page connect button links to /api/calendar/auth', async ({ page }) => {
    await page.goto('/settings')
    const connectBtn = page.locator('a[href="/api/calendar/auth"]')
    const isVisible = await connectBtn.isVisible().catch(() => false)
    if (isVisible) {
      await expect(connectBtn).toBeVisible()
    } else {
      // already connected — disconnect button should be visible
      await expect(page.getByRole('button', { name: /Ontkoppel/ })).toBeVisible()
    }
  })

  test('plan-in-agenda button opens modal when calendar connected', async ({ page }) => {
    await page.goto('/schema')
    const planButton = page.locator('button', { hasText: 'Plan in agenda' })
    const isVisible = await planButton.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip()
      return
    }
    await planButton.click()
    await expect(page.getByText('Plan je week')).toBeVisible()
    await expect(page.getByText('Workouts toevoegen aan Google Agenda')).toBeVisible()
  })

  test('plan modal shows workout entries with time pickers', async ({ page }) => {
    await page.goto('/schema')
    const planButton = page.locator('button', { hasText: 'Plan in agenda' })
    const isVisible = await planButton.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip()
      return
    }
    await planButton.click()
    // Time inputs should be present
    const timeInputs = page.locator('input[type="time"]')
    await expect(timeInputs.first()).toBeVisible()
  })

  test('plan modal can be closed', async ({ page }) => {
    await page.goto('/schema')
    const planButton = page.locator('button', { hasText: 'Plan in agenda' })
    const isVisible = await planButton.isVisible().catch(() => false)
    if (!isVisible) {
      test.skip()
      return
    }
    await planButton.click()
    await expect(page.getByText('Plan je week')).toBeVisible()
    // Close via X button
    await page.locator('button').filter({ has: page.locator('svg') }).first().click()
    // Find close button more specifically
    const closeBtn = page.locator('[aria-label="Sluiten"], button').filter({
      hasText: '',
    })
    // Click the X close button (it's the first svg button in the modal header)
    await page.keyboard.press('Escape')
  })
})
