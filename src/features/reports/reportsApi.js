import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

async function reportRpc(functionName, parameters) {
  const { data, error } = await client().rpc(functionName, parameters)

  if (error) {
    throw error
  }

  return data ?? []
}

export function reportsQueryKey({
  competitionId,
  cursor,
  endDate,
  groupId,
  pageSize,
  reportType,
  resultType,
  role,
  startDate,
  status,
  trainerId,
  userId,
}) {
  return [
    'reports',
    userId,
    role,
    reportType,
    startDate,
    endDate,
    groupId ?? null,
    trainerId ?? null,
    competitionId ?? null,
    status ?? null,
    resultType ?? null,
    pageSize ?? null,
    cursor ?? null,
  ]
}

export function getStudentAttendanceReport({ afterCursor, endDate, groupId, pageSize = 25, startDate, studentId = null }) {
  return reportRpc('get_student_attendance_report', {
    after_cursor: afterCursor,
    page_size: pageSize,
    target_end_date: endDate,
    target_group_id: groupId,
    target_start_date: startDate,
    target_student_id: studentId,
  })
}

export function getGroupAttendanceReport({ endDate, groupId, startDate }) {
  return reportRpc('get_group_attendance_report', {
    target_end_date: endDate,
    target_group_id: groupId,
    target_start_date: startDate,
  })
}

export function getAttendanceTrendSeries({ endDate, groupId, startDate }) {
  return reportRpc('get_attendance_trend_series', {
    bucket_granularity: 'month',
    target_end_date: endDate,
    target_group_id: groupId,
    target_start_date: startDate,
  })
}

export function getTrainerActivityReport({ endDate, startDate, trainerId = null }) {
  return reportRpc('get_trainer_activity_report', {
    target_end_date: endDate,
    target_start_date: startDate,
    target_trainer_id: trainerId,
  })
}

export function getCompetitionResultsReport({
  afterCursor,
  competitionId = null,
  endDate,
  pageSize = 25,
  resultType = null,
  startDate,
  status = null,
}) {
  return reportRpc('get_competition_results_report', {
    after_cursor: afterCursor,
    page_size: pageSize,
    target_competition_id: competitionId,
    target_end_date: endDate,
    target_result_type: resultType,
    target_start_date: startDate,
    target_status: status,
  })
}

export function getCompetitionParticipationSeries({ endDate, startDate, status = null }) {
  return reportRpc('get_competition_participation_series', {
    target_end_date: endDate,
    target_start_date: startDate,
    target_status: status,
  })
}
