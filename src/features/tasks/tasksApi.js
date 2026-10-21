import { supabase } from '../../services/supabaseClient'

const taskFields = `
  id,
  title,
  description,
  assigned_to,
  created_by,
  due_date,
  priority,
  status,
  created_at,
  updated_at,
  assigned:profiles!tasks_assigned_to_fkey(id, full_name, role, active),
  creator:profiles!tasks_created_by_fkey(id, full_name, role, active)
`

const editableFields = ['assigned_to', 'description', 'due_date', 'priority', 'status', 'title']

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function requireId(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message)
  }
}

function throwOnError(error, message) {
  if (error) {
    throw new Error(message)
  }
}

function taskPayload(values) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => editableFields.includes(key))
      .map(([key, value]) => [key, key === 'description' || key === 'due_date' ? value || null : value]),
  )
}

export async function getTasks() {
  const { data, error } = await client().from('tasks').select(taskFields)
  throwOnError(error, 'Unable to load tasks.')
  return data
}

export async function getEligibleTaskAssignees() {
  const { data, error } = await client().from('profiles')
    .select('id, full_name, role, active')
    .eq('active', true)
    .in('role', ['admin', 'trainer'])
    .order('full_name')
  throwOnError(error, 'Unable to load task assignees.')
  return data
}

export async function createTask(values) {
  const payload = taskPayload(values)
  const { data, error } = await client().from('tasks')
    .insert(payload)
    .select(taskFields)
    .single()
  throwOnError(error, 'Unable to create the task.')
  return data
}

export async function updateTask({ id, values }) {
  requireId(id, 'A valid task ID is required.')
  const payload = taskPayload(values)
  const { data, error } = await client().from('tasks')
    .update(payload)
    .eq('id', id)
    .select(taskFields)
    .single()
  throwOnError(error, 'Unable to update the task.')
  return data
}

export async function updateTaskStatus({ id, status }) {
  return updateTask({ id, values: { status } })
}

export async function deleteTask(id) {
  requireId(id, 'A valid task ID is required.')
  const { data, error } = await client().from('tasks')
    .delete()
    .eq('id', id)
    .select('id')
  throwOnError(error, 'Unable to delete the task.')

  if (!data || data.length !== 1) {
    throw new Error('The task could not be deleted. Refresh and try again.')
  }
}
