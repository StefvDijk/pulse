import { expect, test } from '@playwright/test'

test('health screen does not present a recovery score without recovery inputs', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  test.skip(!email || !password, 'Local test credentials required')
  const readiness = {
    level: 'unknown', score: null, components: [{ key: 'acwr', delta: 8 }],
    todayWorkout: 'Upper A', tomorrowWorkout: null, acwr: 1,
    sleepMinutes: null, restingHR: null, hrv: null, recentSessions: 1,
  }
  await page.route('**/api/readiness', route => route.fulfill({ json: readiness }))
  await page.route('**/api/readiness/summary', route => route.fulfill({ json: {
    ...readiness, sentence: 'Onvoldoende herstelgegevens voor een beoordeling.',
    breakdown: { sleep: null, hrv: null, rhr: null }, cachedAt: new Date().toISOString(),
    coldStart: { active: true, hrvDays: 0, nightsRemaining: 14 },
  } }))
  await page.goto('/auth/login')
  await page.fill('input[type="email"]', email!)
  await page.fill('input[type="password"]', password!)
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
  await page.goto('/gezondheid')
  await expect(page.getByText('Onvoldoende herstelgegevens', { exact: true })).toBeVisible()
  await expect(page.getByText('Goed hersteld', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Op koers', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Rustdag aanbevolen', { exact: true })).toHaveCount(0)
})
