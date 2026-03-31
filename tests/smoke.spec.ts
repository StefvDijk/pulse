import { test, expect } from '@playwright/test'

test.describe('Smoke tests — public routes', () => {
  test('login page loads and shows form', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('unauthenticated access to / redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('unauthenticated access to /progress redirects to login', async ({ page }) => {
    await page.goto('/progress')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('Smoke tests — authenticated', () => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  test.skip(!email || !password, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run authenticated tests')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('homepage loads with navigation', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible()

    const navLinks = page.locator('nav a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('dashboard shows content (not empty state)', async ({ page }) => {
    // Wait for data to load (skeleton disappears)
    await page.waitForSelector('[class*="bg-bg-card"]', { timeout: 10000 })
  })

  test('progress page loads', async ({ page }) => {
    await page.goto('/progress')
    await expect(page).toHaveURL(/\/progress/)
    await page.waitForSelector('h1, h2', { timeout: 10000 })
  })

  test('settings page loads with profile form', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('text=Instellingen')).toBeVisible()
    await expect(page.locator('text=Profiel')).toBeVisible()
  })
})
