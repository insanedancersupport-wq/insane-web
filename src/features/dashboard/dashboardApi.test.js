import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dashboardSummaryQueryKey,
  dashboardUpcomingClassesQueryKey,
  getDashboardSummary,
  getUpcomingDashboardClasses,
} from './dashboardApi'
import { listScheduleEntries } from '../calendar/calendarApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

vi.mock('../calendar/calendarApi', () => ({
  listScheduleEntries: vi.fn(),
}))

describe('dashboardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the admin summary RPC with its deployed argument names', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ active_students: 12 }], error: null })

    await expect(getDashboardSummary({
      endDate: '2026-10-31',
      role: 'admin',
      startDate: '2026-10-01',
    })).resolves.toEqual({ active_students: 12 })

    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_dashboard_summary', {
      target_end_date: '2026-10-31',
      target_start_date: '2026-10-01',
    })
  })

  it('uses the trainer summary RPC without a client-supplied trainer ID', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ active_groups: 2 }], error: null })

    await expect(getDashboardSummary({
      endDate: '2026-10-31',
      role: 'trainer',
      startDate: '2026-10-01',
    })).resolves.toEqual({ active_groups: 2 })

    expect(supabase.rpc).toHaveBeenCalledWith('get_trainer_dashboard_summary', {
      target_end_date: '2026-10-31',
      target_start_date: '2026-10-01',
    })
  })

  it('uses a bounded, cancelled-class-excluding schedule query for upcoming classes', async () => {
    listScheduleEntries.mockResolvedValue([
      { id: 'future', starts_at: '2026-10-24T12:00:00.000Z', status: 'scheduled' },
      { id: 'cancelled', starts_at: '2026-10-24T13:00:00.000Z', status: 'cancelled' },
      { id: 'past', starts_at: '2026-10-24T09:00:00.000Z', status: 'scheduled' },
    ])

    await expect(getUpcomingDashboardClasses({
      rangeEnd: '2026-10-31T00:00:00.000Z',
      rangeStart: '2026-10-24T10:00:00.000Z',
    })).resolves.toEqual([{ id: 'future', starts_at: '2026-10-24T12:00:00.000Z', status: 'scheduled' }])

    expect(listScheduleEntries).toHaveBeenCalledWith({
      entryType: 'class',
      excludeCancelled: true,
      limit: 5,
      rangeEnd: '2026-10-31T00:00:00.000Z',
      rangeStart: '2026-10-24T10:00:00.000Z',
    })
  })

  it('keeps summary and upcoming cache keys separated by user and role', () => {
    expect(dashboardSummaryQueryKey({
      endDate: '2026-10-31',
      role: 'admin',
      startDate: '2026-10-01',
      userId: 'admin-id',
    })).not.toEqual(dashboardSummaryQueryKey({
      endDate: '2026-10-31',
      role: 'trainer',
      startDate: '2026-10-01',
      userId: 'trainer-id',
    }))
    expect(dashboardUpcomingClassesQueryKey({
      rangeEndDate: '2026-10-31',
      rangeStartDate: '2026-10-24',
      role: 'admin',
      userId: 'admin-id',
    })).toEqual(['dashboard', 'admin-id', 'admin', 'upcoming-classes', '2026-10-24', '2026-10-31'])
  })
})
