import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reconcileStudentGroups } from './studentsApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

describe('reconcileStudentGroups', () => {
  beforeEach(() => {
    supabase.rpc.mockResolvedValue({ error: null })
  })

  it('uses the atomic reconciliation RPC with all current group ids', async () => {
    await reconcileStudentGroups({
      groupIds: ['group-a', 'group-b'],
      studentId: 'student-id',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('reconcile_student_groups', {
      selected_group_ids: ['group-a', 'group-b'],
      target_student_id: 'student-id',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
