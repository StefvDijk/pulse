import { test, expect, type Page } from '@playwright/test'

const email = process.env.TEST_USER_EMAIL
const password = process.env.TEST_USER_PASSWORD

async function login(page: Page) {
  await page.goto('/auth/login')
  await page.fill('input[type="email"]', email!)
  await page.fill('input[type="password"]', password!)
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

test.describe('persisted rich chat cards', () => {
  test.skip(!email || !password, 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.route('**/api/chat/sessions', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: '95000000-0000-0000-0000-000000000001',
              title: 'Rich-card fixture',
              last_message_at: '2026-08-12T12:00:00Z',
              message_count: 1,
            },
          ],
        }),
      })
    })
    await page.route('**/api/chat/history?session_id=*', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: '95000000-0000-0000-0000-000000000001',
          messages: [
            {
              id: '96000000-0000-0000-0000-000000000001',
              role: 'assistant',
              content: 'Je voeding en belasting zijn bijgewerkt.',
              created_at: '2026-08-12T12:00:00Z',
              cards: [
                {
                  type: 'writeback_card',
                  kind: 'nutrition',
                  label: '✓ Voeding gelogd',
                },
                {
                  type: 'stat_card',
                  label: 'Weekbelasting',
                  value: '412',
                  unit: 'AU',
                  trend: 'up',
                  context: '12% hoger dan vorige week',
                },
              ],
            },
          ],
        }),
      })
    })
  })

  test('renders writeback and stat cards restored from history', async ({ page }) => {
    await page.goto('/chat')
    await page.getByRole('button', { name: 'Gesprekshistorie' }).click()
    await page.getByRole('button', { name: /Rich-card fixture/ }).click()

    await expect(page.getByText('✓ Voeding gelogd')).toBeVisible()
    await expect(page.getByText('Weekbelasting')).toBeVisible()
    await expect(page.getByText('412')).toBeVisible()
    await expect(page.getByText('12% hoger dan vorige week')).toBeVisible()
  })
})
