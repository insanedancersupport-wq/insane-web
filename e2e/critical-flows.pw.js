import { test, expect } from './fixtures.js'

async function signIn(page, user) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/app/dashboard')
}

test.describe('admin critical workflows', () => {
  test('creates and edits groups, students, and tasks', async ({ page, workspace }) => {
    await signIn(page, workspace.admin)

    await page.goto('/app/groups')
    await expect(page.locator('h1', { hasText: 'Groups' })).toBeVisible()
    await page.getByRole('button', { name: 'Add group' }).click()
    const groupDialog = page.getByRole('dialog')
    const createdGroupName = `E2E Created Group ${workspace.runId}`
    await groupDialog.getByLabel('Group name').fill(createdGroupName)
    await groupDialog.getByLabel('Category').fill('E2E Category')
    await groupDialog.getByLabel('Level').fill('Advanced')
    await groupDialog.getByLabel('Default room').selectOption(workspace.room.id)
    await groupDialog.getByLabel(new RegExp(`E2E Trainer ${workspace.runId}`)).check()
    await groupDialog.getByLabel('Primary trainer').selectOption(workspace.trainerRecord.id)
    await groupDialog.getByRole('button', { name: 'Save group' }).click()
    await expect(groupDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: createdGroupName })).toBeVisible()

    const createdGroupCard = page.getByRole('heading', { name: createdGroupName }).locator('..').locator('..')
    await createdGroupCard.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('dialog').getByLabel('Category').fill('Updated E2E Category')
    await page.getByRole('dialog').getByRole('button', { name: 'Save group' }).click()
    await expect(page.getByText('Updated E2E Category')).toBeVisible()

    await page.goto('/app/students')
    await page.getByRole('button', { name: 'Add student' }).click()
    const studentDialog = page.getByRole('dialog')
    const createdStudentName = `E2E Created Student ${workspace.runId}`
    await studentDialog.getByLabel('First name').fill('E2E Created')
    await studentDialog.getByLabel('Last name').fill(`Student ${workspace.runId}`)
    await studentDialog.getByLabel('Email').fill(`created-${workspace.runId}@example.test`)
    await studentDialog.getByLabel(workspace.group.name).check()
    await studentDialog.getByRole('button', { name: 'Save student' }).click()
    await expect(studentDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: createdStudentName })).toBeVisible()

    const createdStudentCard = page.getByRole('heading', { name: createdStudentName }).locator('..').locator('..')
    await createdStudentCard.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('dialog').getByLabel('Phone').fill('+40000000000')
    await page.getByRole('dialog').getByRole('button', { name: 'Save student' }).click()
    await createdStudentCard.getByRole('link', { name: 'View details' }).click()
    await expect(page.getByRole('definition').filter({ hasText: '+40000000000' })).toBeVisible()

    await page.goto('/app/tasks')
    await page.getByRole('button', { name: '+ New Task' }).click()
    const taskDialog = page.getByRole('dialog')
    const createdTaskTitle = `E2E Created Task ${workspace.runId}`
    await taskDialog.getByLabel('Title').fill(createdTaskTitle)
    await taskDialog.getByLabel('Description').fill('Created through the admin workflow.')
    await taskDialog.getByLabel('Assigned to').selectOption(workspace.trainer.id)
    await taskDialog.getByRole('button', { name: 'Save task' }).click()
    await expect(taskDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: createdTaskTitle })).toBeVisible()

    const createdTaskCard = page.getByRole('heading', { name: createdTaskTitle }).locator('..').locator('..').locator('..')
    await createdTaskCard.getByLabel('Status').selectOption('done')
    await expect(page.getByRole('status')).toHaveText('Task status updated.')
  })

  test('creates a calendar activity, records attendance, and views reports', async ({ page, workspace }) => {
    await signIn(page, workspace.admin)

    await page.goto('/app/calendar')
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
    await page.getByRole('button', { name: 'Add activity' }).click()
    const calendarDialog = page.getByRole('dialog')
    await calendarDialog.getByLabel('Title').fill(`E2E Created Activity ${workspace.runId}`)
    await calendarDialog.getByLabel('Type').selectOption('class')
    await calendarDialog.getByRole('button', { name: 'Date' }).click()
    await page.locator('.react-datepicker__day--today').click()
    await calendarDialog.getByRole('button', { name: 'Start time' }).click()
    await page.getByRole('dialog', { name: 'Choose Time' }).getByRole('option', { name: '10:00 AM' }).click()
    await calendarDialog.getByRole('button', { name: 'End time' }).click()
    await page.getByRole('dialog', { name: 'Choose Time' }).getByRole('option', { name: '11:00 AM' }).click()
    await calendarDialog.getByLabel('Group').selectOption(workspace.group.id)
    await calendarDialog.getByLabel('Responsible trainer').selectOption(workspace.trainerRecord.id)
    await calendarDialog.getByLabel('Room').selectOption(workspace.room.id)
    await calendarDialog.getByRole('button', { name: 'Save activity' }).click()
    await expect(calendarDialog).toBeHidden()

    await page.goto(`/app/attendance/entries/${workspace.scheduleEntry.id}`)
    await expect(page.getByRole('heading', { name: workspace.scheduleEntry.title })).toBeVisible()
    await page.getByLabel('Attendance status').selectOption('present')
    await page.getByRole('button', { name: 'Save attendance' }).click()
    await expect(page.getByRole('region', { name: 'Class roster' }).getByText('Marked', { exact: true })).toBeVisible()

    await page.goto('/app/competitions')
    await expect(page.getByRole('heading', { name: workspace.competition.name })).toBeVisible()
    await page.goto('/app/reports')
    await expect(page.getByRole('heading', { name: 'Attendance reports' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Student attendance by historical class group' })).toContainText(workspace.student.last_name)
  })
})

test.describe('trainer authorization workflows', () => {
  test('views assigned operations and cannot perform admin operations', async ({ page, workspace }) => {
    await signIn(page, workspace.trainer)

    await page.goto('/app/groups')
    await expect(page.getByRole('heading', { name: workspace.group.name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add group' })).toHaveCount(0)

    await page.goto('/app/calendar')
    await expect(page.getByRole('button', { name: workspace.scheduleEntry.title })).toBeVisible()

    await page.goto(`/app/attendance/entries/${workspace.scheduleEntry.id}`)
    await page.getByLabel('Attendance status').selectOption('absent')
    await page.getByRole('button', { name: 'Save attendance' }).click()
    await expect(page.getByRole('region', { name: 'Class roster' }).getByText('Marked', { exact: true })).toBeVisible()

    await page.goto('/app/tasks')
    await expect(page.getByRole('heading', { name: workspace.task.title })).toBeVisible()
    await page.getByRole('region', { name: 'Tasks' }).getByLabel('Status').selectOption('in_progress')
    await expect(page.getByRole('status')).toHaveText('Task status updated.')

    await page.goto('/app/competitions')
    await expect(page.getByRole('heading', { name: workspace.competition.name })).toBeVisible()
    await page.goto('/app/users')
    await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  })

  test('inactive accounts lose protected access and server-side admin writes are rejected', async ({ page, workspace }) => {
    await signIn(page, workspace.trainer)
    await workspace.adminClient.from('profiles').update({ active: false }).eq('id', workspace.trainer.id)

    await page.goto('/app/groups')
    await expect(page.getByRole('heading', { name: 'Account unavailable' })).toBeVisible()

    const trainerClient = await import('@supabase/supabase-js').then(({ createClient }) => createClient(
      process.env.E2E_SUPABASE_URL,
      process.env.E2E_SUPABASE_PUBLISHABLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    ))
    const { data: sessionData, error: loginError } = await trainerClient.auth.signInWithPassword({
      email: workspace.trainer.email,
      password: workspace.trainer.password,
    })
    expect(loginError).toBeNull()
    const { error: unauthorizedWrite } = await trainerClient.from('rooms').insert({
      name: `Unauthorized Room ${workspace.runId}`,
    })
    expect(unauthorizedWrite).toBeTruthy()
    expect(sessionData.session).toBeTruthy()
  })
})
