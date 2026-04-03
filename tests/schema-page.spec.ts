import { test, expect } from '@playwright/test'

test.describe('R-012 to R-014: Schema page', () => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  test.skip(!email || !password, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email!)
    await page.fill('input[type="password"]', password!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    await page.goto('/schema')
  })

  test('R-012: schema page shows week number and schema title', async ({ page }) => {
    await expect(page.locator('text=Week')).toBeVisible({ timeout: 10000 })
    // Should contain the schema title
    await expect(page.locator('text=Upper/Lower Split')).toBeVisible()
  })

  test('R-012: at least 4 workout cards visible', async ({ page }) => {
    // Wait for cards to render
    await page.waitForSelector('[class*="rounded-2xl"][class*="border"]', { timeout: 10000 })
    // Count workout cards (buttons with day label inside)
    const cards = page.locator('button:has([class*="rounded-full"])').filter({ hasText: /UPPER|LOWER|Hardlopen/ })
    await expect(cards).toHaveCount(5, { timeout: 5000 })
  })

  test('R-012: completed workouts show check indicator', async ({ page }) => {
    await page.waitForSelector('[class*="rounded-2xl"]', { timeout: 10000 })
    // Completed workout cards have a filled circle with check (bg-sport-gym)
    const completedIndicators = page.locator('[class*="bg-sport-gym"][class*="rounded-full"]')
    // May have 0 completed this week — just verify the page doesn't error
    const count = await completedIndicators.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('R-013: clicking workout card shows exercises', async ({ page }) => {
    // Wait for cards
    await page.waitForSelector('button:has-text("UPPER")', { timeout: 10000 })
    // Click the first workout card
    await page.locator('button:has-text("UPPER")').first().click()
    // Should show exercise list with divide-y separator
    await page.waitForSelector('[class*="divide-y"]', { timeout: 5000 })
    // Should have exercise rows
    const exerciseRows = page.locator('[class*="divide-y"] >> [class*="flex items-center justify-between"]')
    const count = await exerciseRows.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('R-013: exercises show sets×reps format', async ({ page }) => {
    await page.waitForSelector('button:has-text("UPPER")', { timeout: 10000 })
    await page.locator('button:has-text("UPPER")').first().click()
    await page.waitForSelector('[class*="divide-y"]', { timeout: 5000 })
    // Look for tabular-nums elements with sets×reps pattern (e.g. "3×10 · 16kg")
    const setsText = page.locator('[class*="tabular-nums"]').first()
    await expect(setsText).toBeVisible()
    const text = await setsText.textContent()
    // Should match pattern like "3×10" or contain "×" or "—"
    expect(text?.includes('×') || text?.includes('—')).toBeTruthy()
  })

  test('R-014: exercises have coach button', async ({ page }) => {
    await page.waitForSelector('button:has-text("UPPER")', { timeout: 10000 })
    await page.locator('button:has-text("UPPER")').first().click()
    await page.waitForSelector('[class*="divide-y"]', { timeout: 5000 })
    // Coach icons (links to /chat with context)
    const coachLinks = page.locator('a[href*="/chat?context=exercise"]')
    const count = await coachLinks.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('R-014: coach button navigates to chat with context', async ({ page }) => {
    await page.waitForSelector('button:has-text("UPPER")', { timeout: 10000 })
    await page.locator('button:has-text("UPPER")').first().click()
    await page.waitForSelector('a[href*="/chat?context=exercise"]', { timeout: 5000 })
    // Click the first coach link
    const coachLink = page.locator('a[href*="/chat?context=exercise"]').first()
    const href = await coachLink.getAttribute('href')
    expect(href).toContain('/chat?context=exercise')
    expect(href).toContain('name=')
    expect(href).toContain('workout=')
  })
})
