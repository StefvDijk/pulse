import { test, expect } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────────
// Chat history panel — clock-icon trigger, panel open, new-chat reset
//
// Public /chat auth-redirect is already covered in tests/contextual-coach.spec.ts.
// Authenticated tests — credentials are required by playwright.config.ts.
// ──────────────────────────────────────────────────────────────────────────────

const email = process.env.TEST_USER_EMAIL
const password = process.env.TEST_USER_PASSWORD

test.describe('Chat history panel (authenticated)', () => {
  test.skip(!email || !password, 'TEST_USER_EMAIL / TEST_USER_PASSWORD not set')

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
    await expect(page.getByRole('dialog', { name: 'Gesprekken', exact: true })).toBeVisible()

    // New-chat row inside the panel closes it and shows the empty composer
    await page.getByText('Nieuwe chat').click()
    await expect(page.getByPlaceholder(/Bericht aan coach|Stel een vraag/)).toBeVisible()
  })

  test('clock icon button is present in the coach header', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByRole('button', { name: 'Gesprekshistorie' })).toBeVisible()
  })

  test('history recovers from invalid data and a failed deletion without hiding the session', async ({ page }) => {
    let valid = false
    let removed = false
    let deleteAttempts = 0
    await page.route('**/api/chat/sessions', route => route.fulfill({json:{sessions:removed ? [] : [{
      id:'recovery-session',title:'Chat hersteltest',last_message_at:null,message_count:valid ? null : 'invalid',
    }]}}))
    await page.route('**/api/chat/sessions/recovery-session', route => {
      deleteAttempts++
      if (deleteAttempts === 1) return route.fulfill({status:500,json:{error:'Temporary failure'}})
      removed = true
      return route.fulfill({json:{success:true}})
    })
    await page.goto('/chat')
    await page.getByRole('button',{name:'Gesprekshistorie'}).click()
    await expect(page.getByText('Kon gesprekken niet laden.')).toBeVisible()
    valid = true
    await page.getByRole('button',{name:'Opnieuw proberen'}).click()
    await expect(page.getByText('Chat hersteltest')).toBeVisible()
    await expect(page.getByText('Aantal berichten onbekend')).toBeVisible()
    await page.getByRole('button',{name:'Verwijder gesprek'}).click()
    await expect(page.getByText('Kon gesprek niet verwijderen. Probeer opnieuw.')).toBeVisible()
    await expect(page.getByText('Chat hersteltest')).toBeVisible()
    await page.getByRole('button',{name:'Opnieuw proberen'}).click()
    await expect(page.getByText('Chat hersteltest')).not.toBeVisible()
    await expect(page.getByText('Nog geen eerdere gesprekken.')).toBeVisible()
    expect(deleteAttempts).toBe(2)
  })

  test('new-chat button resets the session without opening history panel', async ({ page }) => {
    await page.goto('/chat')
    await page.getByRole('button', { name: 'Nieuwe chat' }).click()
    // Panel should NOT be open — "Gesprekken" heading should not be visible
    await expect(page.getByRole('dialog', { name: 'Gesprekken', exact: true })).not.toBeVisible()
    // Composer input is still visible
    await expect(page.getByPlaceholder(/Bericht aan coach|Stel een vraag/)).toBeVisible()
  })
})
