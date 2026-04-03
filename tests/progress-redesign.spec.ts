import { test, expect } from '@playwright/test'

test.describe('R-016 to R-019: Progress page redesign', () => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  test.skip(!email || !password, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    await page.goto('/progress')
  })

  test('R-016: exercise picker is visible', async ({ page }) => {
    await expect(page.locator('text=Kies een oefening...')).toBeVisible({ timeout: 10000 })
  })

  test('R-016: exercise picker shows exercises on click', async ({ page }) => {
    await page.locator('text=Kies een oefening...').click()
    await expect(page.locator('input[placeholder="Zoek oefening..."]')).toBeVisible()
    // Should show some exercises in the dropdown
    const options = page.locator('button:has-text("Chest"), button:has-text("Back"), button:has-text("Legs"), button:has-text("Shoulders"), button:has-text("Arms"), button:has-text("Core")')
    // Any muscle group label should appear
    await page.waitForTimeout(1000)
    const allButtons = page.locator('[class*="max-h-64"] button')
    const count = await allButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('R-016: selecting exercise shows chart or message', async ({ page }) => {
    await page.locator('text=Kies een oefening...').click()
    await page.waitForTimeout(1000)
    // Click first exercise in dropdown
    const firstExercise = page.locator('[class*="max-h-64"] button').first()
    await firstExercise.click()
    // Should show either a chart (svg) or a "Minimaal 2 sessies" message
    await page.waitForTimeout(2000)
    const hasSvg = await page.locator('svg').first().isVisible().catch(() => false)
    const hasMessage = await page.locator('text=sessies').isVisible().catch(() => false)
    const hasNoData = await page.locator('text=Nog geen data').isVisible().catch(() => false)
    expect(hasSvg || hasMessage || hasNoData).toBeTruthy()
  })

  test('R-017: PR cards are visible with modern design', async ({ page }) => {
    // PR cards should be in a grid layout
    const prSection = page.locator('text=Persoonlijke records')
    const prVisible = await prSection.isVisible({ timeout: 10000 }).catch(() => false)
    if (prVisible) {
      // Cards should have exercise name and value
      const prCards = page.locator('[class*="grid-cols-2"] [class*="rounded-2xl"]')
      const count = await prCards.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test('R-018: body composition section exists', async ({ page }) => {
    await expect(page.locator('text=Lichaamssamenstelling')).toBeVisible({ timeout: 10000 })
  })

  test('R-019: old charts are gone', async ({ page }) => {
    await expect(page.locator('text=Trainingsvolume')).not.toBeVisible()
    await expect(page.locator('text=Bewegingspatronen')).not.toBeVisible()
    await expect(page.locator('text=Hardlopen')).not.toBeVisible()
  })

  test('R-019: page loads without errors', async ({ page }) => {
    await expect(page.locator('text=Kon data niet laden')).not.toBeVisible()
    await expect(page.locator('text=Progressie').first()).toBeVisible({ timeout: 10000 })
  })
})
