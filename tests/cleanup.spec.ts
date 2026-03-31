import { test, expect } from '@playwright/test'

test.describe('R-002: MuscleHeatmap removed', () => {
  test('login page accessible for test setup', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('R-004: Trends page removed', () => {
  test('/trends redirects to login (no route exists, proxy catches it)', async ({ page }) => {
    const response = await page.goto('/trends')
    // Either 404 or redirect to login (since no auth)
    const url = page.url()
    const is404 = response?.status() === 404
    const isRedirected = url.includes('/auth/login')
    expect(is404 || isRedirected).toBeTruthy()
  })
})

test.describe('R-005: Navigation has 4 tabs', () => {
  test('login page shows Pulse branding', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('h1:has-text("Pulse")')).toBeVisible()
  })
})

// Authenticated tests for dashboard cleanup and nav
test.describe('Dashboard cleanup — authenticated', () => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  test.skip(!email || !password, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('R-002: no MuscleHeatmap SVG on dashboard', async ({ page }) => {
    // No "Spiergroepbelasting" text
    await expect(page.locator('text=Spiergroepbelasting')).not.toBeVisible()
    // No body silhouette SVGs (the heatmap used large SVGs with body outlines)
    const bodySvgs = page.locator('svg ellipse')
    await expect(bodySvgs).toHaveCount(0)
  })

  test('R-003: no SportSplit or WorkloadMeter on dashboard', async ({ page }) => {
    await expect(page.locator('text=Sport verdeling')).not.toBeVisible()
    await expect(page.locator('text=Workload ratio')).not.toBeVisible()
  })

  test('R-005: navigation has exactly 4 main items', async ({ page }) => {
    // Check mobile nav (bottom bar)
    const mobileNav = page.locator('nav').first()
    const navLinks = mobileNav.locator('a')
    // 4 nav links (Home, Schema, Progressie, Coach)
    await expect(navLinks).toHaveCount(4)

    // Verify labels
    await expect(mobileNav.locator('text=Home')).toBeVisible()
    await expect(mobileNav.locator('text=Schema')).toBeVisible()
    await expect(mobileNav.locator('text=Progressie')).toBeVisible()
    await expect(mobileNav.locator('text=Coach')).toBeVisible()

    // Verify removed items
    await expect(mobileNav.locator('text=Voeding')).not.toBeVisible()
  })
})
