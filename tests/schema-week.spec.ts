import { test, expect } from '@playwright/test'

test.describe('R-006/R-007: GET /api/schema/week', () => {
  test('redirects unauthenticated request to login', async ({ request }) => {
    const response = await request.get('/api/schema/week', {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toContain('/auth/login')
  })
})

test.describe('Schema week API — authenticated', () => {
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

  test('returns 7 days with schema title', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.schemaTitle).toBeTruthy()
    expect(data.days).toHaveLength(7)
  })

  test('each day has required fields and valid status', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    for (const day of data.days) {
      expect(day).toHaveProperty('date')
      expect(day).toHaveProperty('dayLabel')
      expect(day).toHaveProperty('dayName')
      expect(day).toHaveProperty('status')
      expect(['completed', 'today', 'planned', 'rest']).toContain(day.status)
    }
  })

  test('Monday has a gym workout scheduled', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    const monday = data.days.find((d: { dayName: string }) => d.dayName === 'monday')
    expect(monday).toBeTruthy()
    expect(monday.workout).toBeTruthy()
    expect(monday.workout.type).toBe('gym')
  })

  test('Saturday is a rest day', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    const saturday = data.days.find((d: { dayName: string }) => d.dayName === 'saturday')
    expect(saturday).toBeTruthy()
    expect(saturday.status).toBe('rest')
    expect(saturday.workout).toBeNull()
  })

  test('completed workouts include exercises with set-level data', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    const completed = data.days.find(
      (d: { status: string }) => d.status === 'completed',
    )

    // This week may or may not have completed workouts — only assert if one exists
    if (completed) {
      expect(completed.completedWorkout).toBeTruthy()
      expect(completed.completedWorkout.exercises.length).toBeGreaterThan(0)

      const exercise = completed.completedWorkout.exercises[0]
      expect(exercise).toHaveProperty('name')
      expect(exercise).toHaveProperty('exercise_order')
      expect(exercise.sets.length).toBeGreaterThan(0)

      const set = exercise.sets[0]
      expect(set).toHaveProperty('set_order')
      expect(set).toHaveProperty('weight_kg')
      expect(set).toHaveProperty('reps')
    }
  })

  test('planned workouts include lastPerformance when available', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    const planned = data.days.find(
      (d: { status: string }) => d.status === 'planned' || d.status === 'today',
    )

    // Planned days should have lastPerformance if this workout was done before
    if (planned?.lastPerformance) {
      expect(planned.lastPerformance.date).toBeTruthy()
      expect(planned.lastPerformance.exercises.length).toBeGreaterThan(0)

      const exercise = planned.lastPerformance.exercises[0]
      expect(exercise).toHaveProperty('name')
      expect(exercise).toHaveProperty('sets')
    }
  })

  test('first day is Monday, last day is Sunday', async ({ page }) => {
    const response = await page.request.get('/api/schema/week')
    const data = await response.json()

    expect(data.days[0].dayName).toBe('monday')
    expect(data.days[0].dayLabel).toBe('ma')
    expect(data.days[6].dayName).toBe('sunday')
    expect(data.days[6].dayLabel).toBe('zo')
  })
})
