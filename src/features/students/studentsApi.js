import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function throwOnError(error, message) {
  if (error) {
    throw new Error(message)
  }
}

function requireStudentId(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('A valid student ID is required to update a student.')
  }
}

const studentFields = 'id, first_name, last_name, phone, email, birth_date, notes, status, created_at, updated_at'
const studentListFields = `
  id,
  first_name,
  last_name,
  phone,
  email,
  birth_date,
  notes,
  status,
  student_groups(group:groups(id, name))
`

export async function listStudents() {
  const { data, error } = await client().from('students').select(studentFields)
    .order('last_name').order('first_name')
  throwOnError(error, 'Unable to load students.')
  return data
}

export async function listStudentsWithGroups() {
  const { data, error } = await client().from('students').select(studentListFields)
    .order('last_name').order('first_name')
  throwOnError(error, 'Unable to load students.')
  return data
}

export async function getStudent(studentId) {
  const { data, error } = await client().from('students').select(studentFields).eq('id', studentId).single()
  throwOnError(error, 'Unable to load this student.')
  return data
}

export async function createStudent(values) {
  const { data, error } = await client().from('students').insert(values).select('id').single()
  throwOnError(error, 'Unable to create the student.')
  return data
}

export async function updateStudent({ id, values }) {
  requireStudentId(id)
  const { error } = await client().from('students').update(values).eq('id', id)
  throwOnError(error, 'Unable to update the student.')
}

export async function deleteStudent(id) {
  requireStudentId(id)
  const { data, error } = await client().from('students').delete().eq('id', id).select('id').single()
  throwOnError(error, 'Unable to permanently delete the student.')
  return data
}

export async function listStudentGroups(studentId) {
  const { data, error } = await client().from('student_groups').select('group_id')
    .eq('student_id', studentId)
  throwOnError(error, 'Unable to load group memberships.')
  return data
}

export async function reconcileStudentGroups({ groupIds, studentId }) {
  const { error } = await client().rpc('reconcile_student_groups', {
    selected_group_ids: groupIds,
    target_student_id: studentId,
  })
  throwOnError(error, 'Unable to update group memberships.')
}
