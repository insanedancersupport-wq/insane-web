import { supabase } from '../../services/supabaseClient'
import { listScheduleEntries } from '../calendar/calendarApi'

const attendanceStatuses = new Set(['present', 'absent', 'recovery'])
const attendanceFields = `
  id,
  schedule_entry_id,
  student_id,
  status,
  notes,
  marked_by,
  marked_at,
  created_at,
  updated_at,
  student:students(id, first_name, last_name, status)
`

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
    if (error.message?.includes('Attendance can be marked only after')) {
      throw new Error('Attendance can be marked once the class has started.')
    }

    if (error.message?.includes('cancelled class')) {
      throw new Error('Attendance cannot be changed for a cancelled class.')
    }

    if (error.message?.includes('only for class entries')) {
      throw new Error('Attendance is available only for class entries.')
    }

    if (error.message?.includes('not currently assigned')) {
      throw new Error('This student is not currently assigned to the class group.')
    }

    throw new Error(message)
  }
}

function normalizedRecords(scheduleEntryId, records) {
  if (!Array.isArray(records) || records.length === 0) {
    return []
  }

  return records.map((record) => {
    requireId(record.studentId, 'A valid student ID is required.')

    if (!attendanceStatuses.has(record.status)) {
      throw new Error('Choose a valid attendance status.')
    }

    return {
      notes: record.notes?.trim() || null,
      schedule_entry_id: scheduleEntryId,
      status: record.status,
      student_id: record.studentId,
    }
  })
}

export async function getAttendanceEntry(scheduleEntryId) {
  requireId(scheduleEntryId, 'A valid schedule entry ID is required.')

  const { data, error } = await client().from('schedule_entries').select(`
    id,
    title,
    entry_type,
    group_id,
    trainer_id,
    starts_at,
    ends_at,
    status,
    group:groups(id, name),
    trainer:trainers(id, first_name, last_name)
  `).eq('id', scheduleEntryId).single()

  throwOnError(error, 'Unable to load this class.')
  return data
}

export async function listAttendanceRoster(groupId) {
  requireId(groupId, 'A valid group ID is required.')

  const { data, error } = await client().from('student_groups')
    .select('student_id, student:students(id, first_name, last_name, status)')
    .eq('group_id', groupId)

  throwOnError(error, 'Unable to load the class roster.')
  return data
    .map((membership) => membership.student)
    .filter(Boolean)
    .sort((left, right) => (
      `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`)
    ))
}

export async function listAttendanceRecords(scheduleEntryIds) {
  if (!Array.isArray(scheduleEntryIds) || scheduleEntryIds.length === 0) {
    return []
  }

  const { data, error } = await client().from('attendance_records')
    .select(attendanceFields)
    .in('schedule_entry_id', scheduleEntryIds)

  throwOnError(error, 'Unable to load attendance records.')
  return data
}

export async function saveAttendanceRecords({ records, scheduleEntryId }) {
  requireId(scheduleEntryId, 'A valid schedule entry ID is required.')
  const recordsToDelete = records.filter((record) => record.status === '').map((record) => {
    requireId(record.studentId, 'A valid student ID is required.')
    return record.studentId
  })
  const rows = normalizedRecords(scheduleEntryId, records.filter((record) => record.status !== ''))

  if (rows.length === 0 && recordsToDelete.length === 0) {
    return []
  }

  let savedRecords = []

  if (rows.length > 0) {
    const { data, error } = await client().from('attendance_records')
      .upsert(rows, { onConflict: 'schedule_entry_id,student_id' })
      .select(attendanceFields)

    throwOnError(error, 'Unable to save attendance. Please try again.')
    savedRecords = data
  }

  if (recordsToDelete.length > 0) {
    const { data, error } = await client().from('attendance_records')
      .delete()
      .eq('schedule_entry_id', scheduleEntryId)
      .in('student_id', recordsToDelete)
      .select('id')

    throwOnError(error, 'Unable to clear attendance. Please try again.')

    if (!data || data.length !== recordsToDelete.length) {
      throw new Error('Unable to clear every selected attendance record. Please refresh and try again.')
    }
  }

  return savedRecords
}

export async function getMonthlyAttendance({ groupId, rangeEnd, rangeStart }) {
  requireId(groupId, 'A valid group ID is required.')

  const [entries, roster] = await Promise.all([
    listScheduleEntries({
      entryType: 'class',
      groupId,
      rangeEnd,
      rangeStart,
    }),
    listAttendanceRoster(groupId),
  ])
  const eligibleEntries = entries.filter((entry) => entry.status !== 'cancelled')
  const records = await listAttendanceRecords(eligibleEntries.map((entry) => entry.id))

  return { entries: eligibleEntries, records, roster }
}
