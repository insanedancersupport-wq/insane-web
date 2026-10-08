import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWeeklyScheduleEntries, scheduleErrorMessage } from './calendarApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('calendarApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.rpc.mockResolvedValue({ data: [{ id: 'entry-id' }], error: null })
  })

  it('sends weekly concrete-entry creation through one atomic RPC', async () => {
    const values = {
      first_date: '2026-10-05',
      last_date: '2026-10-19',
      target_end_time: '19:00',
      target_entry_type: 'class',
      target_group_id: 'group-id',
      target_is_extra: false,
      target_iso_weekday: 1,
      target_notes: null,
      target_room_id: 'room-id',
      target_start_time: '18:00',
      target_title: 'Weekly class',
      target_trainer_id: 'trainer-id',
    }

    await expect(createWeeklyScheduleEntries(values)).resolves.toEqual([{ id: 'entry-id' }])
    expect(supabase.rpc).toHaveBeenCalledWith('create_weekly_schedule_entries', values)
  })

  it('maps stable exclusion constraints to specific room and trainer feedback', () => {
    expect(scheduleErrorMessage({
      code: '23P01',
      constraint: 'schedule_entries_no_room_overlap',
    })).toBe('This room is already occupied during the selected time.')

    expect(scheduleErrorMessage({
      code: '23P01',
      constraint: 'schedule_entries_no_trainer_overlap',
    })).toBe('This trainer already has another activity during the selected time.')
  })

  it('maps safe weekly RPC daylight-saving validation errors to actionable feedback', () => {
    expect(scheduleErrorMessage({
      message: 'The selected local time does not exist in the school timezone. Choose a different time.',
    })).toBe('This local time does not exist because of the daylight-saving change. Choose a different time.')

    expect(scheduleErrorMessage({
      message: 'The selected local time is ambiguous in the school timezone. Choose a non-ambiguous time.',
    })).toBe('This local time occurs twice because of the daylight-saving change. Choose a non-ambiguous time.')
  })
})
