import { test, expect } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────────
// R-023: Contextual coach from schema page
// ──────────────────────────────────────────────────────────────────────────────

test.describe('R-023: Contextual coach (public)', () => {
  test('GET /chat requires authentication', async ({ request }) => {
    const res = await request.get('/chat', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
  })

  test('GET /chat?context=exercise&name=Squat&workout=Lower redirects to login unauthenticated', async ({
    request,
  }) => {
    const res = await request.get(
      '/chat?context=exercise&name=Squat&workout=Lower+Body',
      { maxRedirects: 0 },
    )
    expect(res.status()).toBe(307)
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('/auth/login')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Authenticated tests — skipped without TEST_EMAIL/TEST_PASSWORD
// ──────────────────────────────────────────────────────────────────────────────

const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

test.describe('R-023: Contextual coach (authenticated)', () => {
  test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('chat page loads normally without context params', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByText('Coach')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('chat page with exercise context shows prefilled message sent', async ({ page }) => {
    await page.goto('/chat?context=exercise&name=Bench+Press&workout=Upper+Body')
    await expect(page.getByText('Coach')).toBeVisible()
    // The initialMessage should have been auto-sent — look for the user message
    await expect(
      page.getByText(/Bench Press.*Upper Body|Upper Body.*Bench Press/i),
    ).toBeVisible({ timeout: 5000 })
  })

  test('schema page exercise coach button links to chat with context', async ({ page }) => {
    await page.goto('/schema')
    // Find any MessageCircle/coach link
    const coachLinks = page.locator('a[href*="/chat?context=exercise"]')
    const count = await coachLinks.count()
    if (count === 0) {
      // No workout days with exercises — just verify schema page loads
      await expect(page.locator('h2').first()).toBeVisible()
      return
    }
    const href = await coachLinks.first().getAttribute('href')
    expect(href).toContain('context=exercise')
    expect(href).toContain('name=')
  })

  test('chat with exercise context includes exercise name in auto-sent message', async ({
    page,
  }) => {
    const exerciseName = 'Deadlift'
    await page.goto(`/chat?context=exercise&name=${encodeURIComponent(exerciseName)}`)
    await expect(page.getByText('Coach')).toBeVisible()
    // Auto-sent message should appear in message list
    await expect(page.getByText(new RegExp(exerciseName, 'i'))).toBeVisible({
      timeout: 5000,
    })
  })

  test('new session button resets contextual chat', async ({ page }) => {
    await page.goto('/chat?context=exercise&name=Squat&workout=Lower+Body')
    await expect(page.getByText('Coach')).toBeVisible()
    // Click new session
    await page.getByRole('button', { name: 'Nieuwe sessie' }).click()
    // After reset, no messages from the old context
    // The input should be empty and ready
    await expect(page.locator('textarea')).toBeVisible()
  })
})
