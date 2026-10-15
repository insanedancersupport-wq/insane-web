import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveAttendanceRecords } from './attendanceApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('saveAttendanceRecords', () => {
  const select = vi.fn()
  const upsert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    select.mockResolvedValue({ data: [{ id: 'attendance-id' }], error: null })
    upsert.mockReturnValue({ select })
    supabase.from.mockReturnValue({ upsert })
  })

  it('batch upserts marked attendance against one concrete schedule entry', async () => {
    await expect(saveAttendanceRecords({
      scheduleEntryId: 'entry-id',
      records: [
        { notes: '  Arrived late  ', status: 'present', studentId: 'student-one' },
        { notes: '', status: 'recovery', studentId: 'student-two' },
      ],
    })).resolves.toEqual([{ id: 'attendance-id' }])

    expect(supabase.from).toHaveBeenCalledWith('attendance_records')
    expect(upsert).toHaveBeenCalledWith([
      {
        notes: 'Arrived late',
        schedule_entry_id: 'entry-id',
        status: 'present',
        student_id: 'student-one',
      },
      {
        notes: null,
        schedule_entry_id: 'entry-id',
        status: 'recovery',
        student_id: 'student-two',
      },
    ], { onConflict: 'schedule_entry_id,student_id' })
  })

  it('does not call Supabase when no rows changed', async () => {
    await expect(saveAttendanceRecords({
      scheduleEntryId: 'entry-id',
      records: [],
    })).resolves.toEqual([])

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('deletes persisted attendance rows changed to not marked', async () => {
    const selectDeleted = vi.fn().mockResolvedValue({ data: [{ id: 'attendance-id' }], error: null })
    const inFilter = vi.fn().mockReturnValue({ select: selectDeleted })
    const eq = vi.fn().mockReturnValue({ in: inFilter })
    const deleteRecords = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ delete: deleteRecords })

    await expect(saveAttendanceRecords({
      scheduleEntryId: 'entry-id',
      records: [{ notes: '', status: '', studentId: 'student-id' }],
    })).resolves.toEqual([])

    expect(supabase.from).toHaveBeenCalledWith('attendance_records')
    expect(deleteRecords).toHaveBeenCalledWith()
    expect(eq).toHaveBeenCalledWith('schedule_entry_id', 'entry-id')
    expect(inFilter).toHaveBeenCalledWith('student_id', ['student-id'])
    expect(selectDeleted).toHaveBeenCalledWith('id')
  })

  it('rejects an invalid status before writing', async () => {
    await expect(saveAttendanceRecords({
      scheduleEntryId: 'entry-id',
      records: [{ status: 'unmarked', studentId: 'student-id' }],
    })).rejects.toThrow('Choose a valid attendance status.')

    expect(supabase.from).not.toHaveBeenCalled()
  })
})
