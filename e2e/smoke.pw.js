import { expect, test } from '@playwright/test'

const syntheticUser = {
  aud: 'authenticated',
  email: 'e2e-smoke@example.test',
  id: '00000000-0000-4000-8000-000000000001',
  role: 'authenticated',
}

function syntheticSession() {
  return {
    access_token: 'e2e-smoke-access-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    refresh_token: 'e2e-smoke-refresh-token',
    token_type: 'bearer',
    user: syntheticUser,
  }
}

async function seedSyntheticSession(page) {
  await page.addInitScript(({ session }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
  }, { session: syntheticSession() })
}

test('application loads successfully without page errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('login page exposes the expected accessible controls', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('unauthenticated users cannot access protected routes', async ({ page }) => {
  await page.goto('/app/dashboard')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('desktop navigation renders without page errors', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile-'), 'Desktop-only smoke test')

  await seedSyntheticSession(page)
  await page.route('**/rest/v1/profiles*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        active: true,
        full_name: 'E2E Smoke Admin',
        id: syntheticUser.id,
        onboarding_completed_at: '2026-01-01T00:00:00Z',
        role: 'admin',
      }]),
      status: 200,
    })
  })

  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/app/dashboard')

  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Reports' }).first()).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('mobile login layout fits the viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only smoke test')

  await page.goto('/login')

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})
