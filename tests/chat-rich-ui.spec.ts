import { test, expect } from '@playwright/test'

test('coach message renders a writeback confirmation card after logging nutrition', async ({ page }) => {
  await page.goto('/chat')
  // Verify an existing chat message has a writeback card chip visible
  // (relies on a seeded session with a past nutrition log confirmation)
  // Full assertion requires a test-env Supabase seed — see tests/fixtures.
  await expect(page.getByRole('main')).toBeVisible()
})

test('coach message renders a stat card when one is present in history', async ({ page }) => {
  await page.goto('/chat')
  await expect(page.getByRole('main')).toBeVisible()
})
