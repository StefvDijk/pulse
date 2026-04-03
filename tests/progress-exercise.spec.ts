import { test, expect } from '@playwright/test'

test.describe('R-015: Exercise progression API', () => {
  test('GET /api/progress/exercise redirects without auth', async ({ request }) => {
    const response = await request.get('/api/progress/exercise?name=Bench+Press', {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
  })

  test('GET /api/progress/exercises redirects without auth', async ({ request }) => {
    const response = await request.get('/api/progress/exercises', {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(307)
  })
})

test.describe('Exercise progression API — authenticated', () => {
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

  test('exercises list returns array of exercises', async ({ page }) => {
    const response = await page.request.get('/api/progress/exercises')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.exercises).toBeDefined()
    expect(Array.isArray(data.exercises)).toBeTruthy()
    expect(data.exercises.length).toBeGreaterThan(0)

    const first = data.exercises[0]
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('primaryMuscleGroup')
    expect(first).toHaveProperty('lastUsed')
  })

  test('exercise progression returns sorted data points', async ({ page }) => {
    // First get a real exercise name
    const listResponse = await page.request.get('/api/progress/exercises')
    const listData = await listResponse.json()
    const exerciseName = listData.exercises[0]?.name

    if (!exerciseName) return

    const response = await page.request.get(
      `/api/progress/exercise?name=${encodeURIComponent(exerciseName)}`,
    )
    expect(response.status()).toBe(200)
    const data = await response.json()

    expect(data.exerciseName).toBeTruthy()
    expect(Array.isArray(data.points)).toBeTruthy()

    // Verify sorting (ascending by date)
    for (let i = 1; i < data.points.length; i++) {
      expect(data.points[i].date >= data.points[i - 1].date).toBeTruthy()
    }

    // Verify point structure
    if (data.points.length > 0) {
      const point = data.points[0]
      expect(point).toHaveProperty('date')
      expect(point).toHaveProperty('maxWeight')
      expect(point).toHaveProperty('repsAtMax')
      expect(point).toHaveProperty('totalVolume')
    }
  })

  test('unknown exercise returns empty points', async ({ page }) => {
    const response = await page.request.get(
      '/api/progress/exercise?name=Nonexistent+Exercise+XYZ',
    )
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.points).toHaveLength(0)
  })

  test('missing name returns 400', async ({ page }) => {
    const response = await page.request.get('/api/progress/exercise')
    expect(response.status()).toBe(400)
  })
})
