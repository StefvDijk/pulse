import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const mailpitUrl = 'http://127.0.0.1:54324'

interface MailpitMessageSummary {
  ID: string
  To: Array<{ Address: string }>
}

interface MailpitMessages {
  messages: MailpitMessageSummary[]
}

interface MailpitMessage {
  HTML: string
}

async function findRecoveryLink(email: string): Promise<string | null> {
  const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`)
  if (!listResponse.ok) return null

  const list = (await listResponse.json()) as MailpitMessages
  const message = list.messages.find((candidate) =>
    candidate.To.some((recipient) => recipient.Address === email),
  )
  if (!message) return null

  const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`)
  if (!messageResponse.ok) return null

  const detail = (await messageResponse.json()) as MailpitMessage
  const href = detail.HTML.match(/href="([^"]+)"/)?.[1]
  return href?.replaceAll('&amp;', '&') ?? null
}

test('an invalid recovery callback shows a safe error on login', async ({ page }) => {
  await page.goto('/auth/callback')

  await expect(page).toHaveURL('/auth/login?error=auth_callback_error')
  await expect(
    page.getByText('De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.', {
      exact: true,
    }),
  ).toBeVisible()
})

test('password recovery creates a usable session and replaces the old password', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One mutating auth contract run is sufficient')

  const runId = `${Date.now()}-${testInfo.workerIndex}`
  const email = `pulse-recovery-${runId}@example.test`
  const originalPassword = `pulse-original-${runId}`
  const recoveredPassword = `pulse-recovered-${Date.now()}`
  const admin = createClient(
    process.env.PULSE_E2E_SUPABASE_URL!,
    process.env.PULSE_E2E_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: originalPassword,
    email_confirm: true,
  })
  expect(createError).toBeNull()
  expect(created.user).toBeTruthy()

  try {
    await page.goto('/auth/login')
    await page.getByRole('link', { name: 'Wachtwoord vergeten?' }).click()
    await expect(page).toHaveURL('/auth/forgot-password')
    await expect(page.getByRole('heading', { name: 'Wachtwoord herstellen' })).toBeVisible()

    await page.getByLabel('E-mailadres').fill(email)
    await page.getByRole('button', { name: 'Herstellink versturen' }).click()
    await expect(page.getByRole('status')).toContainText(
      'Als er een Pulse-account voor dit e-mailadres bestaat',
    )

    let recoveryLink: string | null = null
    await expect
      .poll(async () => {
        recoveryLink = await findRecoveryLink(email)
        return recoveryLink
      })
      .not.toBeNull()
    if (!recoveryLink) throw new Error('Mailpit recovery link was not found')

    await page.goto(recoveryLink)
    await expect(page).toHaveURL('/auth/reset-password')
    await expect(page.getByRole('heading', { name: 'Nieuw wachtwoord' })).toBeVisible()

    await page.getByLabel('Nieuw wachtwoord', { exact: true }).fill(recoveredPassword)
    await page.getByLabel('Herhaal nieuw wachtwoord').fill(recoveredPassword)
    await page.getByRole('button', { name: 'Wachtwoord opslaan' }).click()
    await expect(page.getByRole('status')).toHaveText('Je wachtwoord is bijgewerkt.')
    await page.getByRole('link', { name: 'Naar Pulse' }).click()
    await expect(page).toHaveURL('/')

    await page.context().clearCookies()
    await page.goto('/auth/login')
    await page.getByLabel('E-mailadres').fill(email)
    await page.getByLabel('Wachtwoord').fill(originalPassword)
    await page.getByRole('button', { name: 'Inloggen' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL('/auth/login')

    await page.getByLabel('Wachtwoord').fill(recoveredPassword)
    await page.getByRole('button', { name: 'Inloggen' }).click()
    await expect(page).toHaveURL('/')
  } finally {
    if (created.user) {
      await admin.auth.admin.deleteUser(created.user.id)
    }
  }
})
