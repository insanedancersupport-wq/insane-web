import { createClient } from '@supabase/supabase-js'
import { test as base } from '@playwright/test'

import { requireSafeMutationEnvironment } from './testEnvironment.js'

function assertResponse(response, operation) {
  if (response.error) {
    throw new Error(`${operation} failed: ${response.error.message}`)
  }

  return response.data
}

function localDate(offsetDays = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

async function createUser(adminClient, { email, fullName, password, role }) {
  const temporaryPassword = `Temporary-${crypto.randomUUID()}-Pass!`
  const created = assertResponse(
    await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password: temporaryPassword,
      user_metadata: { full_name: fullName },
    }),
    `create ${role} user`,
  )

  assertResponse(
    await adminClient.auth.admin.updateUserById(created.user.id, {
      app_metadata: { initial_password_setup_nonce: crypto.randomUUID() },
      password,
    }),
    `complete ${role} password`,
  )

  assertResponse(
    await adminClient.from('profiles').update({ full_name: fullName, role }).eq('id', created.user.id),
    `configure ${role} profile`,
  )

  const profile = assertResponse(
    await adminClient.from('profiles').select('id, active, onboarding_completed_at, role').eq('id', created.user.id).single(),
    `verify ${role} profile`,
  )

  if (!profile.active || profile.role !== role || !profile.onboarding_completed_at) {
    throw new Error(`${role} fixture account did not complete server-owned onboarding.`)
  }

  return { email, id: created.user.id, password }
}

