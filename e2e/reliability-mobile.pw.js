import { expect, test } from '@playwright/test'

const syntheticUser = {
  aud: 'authenticated',
  email: 'e2e-reliability@example.test',
  id: '00000000-0000-4000-8000-000000000002',
  role: 'authenticated',
}

function syntheticSession() {
  return {
    access_token: 'e2e-reliability-access-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    refresh_token: 'e2e-reliability-refresh-token',
    token_type: 'bearer',
    user: syntheticUser,
  }
}

async function seedSession(page) {
  await page.addInitScript(({ session }) => {
    if (!sessionStorage.getItem('e2e-session-seeded')) {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
      sessionStorage.setItem('e2e-session-seeded', 'true')
    }
  }, { session: syntheticSession() })
}

async function stubAuthenticatedApi(page) {
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204 }))
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith('/profiles')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{
          active: true,
          full_name: 'E2E Reliability Admin',
          id: syntheticUser.id,
          onboarding_completed_at: '2026-01-01T00:00:00Z',
          role: 'admin',
        }]),
        status: 200,
      })
      return
    }

    if (url.pathname.endsWith('/school_settings')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'school-settings', school_name: 'E2E School', timezone: 'Europe/Bucharest' }),
        status: 200,
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      body: url.pathname.includes('get_admin_dashboard_summary') || url.pathname.includes('get_trainer_dashboard_summary')
        ? '[{}]'
        : '[]',
      status: 200,
    })
  })
}

test('failed login preserves input and displays existing error feedback', async ({ page }) => {
  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      status: 400,
    })
  })

  await page.goto('/login')
  await page.getByLabel('Email address').fill('failed@example.test')
  await page.getByLabel('Password').fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Unable to sign in. Check your email and password.')
  await expect(page.getByLabel('Email address')).toHaveValue('failed@example.test')
  await expect(page.getByLabel('Password')).toHaveValue('synthetic-password')
  await expect(page).toHaveURL(/\/login$/)
})

test('network disconnection during login displays an error without navigating', async ({ page }) => {
  await page.route('**/auth/v1/token*', (route) => route.abort('internetdisconnected'))

  await page.goto('/login')
  await page.getByLabel('Email address').fill('offline@example.test')
  await page.getByLabel('Password').fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Unable to sign in. Check your email and password.')
  await expect(page).toHaveURL(/\/login$/)
})

test('profile network failure renders account feedback without crashing', async ({ page }) => {
  await seedSession(page)
  await page.route('**/rest/v1/profiles*', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 'PGRST000', message: 'Synthetic profile failure' }),
    status: 500,
  }))

  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/app/dashboard')

  await expect(page.getByRole('heading', { name: 'Account setup required' })).toBeVisible()
  await expect(page.getByText('Your account profile could not be loaded.')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('logout returns to login and protected routes remain blocked', async ({ page }) => {
  await seedSession(page)
  await stubAuthenticatedApi(page)
  await page.goto('/app/dashboard')
  await expect(page.getByRole('heading', { name: 'Welcome, E2E Reliability Admin' })).toBeVisible()

  await page.getByRole('button', { name: 'Open user menu' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.evaluate(() => localStorage.clear())

  await page.goto('/app/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('priority pages fit mobile Chromium and mobile WebKit viewports', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only validation')

  await seedSession(page)
  await stubAuthenticatedApi(page)

  const routes = [
    '/app/dashboard',
    '/app/students',
    '/app/groups',
    '/app/calendar',
    '/app/attendance',
    '/app/competitions',
    '/app/tasks',
    '/app/reports',
  ]

  for (const route of routes) {
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(route)
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).last()).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth, `${route} has horizontal overflow`).toBeLessThanOrEqual(dimensions.clientWidth)
    expect(pageErrors, `${route} produced a page error`).toEqual([])
  }
})

test('calendar date and time pickers remain usable on mobile', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only validation')

  await seedSession(page)
  await stubAuthenticatedApi(page)
  await page.goto('/app/calendar')
  await page.getByRole('button', { name: 'Add activity' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Date' }).click()
  await page.getByRole('dialog', { name: 'Choose Date' }).locator('.react-datepicker__day--today').click()
  await dialog.getByRole('button', { name: 'Start time' }).click()
  await page.getByRole('dialog', { name: 'Choose Time' }).getByRole('option').first().click()

  await expect(dialog.getByRole('button', { name: 'Date' })).not.toHaveText('Select date')
  await expect(dialog.getByRole('button', { name: 'Start time' })).not.toHaveText('Select time')
})
