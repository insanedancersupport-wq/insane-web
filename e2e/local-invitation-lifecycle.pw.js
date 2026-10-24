import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const appUrl = process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000'
const apiUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const inbucketUrl = process.env.E2E_INBUCKET_URL ?? 'http://127.0.0.1:54324'
const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required to run the local invitation E2E test.`)
  }

  return value
}

async function invitationUrl(inviteeEmail) {
  const messages = await (await fetch(`${inbucketUrl}/api/v1/messages`)).json()
  const message = (messages.messages ?? messages).find((item) => JSON.stringify(item).includes(inviteeEmail))
  const detail = await (await fetch(`${inbucketUrl}/api/v1/message/${message.id ?? message.ID}`)).json()
  const match = JSON.stringify(detail).replaceAll('&amp;', '&').match(/http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify[^"\\\s]+/)

  if (!match) {
    throw new Error('Invitation confirmation URL was not found in Inbucket.')
  }

  return match[0]
}

test.use({
  launchOptions: { executablePath: '/snap/bin/chromium' },
})

test('completes a real local invitation lifecycle', async ({ browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const adminEmail = `e2e-admin-${suffix}@example.test`
  const inviteeEmail = `e2e-invitee-${suffix}@example.test`
  const adminPassword = 'Local-E2E-Admin-Password-123!'
  const password = 'Local-E2E-Invitee-Password-123!'
  const adminClient = createClient(
    apiUrl,
    required(serviceRoleKey, 'E2E_SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const browserClient = createClient(
    apiUrl,
    required(publishableKey, 'E2E_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Admin' },
  })
  expect(adminError).toBeNull()
  expect(adminData.user).not.toBeNull()
  await adminClient.from('profiles').update({ role: 'admin' }).eq('id', adminData.user.id)
  await adminClient.auth.admin.updateUserById(adminData.user.id, {
    app_metadata: { initial_password_setup_nonce: crypto.randomUUID() },
  })
  const { data: adminSession, error: adminLoginError } = await browserClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  expect(adminLoginError).toBeNull()
  const inviteResponse = await fetch(`${apiUrl}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminSession.session.access_token}`,
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'invite', email: inviteeEmail, fullName: 'E2E Invited Trainer', role: 'trainer' }),
  })
  expect(inviteResponse.status).toBe(201)

  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(await invitationUrl(inviteeEmail))
  await page.waitForURL(`${appUrl}/set-password**`)
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible()

  await page.goto(`${appUrl}/app/dashboard`)
  await page.waitForURL(`${appUrl}/set-password**`)

  const preOnboardingStatus = await page.evaluate(async ({ apiUrl, publishableKey }) => {
    const token = Object.values(localStorage)
      .map((value) => JSON.parse(value))
      .find((value) => value?.access_token)?.access_token
    const response = await fetch(`${apiUrl}/rest/v1/rpc/get_student_attendance_report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_start_date: '2026-01-01', p_end_date: '2026-01-02' }),
    })
    return response.status
  }, { apiUrl, publishableKey })
  expect(preOnboardingStatus).toBeGreaterThanOrEqual(400)

  await page.getByLabel('New password').fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Set password' }).click()
  await page.waitForURL(`${appUrl}/app/dashboard**`)

  await context.close()

  const loginContext = await browser.newContext()
  const loginPage = await loginContext.newPage()
  await loginPage.goto(`${appUrl}/login`)
  await loginPage.getByLabel('Email address').fill(inviteeEmail)
  await loginPage.getByLabel('Password').fill(password)
  await loginPage.getByRole('button', { name: 'Sign in' }).click()
  await loginPage.waitForURL(`${appUrl}/app/dashboard**`)

  const authorization = await loginPage.evaluate(async ({ apiUrl, publishableKey }) => {
    const token = Object.values(localStorage)
      .map((value) => JSON.parse(value))
      .find((value) => value?.access_token)?.access_token
    const headers = { Authorization: `Bearer ${token}`, apikey: publishableKey, 'Content-Type': 'application/json' }
    const completion = await fetch(`${apiUrl}/functions/v1/complete-initial-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password: 'Another-Password-123!' }),
    })
    const admin = await fetch(`${apiUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'set-active', userId: '00000000-0000-4000-8000-000000000001', active: false }),
    })
    const rooms = await fetch(`${apiUrl}/rest/v1/rooms?select=id`, { headers })

    return { admin: admin.status, completion: completion.status, rooms: rooms.status }
  }, { apiUrl, publishableKey })

  expect(authorization.completion).toBe(409)
  expect(authorization.admin).toBe(403)
  expect(authorization.rooms).toBe(200)
  await loginContext.close()
})
