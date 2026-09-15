import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { todayAmsterdam } from '../src/lib/time/amsterdam'
import { assertLocalSupabaseTarget } from '../src/lib/supabase/safe-target'

test('homepage loads a full dated training override without a render error', async ({page}) => {
  const admin = createClient(
    assertLocalSupabaseTarget(process.env.PULSE_E2E_SUPABASE_URL,'schema override E2E'),
    process.env.PULSE_E2E_SUPABASE_SERVICE_ROLE_KEY!,
    {auth:{persistSession:false,autoRefreshToken:false}},
  )
  const email = `schema-override-${randomUUID()}@example.test`
  const password = `Pulse-local-${randomUUID()}`
  const {data:created,error:createError} = await admin.auth.admin.createUser({email,password,email_confirm:true})
  expect(createError).toBeNull()
  const userId = created.user!.id
  const today = todayAmsterdam()
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  try {
    const {error:writeError} = await admin.from('training_schemas').insert({
      user_id:userId,title:'Schema override regression',schema_type:'upper_lower',start_date:today,is_active:true,weeks_planned:8,
      workout_schedule:[{day:'monday',focus:'Upper A',duration_min:60,exercises:[{name:'Pull Up',sets:3,reps:'4–6'}]}],
      scheduled_overrides:{[today]:{focus:'Upper A — full override regression',duration_min:48,exercises:[{name:'Assisted Pull Up',sets:3,reps:'4–6'}]}},
    })
    expect(writeError).toBeNull()
    await page.goto('/auth/login')
    await page.getByLabel('E-mailadres').fill(email)
    await page.getByLabel('Wachtwoord',{exact:true}).fill(password)
    await page.getByRole('button',{name:'Inloggen',exact:true}).click()
    await page.waitForURL('/')
    const response = await page.request.get('/api/schema/week')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.days).toHaveLength(7)
    expect(body.days.find((day:{date:string}) => day.date===today).tokens).toContainEqual(
      expect.objectContaining({title:'Upper A — full override regression',durationMin:48,subtitle:'Assisted Pull Up'}),
    )
    await expect(page.getByText('Vandaag',{exact:true})).toBeVisible()
    await expect(page.getByText('Deze week',{exact:true}).first()).toBeVisible()
    await expect(page.getByText('Kan homepage niet laden.')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  } finally {
    const {error:cleanupError} = await admin.auth.admin.deleteUser(userId)
    expect(cleanupError).toBeNull()
  }
})
