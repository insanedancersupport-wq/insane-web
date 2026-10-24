import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAttendanceTrendSeries,
  getCompetitionParticipationSeries,
  getCompetitionResultsReport,
  getGroupAttendanceReport,
  getStudentAttendanceReport,
  getTrainerActivityReport,
  reportsQueryKey,
} from './reportsApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('reportsApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the deployed attendance RPC argument names without a trainer ID', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    await getStudentAttendanceReport({
      afterCursor: 'cursor',
      endDate: '2026-10-24',
      groupId: 'group-id',
      pageSize: 25,
      startDate: '2026-09-25',
    })
    await getGroupAttendanceReport({ endDate: '2026-10-24', groupId: 'group-id', startDate: '2026-09-25' })
    await getAttendanceTrendSeries({ endDate: '2026-10-24', groupId: 'group-id', startDate: '2026-09-25' })
    await getTrainerActivityReport({ endDate: '2026-10-24', startDate: '2026-09-25' })
    await getCompetitionResultsReport({
      afterCursor: 'cursor',
      competitionId: 'competition-id',
      endDate: '2026-10-24',
      resultType: 'team',
      startDate: '2026-09-25',
      status: 'completed',
    })
    await getCompetitionParticipationSeries({ endDate: '2026-10-24', startDate: '2026-09-25', status: 'completed' })

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'get_student_attendance_report', {
      after_cursor: 'cursor', page_size: 25, target_end_date: '2026-10-24',
      target_group_id: 'group-id', target_start_date: '2026-09-25', target_student_id: null,
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'get_group_attendance_report', {
      target_end_date: '2026-10-24', target_group_id: 'group-id', target_start_date: '2026-09-25',
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(3, 'get_attendance_trend_series', {
      bucket_granularity: 'month', target_end_date: '2026-10-24',
      target_group_id: 'group-id', target_start_date: '2026-09-25',
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(4, 'get_trainer_activity_report', {
      target_end_date: '2026-10-24', target_start_date: '2026-09-25', target_trainer_id: null,
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(5, 'get_competition_results_report', {
      after_cursor: 'cursor', page_size: 25, target_competition_id: 'competition-id',
      target_end_date: '2026-10-24', target_result_type: 'team', target_start_date: '2026-09-25',
      target_status: 'completed',
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(6, 'get_competition_participation_series', {
      target_end_date: '2026-10-24', target_start_date: '2026-09-25', target_status: 'completed',
    })
  })

  it('scopes cache keys by user, role, filters, and cursor', () => {
    expect(reportsQueryKey({
      cursor: null, endDate: '2026-10-24', groupId: null, reportType: 'student-attendance',
      role: 'admin', startDate: '2026-09-25', userId: 'admin',
    })).not.toEqual(reportsQueryKey({
      cursor: 'next', endDate: '2026-10-24', groupId: null, reportType: 'student-attendance',
      role: 'trainer', startDate: '2026-09-25', userId: 'trainer',
    }))
  })
})
