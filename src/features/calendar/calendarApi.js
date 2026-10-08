import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export function scheduleErrorMessage(error, fallback = 'Unable to save the schedule entry.') {
  if (error?.code === '23P01') {
    if (error.constraint === 'schedule_entries_no_room_overlap') {
      return 'This room is already occupied during the selected time.'
    }

    if (error.constraint === 'schedule_entries_no_trainer_overlap') {
      return 'This trainer already has another activity during the selected time.'
    }

    return 'The selected schedule time conflicts with an existing activity.'
  }

  if (error?.constraint === 'schedule_entries_class_requires_references') {
    return 'Classes require a group, responsible trainer, and room.'
  }

  if (
    error?.message?.includes('does not exist because of the daylight-saving')
    || error?.message?.includes('does not exist in the school timezone')
  ) {
    return 'This local time does not exist because of the daylight-saving change. Choose a different time.'
  }

  if (error?.message?.includes('is ambiguous in the school timezone')) {
    return 'This local time occurs twice because of the daylight-saving change. Choose a non-ambiguous time.'
  }

  if (error?.message?.includes('same local school date')) {
    return 'Schedule entries must start and end on the same local school date.'
  }

  if (error?.message?.includes('Classes require a group')) {
    return 'Classes require a group, responsible trainer, and room.'
  }

  return fallback
}

function throwOnScheduleError(error, fallback) {
  if (error) {
    throw new Error(scheduleErrorMessage(error, fallback))
  }
}

const scheduleFields = `
  id,
  title,
  entry_type,
  group_id,
  trainer_id,
  room_id,
  starts_at,
  ends_at,
  status,
  is_extra,
  notes,
  created_by,
  created_at,
  updated_at,
  group:groups(id, name),
  trainer:trainers(id, first_name, last_name),
  room:rooms(id, name)
`

export async function getAuthoritativeSchoolSettings() {
  const { data, error } = await client().from('school_settings')
    .select('id, school_name, timezone')
    .eq('is_authoritative', true)
    .single()

  throwOnScheduleError(error, 'Unable to load the school timezone.')
  return data
}

export async function listScheduleEntries({
  entryType,
  groupId,
  rangeEnd,
  rangeStart,
  roomId,
  trainerId,
}) {
  let query = client().from('schedule_entries')
    .select(scheduleFields)
    .lt('starts_at', rangeEnd)
    .gt('ends_at', rangeStart)
    .order('starts_at')

  if (entryType) {
    query = query.eq('entry_type', entryType)
  }

  if (groupId) {
    query = query.eq('group_id', groupId)
  }

  if (roomId) {
    query = query.eq('room_id', roomId)
  }

  if (trainerId) {
    query = query.eq('trainer_id', trainerId)
  }

  const { data, error } = await query
  throwOnScheduleError(error, 'Unable to load schedule entries.')
  return data
}

export async function createScheduleEntry(values) {
  const { data, error } = await client().from('schedule_entries')
    .insert(values)
    .select(scheduleFields)
    .single()

  throwOnScheduleError(error, 'Unable to create the schedule entry.')
  return data
}

export async function updateScheduleEntry({ id, values }) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('A valid schedule entry ID is required.')
  }

  const { data, error } = await client().from('schedule_entries')
    .update(values)
    .eq('id', id)
    .select(scheduleFields)
    .single()

  throwOnScheduleError(error, 'Unable to update the schedule entry.')
  return data
}

export async function cancelScheduleEntry(id) {
  const { error } = await client().from('schedule_entries')
    .update({ status: 'cancelled' })
    .eq('id', id)

  throwOnScheduleError(error, 'Unable to cancel the schedule entry.')
}

export async function deleteScheduleEntry(id) {
  const { error } = await client().from('schedule_entries').delete().eq('id', id)
  throwOnScheduleError(error, 'Unable to permanently delete the schedule entry.')
}

export async function createWeeklyScheduleEntries(values) {
  const { data, error } = await client().rpc('create_weekly_schedule_entries', values)
  throwOnScheduleError(error, 'Unable to create the weekly schedule entries. No entries were created.')
  return data
}
