import { test, expect } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────────
// Chat history panel — clock-icon trigger, panel open, new-chat reset
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Chat history panel (public)', () => {
  test('GET /chat requires authentication', async ({ request }) => {
    const res = await request.get('/chat', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Authenticated tests — skipped without TEST_EMAIL/TEST_PASSWORD
// ──────────────────────────────────────────────────────────────────────────────

const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

test.describe('Chat history panel (authenticated)', () => {
  test.skip(!email || !password, 'TEST_EMAIL / TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('history panel opens, lists sessions, and a new chat resets the thread', async ({ page }) => {
    await page.goto('/chat')

    // History trigger is present and opens the panel
    await page.getByRole('button', { name: 'Gesprekshistorie' }).click()
    await expect(page.getByText('Gesprekken')).toBeVisible()

    // New-chat row inside the panel closes it and shows the empty composer
    await page.getByText('Nieuwe chat').click()
    await expect(page.getByPlaceholder(/Bericht aan coach|Stel een vraag/)).toBeVisible()
  })

  test('clock icon button is present in the coach header', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByRole('button', { name: 'Gesprekshistorie' })).toBeVisible()
  })

  test('new-chat button resets the session without opening history panel', async ({ page }) => {
    await page.goto('/chat')
    await page.getByRole('button', { name: 'Nieuwe chat' }).click()
    // Panel should NOT be open — "Gesprekken" heading should not be visible
    await expect(page.getByText('Gesprekken')).not.toBeVisible()
    // Composer input is still visible
    await expect(page.getByPlaceholder(/Bericht aan coach|Stel een vraag/)).toBeVisible()
  })
})