async function createWorkspace(testInfo) {
  const { supabaseUrl } = requireSafeMutationEnvironment()
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  const runId = `${Date.now()}-${testInfo.workerIndex}-${crypto.randomUUID().slice(0, 8)}`
  const adminClient = createClient(supabaseUrl.href, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminEmail = `e2e-admin-${runId}@example.test`
  const trainerEmail = `e2e-trainer-${runId}@example.test`
  const admin = await createUser(adminClient, {
    email: adminEmail,
    fullName: `E2E Admin ${runId}`,
    password: `Admin-${crypto.randomUUID()}-Pass!`,
    role: 'admin',
  })
  const trainer = await createUser(adminClient, {
    email: trainerEmail,
    fullName: `E2E Trainer ${runId}`,
    password: `Trainer-${crypto.randomUUID()}-Pass!`,
    role: 'trainer',
  })

  const room = assertResponse(
    await adminClient.from('rooms').insert({
      description: 'Synthetic E2E room',
      name: `E2E Room ${runId}`,
    }).select('id, name').single(),
    'create room fixture',
  )
  const trainerRecord = assertResponse(
    await adminClient.from('trainers').insert({
      email: trainer.email,
      first_name: 'E2E',
      last_name: `Trainer ${runId}`,
      profile_id: trainer.id,
    }).select('id').single(),
    'create trainer fixture',
  )
  const group = assertResponse(
    await adminClient.from('groups').insert({
      category: 'E2E',
      default_room_id: room.id,
      level: 'Intermediate',
      name: `E2E Group ${runId}`,
    }).select('id, name').single(),
    'create group fixture',
  )
  assertResponse(
    await adminClient.from('group_trainers').insert({
      group_id: group.id,
      is_primary: true,
      trainer_id: trainerRecord.id,
    }),
    'assign trainer fixture',
  )
  const student = assertResponse(
    await adminClient.from('students').insert({
      email: `student-${runId}@example.test`,
      first_name: 'E2E',
      last_name: `Student ${runId}`,
      status: 'active',
    }).select('id, first_name, last_name').single(),
    'create student fixture',
  )
  assertResponse(
    await adminClient.from('student_groups').insert({
      group_id: group.id,
      joined_on: localDate(-30),
      student_id: student.id,
    }),
    'assign student fixture',
  )

  const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const pastEnd = new Date(Date.now() - 60 * 60 * 1000)
  const scheduleEntry = assertResponse(
    await adminClient.from('schedule_entries').insert({
      created_by: admin.id,
      ends_at: pastEnd.toISOString(),
      entry_type: 'class',
      group_id: group.id,
      room_id: room.id,
      starts_at: pastStart.toISOString(),
      title: `E2E Class ${runId}`,
      trainer_id: trainerRecord.id,
    }).select('id, title').single(),
    'create schedule fixture',
  )
  const task = assertResponse(
    await adminClient.from('tasks').insert({
      assigned_to: trainer.id,
      created_by: admin.id,
      description: 'Synthetic E2E task',
      due_date: localDate(1),
      priority: 'medium',
      title: `E2E Task ${runId}`,
    }).select('id, title').single(),
    'create task fixture',
  )
  const competition = assertResponse(
    await adminClient.from('competitions').insert({
      competition_date: localDate(14),
      created_by: admin.id,
      description: 'Synthetic E2E competition',
      location: 'E2E Arena',
      name: `E2E Competition ${runId}`,
      status: 'upcoming',
    }).select('id, name').single(),
    'create competition fixture',
  )
  assertResponse(
    await adminClient.from('competition_groups').insert({ competition_id: competition.id, group_id: group.id }),
    'associate competition group fixture',
  )
  assertResponse(
    await adminClient.from('competition_trainers').insert({ competition_id: competition.id, trainer_id: trainerRecord.id }),
    'assign competition trainer fixture',
  )
  assertResponse(
    await adminClient.from('competition_participants').insert({ competition_id: competition.id, student_id: student.id }),
    'enroll competition participant fixture',
  )

  return {
    admin,
    adminClient,
    competition,
    group,
    room,
    runId,
    scheduleEntry,
    student,
    task,
    trainer,
    trainerRecord,
  }
}

async function cleanupWorkspace(workspace) {
  const { adminClient } = workspace
  const deleteRows = async (table, column, values) => {
    if (values.length === 0) return
    assertResponse(await adminClient.from(table).delete().in(column, values), `clean up ${table}`)
  }

  const extraGroups = assertResponse(
    await adminClient.from('groups').select('id').like('name', `E2E Created Group ${workspace.runId}%`),
    'find created group fixtures',
  )
  const extraStudents = assertResponse(
    await adminClient.from('students').select('id').eq('first_name', 'E2E Created').like('last_name', `Student ${workspace.runId}%`),
    'find created student fixtures',
  )
  const extraTasks = assertResponse(
    await adminClient.from('tasks').select('id').like('title', `E2E Created Task ${workspace.runId}%`),
    'find created task fixtures',
  )
  const extraEntries = assertResponse(
    await adminClient.from('schedule_entries').select('id').like('title', `E2E Created Activity ${workspace.runId}%`),
    'find created schedule fixtures',
  )

  await deleteRows(
    'attendance_records',
    'schedule_entry_id',
    [workspace.scheduleEntry.id, ...extraEntries.map(({ id }) => id)],
  )
  await deleteRows('competition_result_members', 'competition_id', [workspace.competition.id])
  await deleteRows('competition_results', 'competition_id', [workspace.competition.id])
  await deleteRows('competition_participants', 'competition_id', [workspace.competition.id])
  await deleteRows('competition_groups', 'competition_id', [workspace.competition.id])
  await deleteRows('competition_trainers', 'competition_id', [workspace.competition.id])
  await deleteRows('competitions', 'id', [workspace.competition.id])
  await deleteRows('tasks', 'id', [workspace.task.id])
  await deleteRows('tasks', 'id', extraTasks.map(({ id }) => id))
  await deleteRows('schedule_entries', 'id', [workspace.scheduleEntry.id, ...extraEntries.map(({ id }) => id)])
  await deleteRows('student_groups', 'student_id', [workspace.student.id, ...extraStudents.map(({ id }) => id)])
  await deleteRows('group_trainers', 'group_id', [workspace.group.id, ...extraGroups.map(({ id }) => id)])
  await deleteRows('groups', 'id', [workspace.group.id, ...extraGroups.map(({ id }) => id)])
  await deleteRows('students', 'id', [workspace.student.id, ...extraStudents.map(({ id }) => id)])
  await deleteRows('trainers', 'id', [workspace.trainerRecord.id])
  await deleteRows('rooms', 'id', [workspace.room.id])
  await adminClient.auth.admin.deleteUser(workspace.trainer.id)
  await adminClient.auth.admin.deleteUser(workspace.admin.id)
}

export const test = base.extend({
  workspace: async ({ request }, fixtureUse, testInfo) => {
    void request
    const workspace = await createWorkspace(testInfo)

    try {
      await fixtureUse(workspace)
    } finally {
      await cleanupWorkspace(workspace)
    }
  },
})

export { expect } from '@playwright/test'
