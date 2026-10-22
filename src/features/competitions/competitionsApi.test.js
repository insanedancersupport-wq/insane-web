import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteCompetition,
  enrollCompetitionGroup,
  getCompetitionParticipants,
} from './competitionsApi'
import { supabase } from '../../services/supabaseClient'

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('competitionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls group enrollment with the migration-defined RPC argument names', async () => {
    supabase.rpc.mockResolvedValue({ data: 3, error: null })

    await expect(enrollCompetitionGroup({ competitionId: 'competition-id', groupId: 'group-id' })).resolves.toBe(3)
    expect(supabase.rpc).toHaveBeenCalledWith('enroll_competition_group', {
      target_competition_id: 'competition-id',
      target_group_id: 'group-id',
    })
  })

  it('loads participant display data through the narrow competition-scoped RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    await expect(getCompetitionParticipants('competition-id')).resolves.toEqual([])
    expect(supabase.rpc).toHaveBeenCalledWith('get_competition_participant_display', {
      target_competition_id: 'competition-id',
    })
  })

  it('rejects zero-row competition deletes instead of reporting success', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn(() => ({ select }))
    const remove = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ delete: remove })

    await expect(deleteCompetition('competition-id')).rejects.toThrow('was not deleted')
  })
})
